<?php

namespace app\services;

use yii\db\Connection;
use yii\db\Expression;
use yii\db\Query;

/** Backfills faculty locks from durable staff-processing evidence. */
class FacultyLockLatchBackfill
{
    const BATCH_SIZE = 100;

    private $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    public function backfill($timestamp)
    {
        foreach ([
            'new' => 'submission_new_resources',
            'reuse' => 'submission_reuse_resources',
        ] as $kind => $table) {
            $query = (new Query())->select([
                'id', 'submission_id', 'item_status', 'materialized_resource_id',
                'materialized_course_resource_id', 'materialized_physical_reference_id',
                'materialized_folder_id', 'materialized_by_staff_id', 'materialized_at',
            ])->from($table)->where(['locked_for_faculty_at' => null]);
            foreach (self::keysetBatches($this->db, $query) as $items) {
                $this->backfillBatch($kind, $table, $items, $timestamp);
            }
        }
    }

    public static function keysetBatches(Connection $db, Query $query, $idColumn = 'id')
    {
        $lastId = 0;
        do {
            $batch = (clone $query)->andWhere(['>', $idColumn, $lastId])
                ->orderBy([$idColumn => SORT_ASC])->limit(self::BATCH_SIZE)->all($db);
            if (!$batch) {
                break;
            }
            $lastId = (int)end($batch)['id'];
            yield $batch;
        } while (count($batch) === self::BATCH_SIZE);
    }

    private function backfillBatch($kind, $table, array $items, $timestamp)
    {
        $ids = array_map('intval', array_column($items, 'id'));
        $itemsById = [];
        foreach ($items as $item) {
            $itemsById[(int)$item['id']] = $item;
        }
        $evidence = [];
        $this->addRunEvidence($evidence, $kind, $ids);
        $this->addEventEvidence($evidence, $kind, $itemsById);

        if ($kind === 'new') {
            $completedIds = (new Query())->select('submission_item_id')->from('item_checklists')
                ->where(['submission_item_id' => $ids])->andWhere(['not', ['completed_at' => null]])
                ->column($this->db);
            foreach ($completedIds as $id) {
                $evidence[$this->key($kind, $id)] = true;
            }
        }

        foreach ((new Query())->select('item_id')->from('submission_publication_state')
            ->where(['item_kind' => $kind, 'item_id' => $ids])->andWhere(['not', ['published_revision' => null]])
            ->column($this->db) as $id) {
            $evidence[$this->key($kind, $id)] = true;
        }

        $lockedIds = [];
        foreach ($items as $item) {
            if (in_array($item['item_status'], ['complete', 'completed'], true)
                || SubmissionItemMaterializationService::isMaterialized($item)
                || isset($evidence[$this->key($kind, $item['id'])])) {
                $lockedIds[] = (int)$item['id'];
            }
        }
        if ($lockedIds) {
            $columns = ['locked_for_faculty_at' => $timestamp];
            if ($this->db->schema->getTableSchema($table, true)->getColumn('updated_at')) {
                $columns['updated_at'] = new Expression('[[updated_at]]');
            }
            $this->db->createCommand()->update(
                $table, $columns, ['id' => $lockedIds, 'locked_for_faculty_at' => null]
            )->execute();
        }
    }

    private function addRunEvidence(array &$evidence, $kind, array $ids)
    {
        $query = (new Query())->select([
            'id', 'item_id', 'closed_at', 'current_step_key', 'finish_state',
        ])->from('item_flow_runs')->where(['item_kind' => $kind, 'item_id' => $ids]);
        foreach (self::keysetBatches($this->db, $query) as $runs) {
            foreach ($runs as $run) {
                if (PublicationPolicy::isReadyRun($run)) {
                    $evidence[$this->key($kind, $run['item_id'])] = true;
                }
            }
        }
    }

    private function addEventEvidence(array &$evidence, $kind, array $itemsById)
    {
        foreach ($this->matchingEvents($kind, $itemsById) as $matching) {
            $event = $matching['event'];
            if ($event['event_type'] === 'item_marked_ready'
                || ($event['event_type'] === 'released' && $event['reason'] === 'Checklist completed')
                || $this->hasFinishedStatus($matching['before'])
                || $this->hasFinishedStatus($matching['after'])) {
                $evidence[$this->key($kind, $event['item_id'])] = true;
            }
        }
    }

    public function matchingEvents($kind, array $itemsById)
    {
        $ids = array_map('intval', array_keys($itemsById));
        $query = (new Query())->select([
            'id', 'item_id', 'submission_id', 'item_kind', 'event_type', 'reason', 'before_json', 'after_json',
        ])->from('workflow_events')->where(['item_id' => $ids]);
        foreach (self::keysetBatches($this->db, $query) as $events) {
            foreach ($events as $event) {
                $item = $itemsById[(int)$event['item_id']] ?? null;
                if ($item && $this->eventMatchesItem($event, $kind, $item)) {
                    yield [
                        'event' => $event,
                        'before' => json_decode($event['before_json'], true),
                        'after' => json_decode($event['after_json'], true),
                    ];
                }
            }
        }
    }

    private function eventMatchesItem(array $event, $kind, array $item)
    {
        if ((int)$event['item_id'] !== (int)$item['id']) {
            return false;
        }
        if ($event['item_kind'] !== null) {
            return $event['item_kind'] === $kind;
        }
        return $kind === 'new' && (int)$event['submission_id'] === (int)$item['submission_id'];
    }

    private function hasFinishedStatus($snapshot)
    {
        return is_array($snapshot) && in_array($snapshot['status'] ?? null, ['complete', 'completed'], true);
    }

    private function key($kind, $id)
    {
        return $kind . ':' . (int)$id;
    }
}
