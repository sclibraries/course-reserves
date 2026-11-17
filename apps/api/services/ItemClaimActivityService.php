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

    public function recordActivity($kind, array $item)
    {
        $notification = null;
        if ($item['link_state'] === 'linked') {
            $now = $this->expiry->now();
            $notification = $this->expiry->expireLocked($kind, $item, $now);
            if (!$notification) {
                $this->repository->touchActivity($kind, $item['id'], $now);
            }
        }
        $this->queueNotification($notification);
    }

    public function completeLegacyChecklistItem($kind, array $item, array $actor)
    {
        $notification = null;
        if ($item['link_state'] === 'linked') {
            $now = $this->expiry->now();
            $notification = $this->expiry->expireLocked($kind, $item, $now);
            if (!$notification) {
                $before = $this->snapshot($item);
                $affected = $this->repository->clearClaimForChecklistCompletion($kind, $item['id'], $now);
                if ($affected === false || (!empty($item['claimed_by']) && (int)$affected < 1)) {
                    throw new \RuntimeException('Failed to release claim for checklist completion.');
                }
                if (!empty($item['claimed_by'])) {
                    $after = $before;
                    $after['claimed_by'] = null;
                    $after['claimed_at'] = null;
                    $after['last_activity_at'] = $now;
                    $this->eventLog->record(
                        $item['submission_id'], $item['id'], $actor, 'released', 'Checklist completed', $before, $after, $kind
                    );
                }
            }
        }
        $this->queueNotification($notification);
    }

    private function queueNotification($notification)
    {
        if ($notification) {
            Yii::$app->get('workflowNotificationQueue')->enqueue(function () use ($notification) {
                $this->expiry->notify($notification);
            });
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
