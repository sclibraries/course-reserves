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

    public static function hours()
    {
        return max(1, (int)(Yii::$app->params['workflowClaimExpiryHours'] ?? 72));
    }

    public function expireLocked($kind, array $item, $now)
    {
        if (!self::isDue($item, $now)) {
            return null;
        }
        $nowTimestamp = strtotime($now);
        $cutoff = date('Y-m-d H:i:s', $nowTimestamp - (self::hours() * 3600));
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

    public function expiredClaimCandidates()
    {
        $now = $this->now();
        $cutoff = date('Y-m-d H:i:s', strtotime($now) - (self::hours() * 3600));
        return $this->repository->expiredClaimCandidates($cutoff);
    }

    public function expireCandidate(array $reference, $linkedItems)
    {
        $claimBefore = null;
        $result = $linkedItems->withLinkedItem(
            $reference['kind'],
            $reference['id'],
            function ($item, $transaction, $now) use (&$claimBefore) {
                return !empty($claimBefore['claimed_by'])
                    && self::isDue($claimBefore, $now)
                    && empty($item['claimed_by']);
            },
            function () use (&$claimBefore, $reference) {
                $claimBefore = $this->repository->lockedClaimState($reference['kind'], $reference['id']);
            }
        );
        return $result === true;
    }

    public function expireDueClaims($linkedItems)
    {
        $expired = 0;
        foreach ($this->expiredClaimCandidates() as $reference) {
            $expired += $this->expireCandidate($reference, $linkedItems) ? 1 : 0;
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

    public static function isDue(array $item, $now)
    {
        if (empty($item['claimed_by'])) {
            return false;
        }
        $lastActivity = $item['last_activity_at'] ?: $item['claimed_at'];
        $lastTimestamp = $lastActivity ? strtotime($lastActivity) : false;
        $nowTimestamp = strtotime($now);
        return $lastTimestamp !== false && $nowTimestamp !== false
            && $lastTimestamp + (self::hours() * 3600) <= $nowTimestamp;
    }
}
