<?php

namespace app\services;

use yii\db\Query;

/** Loads and represents faculty submission items with a fixed number of queries. */
class FacultySubmissionItemsReader
{
    public function forSubmissions(array $submissions, $now): array
    {
        if (!$submissions) {
            return [];
        }

        $submissionIds = array_map(function ($submission) {
            return $submission->submission_id;
        }, $submissions);
        $folders = (new Query())
            ->select(['folder_id', 'submission_id', 'folder_name', 'display_order'])
            ->from('submission_folders')
            ->where(['submission_id' => $submissionIds])
            ->indexBy('folder_id')
            ->all();
        $items = [
            'new' => $this->items('new', $submissionIds),
            'reuse' => $this->items('reuse', $submissionIds),
        ];
        $evidence = (new FacultyItemEvidenceReader())->forItems([
            'new' => array_keys($items['new']),
            'reuse' => array_keys($items['reuse']),
        ]);

        $foldersBySubmission = [];
        foreach ($folders as $folder) {
            $foldersBySubmission[$folder['submission_id']][] = $folder;
        }
        $itemsBySubmission = array_fill_keys($submissionIds, ['new' => [], 'reuse' => []]);
        foreach ($items as $kind => $rows) {
            foreach ($rows as $row) {
                $itemsBySubmission[$row['submission_id']][$kind][] = $row;
            }
        }

        $representation = new FacultyItemRepresentation($now);
        $result = [];
        foreach ($submissions as $submission) {
            $id = (int)$submission->submission_id;
            $result[$id] = $representation->represent(
                $submission,
                $foldersBySubmission[$id] ?? [],
                $itemsBySubmission[$id],
                $evidence
            );
        }
        return $result;
    }

    private function items($kind, array $submissionIds): array
    {
        $sourceId = $kind === 'new'
            ? SourceResourceId::sqlValue('i.source_resource_id')
            : 'i.source_resource_id';
        $columns = [
            'id' => 'i.id',
            'submission_id' => 'i.submission_id',
            'staff_material_type_id' => 'i.staff_material_type_id',
            'source_resource_id' => 'i.source_resource_id',
            'source_folio_instance_id' => 'i.source_folio_instance_id',
            'source_folio_holdings_id' => 'i.source_folio_holdings_id',
            'display_order' => 'i.display_order',
            'folder_name' => 'i.folder_name',
            'faculty_notes' => 'i.faculty_notes',
            'assigned_pages' => 'i.assigned_pages',
            'item_status' => 'i.item_status',
            'position_in_folder' => 'i.position_in_folder',
            'claimed_by' => 'i.claimed_by',
            'claimed_at' => 'i.claimed_at',
            'last_activity_at' => 'i.last_activity_at',
            'assigned_group_id' => 'i.assigned_group_id',
            'locked_for_faculty_at' => 'i.locked_for_faculty_at',
        ];
        $columns += $kind === 'new'
            ? [
                'is_reuse' => 'i.is_reuse',
                'source_barcode' => 'i.source_barcode',
                'source_call_number' => 'i.source_call_number',
                'resource_data' => 'i.resource_data',
            ]
            : ['barcode' => 'i.barcode', 'call_number' => 'i.call_number'];

        return (new Query())
            ->select($columns + ['material_type_name' => 'mt.name', 'source_resource_name' => 'source.name'])
            ->from(['i' => 'submission_' . $kind . '_resources'])
            ->leftJoin(['source' => 'resources'], 'source.resource_id = ' . $sourceId)
            ->leftJoin(['mt' => 'material_types'], 'mt.material_type_id = ' . EffectiveMaterialType::sql('i', 'source'))
            ->where(['i.submission_id' => $submissionIds])
            ->indexBy('id')
            ->all();
    }
}
