<?php

namespace app\services;

use Yii;

/** Coordinates atomic item claims and exposes one shared read shape to staff controllers. */
class ItemClaimService
{
    const PAGE_SIZE = 20;

    private $repository;
    private $listRepository;
    private $eventLog;
    private $presenter;
    private $expiry;
    private $transitionService;
    private $activityService;
    private $groups;

    public function __construct($repository = null, $eventLog = null, $nowProvider = null, $notifier = null, $groups = null)
    {
        $this->repository = $repository ?: new ItemClaimRepository();
        $this->groups = $groups ?: new StaffGroupRepository();
        $this->listRepository = new ItemClaimListRepository($this->repository);
        $this->eventLog = $eventLog ?: new WorkflowEventLog();
        $this->presenter = new ItemClaimPresenter();
        $nowProvider = $nowProvider ?: function () {
            return date('Y-m-d H:i:s');
        };
        $notifier = $notifier ?: new NullWorkflowNotifier();
        $this->expiry = new ItemClaimExpiryService($this->repository, $this->eventLog, $nowProvider, $notifier);
        $this->transitionService = new ItemClaimTransitionService(
            $this->repository,
            $this->eventLog,
            $this->presenter,
            $this->expiry,
            $notifier,
            $this->groups
        );
        $this->activityService = new ItemClaimActivityService($this->repository, $this->eventLog, $this->expiry);
    }

