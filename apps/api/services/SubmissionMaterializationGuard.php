<?php

namespace app\services;

class SubmissionMaterializationGuard
{
    private $snapshotFields = [
        'resource_data',
        'display_order',
        'folder_name',
        'position_in_folder',
        'faculty_notes',
        'source_barcode',
        'source_call_number',
    ];

    public function changedMaterializedItemIds(array $existingItems, array $incomingItems, array $folderUuidToNameMap)
    {
        $incomingItemsById = [];
        foreach ($incomingItems as $incomingItem) {
            if (!is_array($incomingItem)) {
                continue;
            }

            $itemId = $incomingItem['item_uuid'] ?? $incomingItem['id'] ?? null;
            if ($itemId !== null) {
                $incomingItemsById[(string)$itemId][] = $incomingItem;
            }
        }

        $changedItemIds = [];
        foreach ($existingItems as $existingItem) {
            if (!is_array($existingItem) || !SubmissionItemMaterializationService::isMaterialized($existingItem)) {
                continue;
            }

            $itemId = $existingItem['id'] ?? null;
            if ($itemId === null) {
                continue;
            }

            $itemKey = (string)$itemId;
            if (!array_key_exists($itemKey, $incomingItemsById)) {
                $changedItemIds[] = (int)$itemId;
                continue;
            }

            $persisted = $this->persistedSnapshot($existingItem);
            foreach ($incomingItemsById[$itemKey] as $incomingItem) {
                $expected = $this->incomingSnapshot($existingItem, $incomingItem, $folderUuidToNameMap);
                if ($persisted !== $expected) {
                    $changedItemIds[] = (int)$itemId;
                    break;
                }
            }
        }

        sort($changedItemIds, SORT_NUMERIC);
        return $changedItemIds;
    }

    public function incomingItemsAfterFolderUpdate(array $existingItems, array $foldersData)
    {
        $folderNames = [];
        foreach ($foldersData as $folderData) {
            if (!is_array($folderData)) {
                continue;
            }

            $folderName = $folderData['folder_name'] ?? $folderData['name'] ?? null;
            if ($folderName) {
                $folderNames[(string)$folderName] = true;
            }
        }

        $incomingItems = [];
        foreach ($existingItems as $existingItem) {
            if (!is_array($existingItem) || !array_key_exists('id', $existingItem)) {
                continue;
            }

            $snapshot = $this->persistedSnapshot($existingItem);
            if ($snapshot['folder_name'] !== null && !isset($folderNames[(string)$snapshot['folder_name']])) {
                $snapshot['folder_name'] = null;
                $snapshot['position_in_folder'] = null;
            }

            $incomingItems[] = [
                'item_uuid' => $existingItem['id'],
                '__snapshot' => $snapshot,
            ];
        }

        return $incomingItems;
    }

    public static function folderUuidToNameMap($foldersData)
    {
        $folderUuidToNameMap = [];
        if (!is_array($foldersData)) {
            return $folderUuidToNameMap;
        }

        foreach ($foldersData as $folderData) {
            if (!is_array($folderData)) {
                continue;
            }

            $folderName = $folderData['folder_name'] ?? $folderData['name'] ?? null;
            $folderUuid = $folderData['folder_uuid'] ?? $folderData['id'] ?? null;
            if (!$folderName) {
                continue;
            }

            if ($folderUuid) {
                $folderUuidToNameMap[$folderUuid] = $folderName;
            }
        }

        return $folderUuidToNameMap;
    }

    public static function buildUpdatedResourceData(array $currentData, array $itemData): array
    {
        $nestedResourceData = $itemData['resource_data'] ?? [];
        if (!is_array($nestedResourceData)) {
            $nestedResourceData = [];
        }

        $resourceData = array_merge($currentData, $nestedResourceData);
        $fieldMap = [
            'title' => ['title'],
            'authors' => ['author', 'authors'],
            'materialType' => ['material_type', 'materialType'],
            'journal' => ['journal'],
            'publisher' => ['publisher'],
            'isbn' => ['isbn'],
            'url' => ['url'],
        ];

        foreach ($fieldMap as $resourceField => $payloadFields) {
            foreach ($payloadFields as $payloadField) {
                if (array_key_exists($payloadField, $itemData)) {
                    $resourceData[$resourceField] = $itemData[$payloadField];
                    break;
                }
            }
        }

        $resourceData['title'] = $resourceData['title'] ?? '';
        $resourceData['authors'] = $resourceData['authors'] ?? '';
        return $resourceData;
    }

