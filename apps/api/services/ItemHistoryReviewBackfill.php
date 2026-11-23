<?php

namespace app\services;

use yii\db\Connection;
use yii\db\Query;

/** Flags submitted, unlatched new items for staff history review. */
class ItemHistoryReviewBackfill
{
    private $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    public function backfill($timestamp)
    {
        $query = (new Query())->select([
            'id' => 'i.id', 'submission_id' => 'i.submission_id', 'claimed_by_staff_id' => 'i.claimed_by_staff_id',
            'claimed_at' => 'i.claimed_at', 'claimed_by' => 'i.claimed_by',
        ])->from(['i' => 'submission_new_resources'])
            ->innerJoin(['s' => 'faculty_submissions'], 's.submission_id = i.submission_id')
            ->where(['i.locked_for_faculty_at' => null])
            ->andWhere(SubmittedSubmissionScope::sqlPredicate('s'));

        foreach (FacultyLockLatchBackfill::keysetBatches($this->db, $query, 'i.id') as $items) {
            $this->backfillBatch($items, $timestamp);
        }
    }

    private function backfillBatch(array $items, $timestamp)
    {
        $ids = array_map('intval', array_column($items, 'id'));
        $traces = array_fill_keys($ids, []);
        $checklistIds = array_fill_keys(array_map('intval', (new Query())->select('submission_item_id')
            ->from('item_checklists')->where(['submission_item_id' => $ids])->column($this->db)), true);

        foreach ($items as $item) {
            $id = (int)$item['id'];
            if (isset($checklistIds[$id])) {
                $traces[$id][] = 'checklist_row';
            }
            if (trim((string)$item['claimed_by_staff_id']) !== ''
                || ($item['claimed_at'] !== null && $item['claimed_by'] === null)) {
                $traces[$id][] = 'legacy_claim';
            }
        }

        $itemsById = [];
        foreach ($items as $item) {
            $itemsById[(int)$item['id']] = $item;
        }
        $hasStatusEvent = [];
        foreach ((new FacultyLockLatchBackfill($this->db))->matchingEvents('new', $itemsById) as $matching) {
            if ($this->hasStatus($matching['before']) || $this->hasStatus($matching['after'])) {
                $hasStatusEvent[(int)$matching['event']['item_id']] = true;
            }
        }
        foreach ($hasStatusEvent as $id => $_) {
            $traces[$id][] = 'status_event';
        }

        $existingIds = array_fill_keys(array_map('intval', (new Query())->select('item_id')
            ->from('item_history_review')->where(['item_id' => $ids])->column($this->db)), true);
        $rows = [];
        foreach ($items as $item) {
            $id = (int)$item['id'];
            if (!isset($existingIds[$id])) {
                $rows[] = [$id, (int)$item['submission_id'], implode(',', $traces[$id]) ?: 'none', $timestamp];
            }
        }
        if ($rows) {
            $this->db->createCommand()->batchInsert(
                'item_history_review', ['item_id', 'submission_id', 'trace', 'flagged_at'], $rows
            )->execute();
        }
    }

    private function hasStatus($snapshot)
    {
        return is_array($snapshot) && is_string($snapshot['status'] ?? null) && trim($snapshot['status']) !== '';
    }
}
