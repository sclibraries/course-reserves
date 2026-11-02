<?php

namespace app\services;

use Yii;

/** Serializes destination writes in the API-116 lock order. */
class PublicationDestinationLock
{
    private $selectForUpdate;

    private const LOCKS = [
        ['offering_ids', 'course_offerings', 'offering_id'],
        ['resource_ids', 'resources', 'resource_id'],
        ['course_resource_ids', 'course_resources', 'course_resource_id'],
        ['physical_reference_ids', 'physical_resource_references', 'reference_id'],
        ['destination_ids', 'publication_destinations', 'id'],
        ['submission_ids', 'faculty_submissions', 'submission_id'],
        ['new_item_ids', 'submission_new_resources', 'id'],
        ['reuse_item_ids', 'submission_reuse_resources', 'id'],
        ['publication_state_items', 'submission_publication_state', 'item_id'],
        ['attachment_ids', 'publication_attachments', 'id'],
    ];

    public function __construct(?callable $selectForUpdate = null)
    {
        $this->selectForUpdate = $selectForUpdate;
    }

    public function lock(array $affectedIds)
    {
        foreach (self::LOCKS as list($input, $table, $column)) {
            $values = $this->ids($affectedIds[$input] ?? []);
            if (!$values) {
                continue;
            }
            if ($this->selectForUpdate !== null) {
                call_user_func($this->selectForUpdate, $table, $values);
            } elseif ($input === 'publication_state_items') {
                $this->lockPublicationState($affectedIds[$input]);
            } else {
                $this->lockRows($table, $column, $values);
            }
        }
    }

    private function ids(array $values)
    {
        $ids = [];
        foreach ($values as $value) {
            $id = is_array($value) ? ($value['id'] ?? null) : $value;
            if (is_numeric($id) && (int)$id > 0) {
                $ids[] = (int)$id;
            }
        }
        $ids = array_values(array_unique($ids));
        sort($ids, SORT_NUMERIC);
        return $ids;
    }

    private function lockRows($table, $column, array $ids)
    {
        $params = [];
        $slots = [];
        foreach ($ids as $index => $id) {
            $slot = ':id' . $index;
            $slots[] = $slot;
            $params[$slot] = $id;
        }
        Yii::$app->db->createCommand(
            'SELECT `' . $column . '` FROM `' . $table . '` WHERE `' . $column . '` IN ('
            . implode(',', $slots) . ') ORDER BY `' . $column . '` FOR UPDATE',
            $params
        )->queryColumn();
    }

    private function lockPublicationState(array $items)
    {
        $clauses = [];
        $params = [];
        foreach ($items as $index => $item) {
            if (!is_array($item) || !in_array($item['kind'] ?? null, ['new', 'reuse'], true)) {
                continue;
            }
            $clauses[] = '(item_kind = :kind' . $index . ' AND item_id = :item' . $index . ')';
            $params[':kind' . $index] = $item['kind'];
            $params[':item' . $index] = (int)$item['id'];
        }
        if ($clauses) {
            Yii::$app->db->createCommand(
                'SELECT item_id FROM submission_publication_state WHERE ' . implode(' OR ', $clauses)
                . " ORDER BY FIELD(item_kind, 'new', 'reuse'), item_id FOR UPDATE",
                $params
            )->queryAll();
        }
    }
}
