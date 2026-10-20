<?php

namespace app\services;

use Yii;

/** Performs conditional release, person hand-off, and takeover writes. */
class ItemClaimTransitionService
{
    private $repository;
    private $eventLog;
    private $presenter;
    private $expiry;
    private $notifier;
    private $groups;

    public function __construct($repository, $eventLog, $presenter, $expiry, $notifier, $groups = null)
    {
        $this->repository = $repository;
        $this->eventLog = $eventLog;
        $this->presenter = $presenter;
        $this->expiry = $expiry;
        $this->notifier = $notifier;
        $this->groups = $groups ?: new StaffGroupRepository();
    }

    public function transition($operation, $kind, $id, array $actor, $reason, $target)
    {
        $transaction = Yii::$app->db->beginTransaction();
        $notification = null;
        try {
            $item = $this->repository->find($kind, $id, true);
            if (!$item) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'item_not_found']);
            }
            if ($blocked = (new SubmittedSubmissionScope())->guardStatus($item['submission_status'])) {
                $transaction->rollBack();
                return $this->result(409, $blocked);
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
            $actorUsername = (string)($actor['username'] ?? $actor['id'] ?? '');
            $previousHolder = $item['claimed_by'];
            if ($operation === 'takeover' && $previousHolder === null) {
                $transaction->commit();
                $this->expiry->notify($notification);
                return $this->result(409, ['error_code' => 'not_claimed']);
            }
            if ($operation !== 'takeover' && !$this->isClaimedBy($item, $actor)) {
                $transaction->commit();
                $this->expiry->notify($notification);
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            $before = $this->snapshot($item);
            $updated = $operation === 'release'
                ? $this->repository->releaseIfOwned($kind, $id, $actorUsername, $now)
                : ($operation === 'handoff'
                    ? $this->repository->handoffIfOwned($kind, $id, $actorUsername, $target['username'], $now)
                    : ($operation === 'group_handoff'
                        ? $this->repository->handoffToGroupIfOwned($kind, $id, $actorUsername, $target['id'], $now)
                        : $this->repository->takeoverIfClaimed($kind, $id, $actorUsername, $now)));
            if (!$updated) {
                $transaction->commit();
                $this->expiry->notify($notification);
                return $this->result(409, ['error_code' => $operation === 'takeover' ? 'not_claimed' : 'not_claimed_by_you']);
            }
            $eventType = [
                'release' => 'released',
                'handoff' => 'handed_off',
                'takeover' => 'taken_over',
                'group_handoff' => 'group_handoff',
            ][$operation];
            $after = $this->repository->find($kind, $id);
            $this->eventLog->record(
                $item['submission_id'], $id, $actor, $eventType, $reason, $before, $this->snapshot($after), $kind
            );
            $transaction->commit();
            $this->expiry->notify($notification);
            if ($operation === 'handoff') {
                $this->notify('claim_handed_off', $this->notificationContext($kind, $id, $item, $actorUsername, $target['username']));
            } elseif ($operation === 'takeover') {
                $this->notify('claim_taken_over', $this->notificationContext($kind, $id, $item, $actorUsername, $previousHolder));
            } elseif ($operation === 'group_handoff') {
                foreach ($this->groups->memberUsernames($target['id']) as $memberUsername) {
                    $context = $this->notificationContext($kind, $id, $item, $actorUsername, $memberUsername);
                    $context['group_id'] = (int)$target['id'];
                    $context['group_name'] = $target['name'];
                    $this->notify('group_handoff', $context);
                }
            }
            return $this->result(200, ['item' => $this->presenter->present($after, $this->expiry->hours())]);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
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

    private function notificationContext($kind, $id, array $item, $actor, $recipient)
    {
        return [
            'item_kind' => $kind,
            'item_id' => (int)$id,
            'submission_id' => (int)$item['submission_id'],
            'actor_username' => $actor,
            'recipient_username' => $recipient,
        ];
    }

    private function notify($eventType, array $context)
    {
        $this->notifier->notify($eventType, $context);
    }

    public function isClaimedBy(array $item, array $actor)
    {
        $username = (string)($actor['username'] ?? $actor['id'] ?? '');
        return $item['claimed_by'] !== null && $item['claimed_by'] === $username;
    }

    private function result($status, array $body)
    {
        return ['status' => $status, 'body' => $body];
    }
}
