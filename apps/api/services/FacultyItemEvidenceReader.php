<?php

namespace app\services;

use yii\db\Query;

/**
 * Plain advisory reads for faculty item locks; H supplies its own current reads of these values.
 */
class FacultyItemEvidenceReader
{
    public function forItems(array $idsByKind)
    {
        $newIds = $idsByKind['new'] ?? [];
        $reuseIds = $idsByKind['reuse'] ?? [];
        if (!$newIds && !$reuseIds) {
            return [];
        }

        $evidence = [];
        foreach (['new' => $newIds, 'reuse' => $reuseIds] as $kind => $ids) {
            if ($ids) {
                $evidence[$kind] = array_fill_keys($ids, [
                    'open_run' => false,
                    'publication_history' => false,
                    'published' => false,
                    'open_review' => false,
                ]);
            }
        }

        $itemCondition = ['or',
            ['item_kind' => 'new', 'item_id' => $newIds],
            ['item_kind' => 'reuse', 'item_id' => $reuseIds],
        ];
        $openRuns = (new Query())
            ->select(['item_kind', 'item_id'])
            ->from('item_flow_runs')
            ->where(['and', ['closed_at' => null], $itemCondition])
            ->all();
        foreach ($openRuns as $row) {
            $evidence[$row['item_kind']][$row['item_id']]['open_run'] = true;
        }

        $attachments = (new Query())
            ->select([
                'item_kind' => 'a.item_kind',
                'item_id' => 'a.item_id',
                'live' => 'a.live',
                'retired_at' => 'd.retired_at',
                'course_resource_id' => 'd.course_resource_id',
                'physical_reference_id' => 'd.physical_reference_id',
            ])
            ->from(['a' => 'publication_attachments'])
            ->innerJoin(['d' => 'publication_destinations'], 'd.id = a.destination_id')
            ->where(['or',
                ['a.item_kind' => 'new', 'a.item_id' => $newIds],
                ['a.item_kind' => 'reuse', 'a.item_id' => $reuseIds],
            ])
            ->all();
        foreach ($attachments as $row) {
            $evidence[$row['item_kind']][$row['item_id']]['publication_history'] = true;
            if ((int)$row['live'] === 1 && self::hasCurrentPointer($row)) {
                $evidence[$row['item_kind']][$row['item_id']]['published'] = true;
            }
        }

        $owners = (new Query())
            ->select([
                'owner_item_kind', 'owner_item_id', 'owner_live', 'retired_at',
                'course_resource_id', 'physical_reference_id',
            ])
            ->from('publication_destinations')
            ->where(['or',
                ['owner_item_kind' => 'new', 'owner_item_id' => $newIds],
                ['owner_item_kind' => 'reuse', 'owner_item_id' => $reuseIds],
            ])
            ->all();
        foreach ($owners as $row) {
            $evidence[$row['owner_item_kind']][$row['owner_item_id']]['publication_history'] = true;
            if ((int)$row['owner_live'] === 1 && self::hasCurrentPointer($row)) {
                $evidence[$row['owner_item_kind']][$row['owner_item_id']]['published'] = true;
            }
        }

        $openReviews = (new Query())
            ->select('item_id')
            ->from('item_history_review')
            ->where(['and', ['item_id' => $newIds], ['reviewed_at' => null]])
            ->indexBy('item_id')
            ->column();
        foreach ($openReviews as $itemId) {
            $evidence['new'][$itemId]['open_review'] = true;
        }

        return $evidence;
    }

    private static function hasCurrentPointer(array $row)
    {
        return $row['retired_at'] === null
            && ($row['course_resource_id'] !== null || $row['physical_reference_id'] !== null);
    }
}
