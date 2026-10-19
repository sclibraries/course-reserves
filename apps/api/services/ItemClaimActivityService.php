<?php

namespace app\services;

use Yii;

/** Renews claim activity from the legacy item-write paths. */
class ItemClaimActivityService
{
    private $repository;
    private $eventLog;
    private $expiry;

    public function __construct($repository, $eventLog, $expiry)
    {
        $this->repository = $repository;
        $this->eventLog = $eventLog;
        $this->expiry = $expiry;
    }

    public function recordActivity($kind, $id)
    {
        $notification = null;
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $item = $this->repository->find($kind, $id, true);
            if ($item && $item['link_state'] === 'linked') {
                $now = $this->expiry->now();
                $notification = $this->expiry->expireLocked($kind, $item, $now);
                if (!$notification) {
                    $this->repository->touchActivity($kind, $id, $now);
                }
            }
            $transaction->commit();
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
        $this->expiry->notify($notification);
    }

    public function completeLegacyChecklistItem($kind, $id, array $actor)
    {
        $transaction = Yii::$app->db->getTransaction();
        $ownsTransaction = !$transaction || !$transaction->isActive;
        if ($ownsTransaction) {
            $transaction = Yii::$app->db->beginTransaction();
        }
        $notification = null;
        try {
            $item = $this->repository->find($kind, $id, true);
            if ($item && $item['link_state'] === 'linked') {
                $now = $this->expiry->now();
                $notification = $this->expiry->expireLocked($kind, $item, $now);
                if (!$notification) {
                    $before = $this->snapshot($item);
                    $this->repository->clearClaimForChecklistCompletion($kind, $id, $now);
                    if (!empty($item['claimed_by'])) {
                        $after = $before;
                        $after['claimed_by'] = null;
                        $after['claimed_at'] = null;
                        $after['last_activity_at'] = $now;
                        $this->eventLog->record(
                            $item['submission_id'], $id, $actor, 'released', 'Checklist completed', $before, $after, $kind
                        );
                    }
                }
            }
            if ($ownsTransaction) {
                $transaction->commit();
            }
        } catch (\Throwable $exception) {
            if ($ownsTransaction && $transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
        $this->expiry->notify($notification);
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
