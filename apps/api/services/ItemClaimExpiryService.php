<?php

namespace app\services;

use Yii;

/** Applies the shared 72-hour inactivity rule for scheduled and lazy expiry. */
class ItemClaimExpiryService
{
    private $repository;
    private $eventLog;
    private $nowProvider;
    private $notifier;

    public function __construct($repository, $eventLog, $nowProvider, $notifier)
    {
        $this->repository = $repository;
        $this->eventLog = $eventLog;
        $this->nowProvider = $nowProvider;
        $this->notifier = $notifier;
    }

    public function now()
    {
        return call_user_func($this->nowProvider);
    }

    public function hours()
    {
        return max(1, (int)(Yii::$app->params['workflowClaimExpiryHours'] ?? 72));
    }

    public function expireLocked($kind, array $item, $now)
    {
        if (empty($item['claimed_by'])) {
            return null;
        }
        $lastActivity = $item['last_activity_at'] ?: $item['claimed_at'];
        $lastTimestamp = $lastActivity ? strtotime($lastActivity) : false;
        $nowTimestamp = strtotime($now);
        if ($lastTimestamp === false || $nowTimestamp === false
            || $lastTimestamp + ($this->hours() * 3600) > $nowTimestamp) {
            return null;
        }

        $cutoff = date('Y-m-d H:i:s', $nowTimestamp - ($this->hours() * 3600));
        if (!$this->repository->expireIfDue($kind, $item['id'], $item['claimed_by'], $cutoff, $now)) {
            return null;
        }
        $before = $this->snapshot($item);
        $after = $before;
        $after['claimed_by'] = null;
        $after['claimed_at'] = null;
        $after['last_activity_at'] = $now;
        $actor = ['username' => 'workflow/expire-claims', 'role' => 'system'];
        $this->eventLog->record(
            $item['submission_id'],
            $item['id'],
            $actor,
            'claim_expired',
            null,
            $before,
            $after,
            $kind
        );
        return [
            'event_type' => 'claim_expired',
            'context' => [
                'item_kind' => $kind,
                'item_id' => (int)$item['id'],
                'submission_id' => (int)$item['submission_id'],
                'previous_holder' => $item['claimed_by'],
            ],
        ];
    }

    public function expireDueClaims()
    {
        $now = $this->now();
        $nowTimestamp = strtotime($now);
        $cutoff = date('Y-m-d H:i:s', $nowTimestamp - ($this->hours() * 3600));
        $expired = 0;
        foreach ($this->repository->expiredClaimCandidates($cutoff) as $reference) {
            $transaction = Yii::$app->db->beginTransaction();
            try {
                $item = $this->repository->find($reference['kind'], $reference['id'], true);
                $notification = $item ? $this->expireLocked($reference['kind'], $item, $now) : null;
                $transaction->commit();
                if ($notification) {
                    $expired++;
                    $this->notify($notification);
                }
            } catch (\Throwable $exception) {
                if ($transaction->isActive) {
                    $transaction->rollBack();
                }
                throw $exception;
            }
        }
        return $expired;
    }

    public function notify($notification)
    {
        if ($notification) {
            $this->notifier->notify($notification['event_type'], $notification['context']);
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
}
