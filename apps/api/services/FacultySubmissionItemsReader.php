<?php

namespace app\services;

use app\models\FacultySubmission;
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
        $newItems = $this->newItems($submissionIds);
        $reuseItems = $this->reuseItems($submissionIds);

        $idsByKind = [];
        if ($newItems) {
            $idsByKind['new'] = array_map('intval', array_keys($newItems));
        }
        if ($reuseItems) {
            $idsByKind['reuse'] = array_map('intval', array_keys($reuseItems));
        }
        $evidence = (new FacultyItemEvidenceReader())->forItems($idsByKind);

        $foldersBySubmission = [];
        foreach ($folders as $folder) {
            $foldersBySubmission[$folder['submission_id']][] = $folder;
        }
        $itemsBySubmission = array_fill_keys($submissionIds, ['new' => [], 'reuse' => []]);
        foreach ($newItems as $row) {
            $itemsBySubmission[$row['submission_id']]['new'][] = $row;
        }
        foreach ($reuseItems as $row) {
            $itemsBySubmission[$row['submission_id']]['reuse'][] = $row;
        }

        $representation = new FacultyItemRepresentation($now);
        $result = [];
        foreach ($submissions as $submission) {
            $submissionId = (int)$submission->submission_id;
            $result[$submissionId] = $representation->represent(
                $submission,
                $foldersBySubmission[$submissionId] ?? [],
                $itemsBySubmission[$submissionId],
                $evidence
            );
        }
        return $result;
    }

    private function newItems(array $submissionIds): array
    {
        $effectiveType = EffectiveMaterialType::sql('i', 'source');
        return (new Query())
            ->select([
                'id' => 'i.id',
                'submission_id' => 'i.submission_id',
                'staff_material_type_id' => 'i.staff_material_type_id',
                'is_reuse' => 'i.is_reuse',
                'source_barcode' => 'i.source_barcode',
                'source_call_number' => 'i.source_call_number',
                'source_resource_id' => 'i.source_resource_id',
                'source_folio_instance_id' => 'i.source_folio_instance_id',
                'source_folio_holdings_id' => 'i.source_folio_holdings_id',
                'resource_data' => 'i.resource_data',
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
                'material_type_name' => 'mt.name',
                'source_resource_name' => 'source.name',
            ])
            ->from(['i' => 'submission_new_resources'])
            ->leftJoin(['source' => 'resources'], 'source.resource_id = ' . SourceResourceId::sqlValue('i.source_resource_id'))
            ->leftJoin(['mt' => 'material_types'], 'mt.material_type_id = ' . $effectiveType)
            ->where(['submission_id' => $submissionIds])
            ->indexBy('id')
            ->all();
    }

    private function reuseItems(array $submissionIds): array
    {
        $effectiveType = EffectiveMaterialType::sql('i', 'source');
        return (new Query())
            ->select([
                'id' => 'i.id',
                'submission_id' => 'i.submission_id',
                'staff_material_type_id' => 'i.staff_material_type_id',
                'source_resource_id' => 'i.source_resource_id',
                'source_folio_instance_id' => 'i.source_folio_instance_id',
                'source_folio_holdings_id' => 'i.source_folio_holdings_id',
                'barcode' => 'i.barcode',
                'call_number' => 'i.call_number',
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
                'material_type_name' => 'mt.name',
                'source_resource_name' => 'source.name',
            ])
            ->from(['i' => 'submission_reuse_resources'])
            ->leftJoin(['source' => 'resources'], 'source.resource_id = i.source_resource_id')
            ->leftJoin(['mt' => 'material_types'], 'mt.material_type_id = ' . $effectiveType)
            ->where(['submission_id' => $submissionIds])
            ->indexBy('id')
            ->all();
    }
}
