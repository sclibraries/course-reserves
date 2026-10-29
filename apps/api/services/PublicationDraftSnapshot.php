<?php

namespace app\services;

/** Selects the item fields that contribute to the pending student-facing projection. */
class PublicationDraftSnapshot
{
    public static function fromNewItem(array $item)
    {
        $resourceData = $item['resource_data'] ?? [];
        if (is_string($resourceData)) {
            $resourceData = json_decode($resourceData, true);
        }
        $resourceData = is_array($resourceData) ? $resourceData : [];
        unset($resourceData['notes'], $resourceData['faculty_notes'], $resourceData['internal_note'], $resourceData['staff_notes']);

        return self::sortKeys([
            'resource_data' => $resourceData,
            'material_type_id' => isset($item['material_type_id']) ? (int)$item['material_type_id'] : null,
            'is_reuse' => (int)($item['is_reuse'] ?? 0),
            'source_barcode' => $item['source_barcode'] ?? null,
            'source_call_number' => $item['source_call_number'] ?? null,
            'source_resource_id' => $item['source_resource_id'] ?? null,
            'source_folio_instance_id' => $item['source_folio_instance_id'] ?? null,
            'public_note' => $item['public_note'] ?? null,
            'assigned_pages' => $item['assigned_pages'] ?? null,
            'display_order' => isset($item['display_order']) ? (int)$item['display_order'] : null,
            'folder_name' => $item['folder_name'] ?? null,
            'position_in_folder' => isset($item['position_in_folder']) ? (int)$item['position_in_folder'] : null,
            'access_path' => $item['access_path'] ?? null,
        ]);
    }

    public static function changed(array $before, array $after)
    {
        return self::fromNewItem($before) !== self::fromNewItem($after);
    }

    private static function sortKeys(array $value)
    {
        foreach ($value as &$child) {
            if (is_array($child)) {
                $child = self::sortKeys($child);
            }
        }
        unset($child);
        if (array_keys($value) !== range(0, count($value) - 1)) {
            ksort($value);
        }
        return $value;
    }
}
