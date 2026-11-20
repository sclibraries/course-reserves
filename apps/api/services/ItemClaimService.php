<?php

namespace app\services;

use app\models\FacultySubmission;

/** Coordinates atomic item claims and exposes one shared read shape to staff controllers. */
class ItemClaimService
{
    use ServiceResult;

    const PAGE_SIZE = 20;

    private $repository;
    private $listRepository;
    private $eventLog;
    private $presenter;
    private $expiry;
    private $readService;
    private $transitionService;
    private $activityService;
    private $groups;
    private $submittedScope;
    private $linkedItems;
    private $expiryLinkedItems;

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
        $this->submittedScope = new SubmittedSubmissionScope();
        $this->linkedItems = new LinkedItemService($this->repository, $this->expiry, $this->submittedScope);
        $this->expiryLinkedItems = new LinkedItemService(
            $this->repository,
            $this->expiry,
            $this->submittedScope,
            [$this->submittedScope, 'blockedBodyForStatus']
        );
        $this->readService = new ItemClaimReadService(
            $this->linkedItems, $this->eventLog, $this->repository, $this->expiry, $this->presenter
        );
        $this->transitionService = new ItemClaimTransitionService(
            $this->repository,
            $this->eventLog,
            $this->presenter,
            $this->expiry,
            $notifier,
            $this->groups,
            $this->linkedItems
        );
        $this->activityService = new ItemClaimActivityService($this->repository, $this->eventLog, $this->expiry);
    }

    public function claim($kind, $id, array $actor)
    {
        return $this->linkedItems->withLinkedItem($kind, $id, function ($item, $transaction, $now) use ($kind, $id, $actor) {
            $username = $this->username($actor);
            if (!empty($item['assigned_group_id']) && !$this->groups->isMember(
                $item['assigned_group_id'], $username, true
            )) {
                return $this->result(403, ['error_code' => 'not_group_member']);
            }
            $before = $this->snapshot($item);
            if (!$this->repository->claimIfUnclaimed($kind, $id, $username, $now)) {
                if (!empty($item['assigned_group_id']) && !$this->groups->isMember(
                    $item['assigned_group_id'], $username, true
                )) {
                    return $this->result(403, ['error_code' => 'not_group_member']);
                }
                return $this->result(409, [
                    'error_code' => 'already_claimed',
                    'claimed_by_display' => $item['claimed_by_display'],
                ]);
            }
            $claimed = $item;
            $claimed['claimed_by'] = $username;
            $claimed['claimed_at'] = $now;
            $claimed['last_activity_at'] = $now;
            $claimed['status'] = 'in_progress';
            $claimant = $this->groups->staffMember($username);
            $claimed['claimed_by_display'] = $claimant['display_name'] ?? $username;
            $this->eventLog->record(
                $item['submission_id'], $id, $actor, 'claimed', null, $before, $this->snapshot($claimed), $kind
            );
            return $this->result(200, ['item' => $this->presenter->present($claimed, $this->expiry->hours())]);
        });
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
        return $this->transitionService->transition('handoff', $kind, $id, $actor, $reason, $toUsername);
    }

    public function handoffToGroup($kind, $id, $groupId, array $actor, $reason = null)
    {
        return $this->transitionService->transition('group_handoff', $kind, $id, $actor, $reason, (int)$groupId);
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
        if ($blocked = $this->submittedScope->guardStatus($submission->status)) {
            return $this->result(409, $blocked);
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
        $this->expireDueClaims();
        $page = max(1, (int)$page);
        $rows = $this->listRepository->queuePage($term, $type, $page, self::PAGE_SIZE);
        return [
            'items' => $this->presentRows($rows),
            'count' => $this->listRepository->queueCount($term, $type),
        ];
    }

    public function myItems($username)
    {
        $this->expireDueClaims();
        return ['items' => $this->presentRows($this->listRepository->myItems($username))];
    }

    public function staff($query)
    {
        return ['items' => $this->listRepository->staff($query)];
    }

    public function timeline($kind, $id)
    {
        return $this->readService->timeline($kind, $id);
    }

    public function recordActivity($kind, array $item)
    {
        $this->activityService->recordActivity($kind, $item);
    }

    public function claimActorMatches(array $item, array $actor)
    {
        return $this->transitionService->isClaimedBy($item, $actor);
    }

    public function renewClaimLocked($kind, $id, $now)
    {
        return $this->repository->touchActivity($kind, $id, $now);
    }

    public function withLinkedItem($kind, $id, callable $callback, ?callable $beforeProjection = null)
    {
        return $this->linkedItems->withLinkedItem($kind, $id, $callback, $beforeProjection);
    }

    public function completeLegacyChecklistItem($kind, array $item, array $actor)
    {
        $this->activityService->completeLegacyChecklistItem($kind, $item, $actor);
    }

    public function legacyClaimedNewItems($username)
    {
        return $this->repository->legacyClaimedNewItems($username);
    }

    public function expireDueClaims()
    {
        return $this->expiry->expireDueClaims($this->expiryLinkedItems);
    }

    public function claimsForSubmission($submissionId)
    {
        return $this->readService->claimsForSubmission($submissionId);
    }

    public function expiredClaimCandidates()
    {
        return $this->expiry->expiredClaimCandidates();
    }

    public function expireCandidate(array $reference)
    {
        return $this->expiry->expireCandidate($reference, $this->expiryLinkedItems);
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
}
