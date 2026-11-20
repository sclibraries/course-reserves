<?php

namespace app\services;

use Yii;
use app\models\FacultySubmission;

/** Provides claim history and submission detail reads through the shared linked-item boundary. */
class ItemClaimReadService
{
    use ServiceResult;

    private $linkedItems;
    private $eventLog;
    private $repository;
    private $itemLock;
    private $expiry;
    private $presenter;

    public function __construct($linkedItems, $eventLog, $repository, $expiry, $presenter)
    {
        $this->linkedItems = $linkedItems;
        $this->eventLog = $eventLog;
        $this->repository = $repository;
        $this->itemLock = new ItemWriteLock($repository);
        $this->expiry = $expiry;
        $this->presenter = $presenter;
    }

    public function timeline($kind, $id)
    {
        return $this->linkedItems->withLinkedItem($kind, $id, function () use ($kind, $id) {
            return $this->result(200, ['items' => $this->eventLog->itemTimeline($kind, $id)]);
        });
    }

    public function claimsForSubmission($submissionId)
    {
        return Transactional::retrying(function () use ($submissionId) {
            $submissionId = (int)$submissionId;
            Yii::$app->db->createCommand(
                'SELECT submission_id FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
                [':id' => $submissionId]
            )->queryScalar();

            $items = [];
            foreach ($this->repository->itemRefsBySubmission($submissionId) as $reference) {
                $locked = $this->itemLock->lock($reference['kind'], $reference['id']);
                if ($locked['missing'] !== null || (int)$locked['submission_id'] !== $submissionId) {
                    continue;
                }
                $item = $locked['item']->getAttributes();
                $submission = $locked['submission'];
                $items[$reference['kind']][(int)$item['id']] = [
                    'id' => (int)$item['id'],
                    'submission_id' => $submissionId,
                    'claimed_by' => $item['claimed_by'],
                    'claimed_at' => $item['claimed_at'],
                    'last_activity_at' => $item['last_activity_at'],
                    'assigned_group_id' => $item['assigned_group_id'],
                    'status' => $item['item_status'],
                    'eligible' => $submission->link_state === 'linked'
                        && $submission->status !== FacultySubmission::STATUS_DRAFT,
                ];
            }

            $now = $this->expiry->now();
            foreach ($items as $kind => &$rows) {
                foreach ($rows as &$item) {
                    if (!$item['eligible']) {
                        continue;
                    }
                    $notification = $this->expiry->expireLocked($kind, $item, $now);
                    if ($notification) {
                        $item['claimed_by'] = null;
                        $item['claimed_at'] = null;
                        $item['last_activity_at'] = $now;
                        Yii::$app->get('workflowNotificationQueue')->enqueue(function () use ($notification) {
                            $this->expiry->notify($notification);
                        });
                    }
                }
                unset($item);
            }
            unset($rows);

            // Locked rows own claim state; these two reads add batched display and group names.
            $displayRows = $this->repository->claimsBySubmission($submissionId);
            $claims = ['new' => [], 'reuse' => []];
            foreach ($items as $kind => $rows) {
                foreach ($rows as $id => $item) {
                    $projection = $displayRows[$kind][$id] ?? [];
                    $item['claimed_by_display'] = $projection['claimed_by_display'] ?? null;
                    $item['assigned_group_name'] = $projection['assigned_group_name'] ?? null;
                    $claims[$kind][$id] = $this->presenter->claimFields($item, $this->expiry->hours());
                }
            }
            return $claims;
        });
    }
}