    public function claim($kind, $id, array $actor)
    {
        $transaction = Yii::$app->db->beginTransaction();
        $notification = null;
        try {
            $item = $this->repository->find($kind, $id, true);
            if (!$item) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'item_not_found']);
            }
            if ($item['link_state'] !== 'linked') {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'submission_not_linked']);
            }
            $now = $this->expiry->now();
            $notification = $this->expiry->expireLocked($kind, $item, $now);
            if ($notification) {
                $item = $this->repository->find($kind, $id, true);
            }
            $username = $this->username($actor);
            if (!empty($item['assigned_group_id']) && !$this->groups->isMember($item['assigned_group_id'], $username)) {
                $transaction->commit();
                $this->expiry->notify($notification);
                return $this->result(403, ['error_code' => 'not_group_member']);
            }
            $before = $this->snapshot($item);
            if (!$this->repository->claimIfUnclaimed($kind, $id, $username, $now)) {
                $current = $this->repository->find($kind, $id, true);
                $transaction->commit();
                $this->expiry->notify($notification);
                if ($current && !empty($current['assigned_group_id']) && !$this->groups->isMember($current['assigned_group_id'], $username)) {
                    return $this->result(403, ['error_code' => 'not_group_member']);
                }
                return $this->result(409, [
                    'error_code' => 'already_claimed',
                    'claimed_by_display' => $item['claimed_by_display'],
                ]);
            }
            $claimed = $this->repository->find($kind, $id);
            $this->eventLog->record(
                $item['submission_id'], $id, $actor, 'claimed', null, $before, $this->snapshot($claimed), $kind
            );
            $transaction->commit();
            $this->expiry->notify($notification);
            return $this->result(200, ['item' => $this->presenter->present($claimed, $this->expiry->hours())]);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function release($kind, $id, array $actor, $reason = null)
    {
        return $this->transitionService->transition('release', $kind, $id, $actor, $reason, null);
    }

    public function handoff($kind, $id, $toUsername, array $actor, $reason = null)
    {
        $toUsername = trim((string)$toUsername);
        if ($toUsername === '') {
            return $this->result(400, ['error_code' => 'to_username_required']);
        }
        $target = $this->repository->findStaffByUsername($toUsername);
        if (!$target) {
            return $this->result(404, ['error_code' => 'unknown_staff']);
        }
        return $this->transitionService->transition('handoff', $kind, $id, $actor, $reason, $target);
    }

    public function handoffToGroup($kind, $id, $groupId, array $actor, $reason = null)
    {
        $group = $this->groups->find((int)$groupId);
        if (!$group) {
            return $this->result(404, ['error_code' => 'group_not_found']);
        }
        return $this->transitionService->transition('group_handoff', $kind, $id, $actor, $reason, $group);
    }

    public function takeover($kind, $id, array $actor, $reason)
    {
        $reason = trim((string)$reason);
        if ($reason === '') {
            return $this->result(400, ['error_code' => 'reason_required']);
        }
        return $this->transitionService->transition('takeover', $kind, $id, $actor, $reason, null);
    }

    public function claimAll($uuid, array $actor)
    {
        $submission = $this->repository->submissionByUuid($uuid);
        if (!$submission) {
            return $this->result(404, ['error_code' => 'submission_not_found']);
        }
        if ($submission->link_state !== 'linked') {
            return $this->result(409, ['error_code' => 'submission_not_linked']);
        }
        $claimed = [];
        $skipped = [];
        foreach ($this->repository->itemRefsBySubmission($submission->submission_id) as $reference) {
            $result = $this->claim($reference['kind'], $reference['id'], $actor);
            if ($result['status'] === 200) {
                $claimed[] = ['kind' => $reference['kind'], 'id' => $reference['id']];
            } elseif ($result['status'] === 409 && $result['body']['error_code'] === 'already_claimed') {
                $skipped[] = [
                    'kind' => $reference['kind'],
                    'id' => $reference['id'],
                    'claimed_by_display' => $result['body']['claimed_by_display'],
                ];
            }
        }
        return $this->result(200, ['claimed' => $claimed, 'skipped' => $skipped]);
    }

    public function queue($term, $type, $page)
    {
        $this->expiry->expireDueClaims();
        $page = max(1, (int)$page);
        $rows = $this->listRepository->queuePage($term, $type, $page, self::PAGE_SIZE);
        return [
            'items' => $this->presentRows($rows),
            'count' => $this->listRepository->queueCount($term, $type),
        ];
    }

    public function myItems($username)
    {
        $this->expiry->expireDueClaims();
        return ['items' => $this->presentRows($this->listRepository->myItems($username))];
    }

    public function staff($query)
    {
        return ['items' => $this->listRepository->staff($query)];
    }

    public function timeline($kind, $id)
    {
        $notification = null;
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $item = $this->repository->find($kind, $id, true);
            if (!$item) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'item_not_found']);
            }
            if ($item['link_state'] !== 'linked') {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'submission_not_linked']);
            }
            $notification = $this->expiry->expireLocked($kind, $item, $this->expiry->now());
            $transaction->commit();
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
        $this->expiry->notify($notification);
        return $this->result(200, ['items' => $this->eventLog->itemTimeline($kind, $id)]);
    }

    public function recordActivity($kind, $id)
    {
        $this->activityService->recordActivity($kind, $id);
    }

    public function completeLegacyChecklistItem($kind, $id, array $actor)
    {
        $this->activityService->completeLegacyChecklistItem($kind, $id, $actor);
    }

    public function legacyClaimedNewItems($username)
    {
        return $this->repository->legacyClaimedNewItems($username);
    }

    public function expireDueClaims()
    {
        return $this->expiry->expireDueClaims();
    }

    private function presentRows(array $rows)
    {
        return array_map(function ($row) {
            return $this->presenter->present($row, $this->expiry->hours());
        }, $rows);
    }

    private function snapshot(array $item)
    {
        return [
            'status' => $item['status'],
            'claimed_by' => $item['claimed_by'],
            'claimed_at' => $item['claimed_at'],
            'last_activity_at' => $item['last_activity_at'],
            'assigned_group_id' => $item['assigned_group_id'],
        ];
    }

    private function username(array $actor)
    {
        return (string)($actor['username'] ?? $actor['id'] ?? '');
    }

    private function result($status, array $body)
    {
        return ['status' => $status, 'body' => $body];
    }
}
