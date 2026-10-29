<?php

namespace app\services;

use app\models\MaterialTypes;
use app\models\SubmissionNewResource;

/** Updates faculty-editable submission items without exposing staff-only fields. */
class FacultySubmissionItemUpdateService
{
    private $publication;

    public function __construct($publication = null)
    {
        $this->publication = $publication ?: new SubmissionPublicationStateService();
    }

    public function updateItems($submission, $itemsData, array $folderUuidToNameMap = [], ?array $lockedItems = null)
    {
        $existingItems = $lockedItems !== null ? $lockedItems : SubmissionNewResource::find()
            ->where(['submission_id' => $submission->submission_id])->indexBy('id')->all();
        $processedItemIds = [];

        foreach ($itemsData as $itemData) {
            $itemId = $itemData['item_uuid'] ?? $itemData['id'] ?? null;
            $folderUuid = $itemData['folder_uuid'] ?? null;
            $folderName = $folderUuid && isset($folderUuidToNameMap[$folderUuid])
                ? $folderUuidToNameMap[$folderUuid]
                : null;

            if ($itemId && isset($existingItems[$itemId])) {
                $item = $existingItems[$itemId];
                $before = PublicationDraftSnapshot::fromNewItem($item->getAttributes());
                if (isset($itemData['display_order'])) {
                    $item->display_order = $itemData['display_order'];
                }
                $item->folder_name = $folderName;
                $item->position_in_folder = $itemData['position_in_folder'] ?? null;
                if (isset($itemData['faculty_notes'])) {
                    $item->faculty_notes = $itemData['faculty_notes'];
                }
                if (array_key_exists('assignedPages', $itemData) || array_key_exists('assigned_pages', $itemData)) {
                    $item->assigned_pages = array_key_exists('assignedPages', $itemData)
                        ? $itemData['assignedPages']
                        : $itemData['assigned_pages'];
                }

                $currentData = json_decode($item->resource_data, true) ?? [];
                $item->resource_data = json_encode($this->updatedResourceData($currentData, $itemData));
                $updatedData = json_decode($item->resource_data, true) ?: [];
                $item->material_type_id = $this->materialTypeId($updatedData['materialType'] ?? null);
                if (isset($itemData['barcode'])) {
                    $item->source_barcode = $itemData['barcode'];
                    $item->is_reuse = 1;
                }
                if (isset($itemData['call_number'])) {
                    $item->source_call_number = $itemData['call_number'];
                }
                $item->save();
                if ($before !== PublicationDraftSnapshot::fromNewItem($item->getAttributes())) {
                    $this->publication->invalidateDraft('new', $item->id, $item->submission_id);
                }
                $processedItemIds[] = $itemId;
                continue;
            }

            $item = new SubmissionNewResource();
            $item->submission_id = $submission->submission_id;
            $hasBarcode = !empty($itemData['barcode']);
            $item->is_reuse = $hasBarcode ? 1 : 0;
            if ($hasBarcode) {
                $item->source_barcode = $itemData['barcode'];
                $item->source_call_number = $itemData['call_number'] ?? null;
            }
            $resourceData = $this->updatedResourceData([], $itemData);
            $item->material_type_id = $this->materialTypeId($resourceData['materialType'] ?? null);
            $item->resource_data = json_encode($resourceData);
            $item->display_order = $itemData['display_order'] ?? 999;
            $item->folder_name = $folderName;
            $item->position_in_folder = $itemData['position_in_folder'] ?? null;
            $item->faculty_notes = $itemData['faculty_notes'] ?? null;
            $item->assigned_pages = $itemData['assignedPages'] ?? $itemData['assigned_pages'] ?? null;
            $item->priority = $itemData['priority'] ?? 'medium';
            $item->item_status = 'pending';
            $item->save();
            $this->publication->lockForWrite('new', $item->id, $item->submission_id);
            $processedItemIds[] = $item->id;
        }

        foreach ($existingItems as $itemId => $item) {
            if (!in_array($itemId, $processedItemIds)) {
                $this->publication->remove('new', $itemId);
                $item->delete();
            }
        }
    }

    private function updatedResourceData(array $currentData, array $itemData): array
    {
        $updated = SubmissionMaterializationGuard::buildUpdatedResourceData($currentData, $itemData);
        return SubmissionPayloadService::normalizeResourceData($updated);
    }

    private function materialTypeId($name)
    {
        static $cache = [];
        if (isset($cache[$name])) {
            return $cache[$name];
        }

        $materialType = MaterialTypes::find()->where(['name' => $name])->one();
        if ($materialType) {
            $cache[$name] = $materialType->material_type_id;
            return $materialType->material_type_id;
        }

        return null;
    }
}
