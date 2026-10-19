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

    public function __construct($repository, $eventLog, $presenter, $expiry, $notifier)
    {
        $this->repository = $repository;
        $this->eventLog = $eventLog;
        $this->presenter = $presenter;
        $this->expiry = $expiry;
        $this->notifier = $notifier;
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
            if ($operation !== 'takeover' && $previousHolder !== $actorUsername) {
                $transaction->commit();
                $this->expiry->notify($notification);
                return $this->result(409, ['error_code' => 'not_claimed_by_you']);
            }
            $before = $this->snapshot($item);
            $updated = $operation === 'release'
                ? $this->repository->releaseIfOwned($kind, $id, $actorUsername, $now)
                : ($operation === 'handoff'
                    ? $this->repository->handoffIfOwned($kind, $id, $actorUsername, $target['username'], $now)
                    : $this->repository->takeoverIfClaimed($kind, $id, $actorUsername, $now));
            if (!$updated) {
                $transaction->commit();
                $this->expiry->notify($notification);
                return $this->result(409, ['error_code' => $operation === 'takeover' ? 'not_claimed' : 'not_claimed_by_you']);
            }
            $eventType = ['release' => 'released', 'handoff' => 'handed_off', 'takeover' => 'taken_over'][$operation];
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

    private function result($status, array $body)
    {
        return ['status' => $status, 'body' => $body];
    }
}