    private function persistedSnapshot(array $item)
    {
        return $this->normalizeSnapshot([
            'resource_data' => $this->decodeResourceData($item['resource_data'] ?? null),
            'display_order' => $item['display_order'] ?? null,
            'folder_name' => $item['folder_name'] ?? null,
            'position_in_folder' => $item['position_in_folder'] ?? null,
            'faculty_notes' => $item['faculty_notes'] ?? null,
            'source_barcode' => $item['source_barcode'] ?? $item['barcode'] ?? null,
            'source_call_number' => $item['source_call_number'] ?? $item['call_number'] ?? null,
        ]);
    }

    private function incomingSnapshot(array $existingItem, array $incomingItem, array $folderUuidToNameMap)
    {
        if (isset($incomingItem['__snapshot']) && is_array($incomingItem['__snapshot'])) {
            return $this->normalizeSnapshot($incomingItem['__snapshot']);
        }

        $currentData = $this->decodeResourceData($existingItem['resource_data'] ?? null);
        return $this->normalizeSnapshot([
            'resource_data' => self::buildUpdatedResourceData($currentData, $incomingItem),
            'display_order' => isset($incomingItem['display_order'])
                ? $incomingItem['display_order']
                : ($existingItem['display_order'] ?? null),
            'folder_name' => !empty($incomingItem['folder_uuid']) && isset($folderUuidToNameMap[$incomingItem['folder_uuid']])
                ? $folderUuidToNameMap[$incomingItem['folder_uuid']]
                : null,
            'position_in_folder' => $incomingItem['position_in_folder'] ?? null,
            'faculty_notes' => isset($incomingItem['faculty_notes'])
                ? $incomingItem['faculty_notes']
                : ($existingItem['faculty_notes'] ?? null),
            'source_barcode' => isset($incomingItem['barcode'])
                ? $incomingItem['barcode']
                : ($existingItem['source_barcode'] ?? $existingItem['barcode'] ?? null),
            'source_call_number' => isset($incomingItem['call_number'])
                ? $incomingItem['call_number']
                : ($existingItem['source_call_number'] ?? $existingItem['call_number'] ?? null),
        ]);
    }

    private function normalizeSnapshot(array $snapshot)
    {
        $normalized = [];
        foreach ($this->snapshotFields as $field) {
            $value = $snapshot[$field] ?? null;
            $normalized[$field] = $field === 'resource_data' ? $this->normalizeJson($value) : $value;
            if (in_array($field, ['display_order', 'position_in_folder'], true)
                && (is_int($value) || (is_string($value) && preg_match('/^-?\d+$/', $value)))) {
                $normalized[$field] = (int)$value;
            }
        }

        return $normalized;
    }

    private function decodeResourceData($resourceData)
    {
        if (is_array($resourceData)) {
            return $resourceData;
        }

        $decoded = json_decode((string)$resourceData, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeJson($value, $key = null)
    {
        if (is_array($value)) {
            foreach ($value as $childKey => $childValue) {
                $value[$childKey] = $this->normalizeJson($childValue, $childKey);
            }

            if (array_keys($value) !== range(0, count($value) - 1)) {
                ksort($value);
            }
        } elseif ($key !== null && $this->isIdKey($key) && is_scalar($value)) {
            $value = (string)$value;
        }

        return $value;
    }

    private function isIdKey($key)
    {
        $key = (string)$key;
        return $key === 'id' || preg_match('/(?:_id|Id|ID)$/', $key) === 1;
    }
}
