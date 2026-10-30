<?php

namespace app\services;

/** Selects the item fields that contribute to the pending student-facing projection. */
class PublicationDraftSnapshot
{
    public static function fromNewItem(array $item)
    {
        $projection = (new SubmissionInputProjection())->project('new', $item, null, null, true);
        $sourceSnapshot = self::decode($item['source_snapshot_json'] ?? null);
        $staffCorrections = self::decode($item['staff_corrections_json'] ?? null);
        $identityItem = $item;
        $identityItem['destination_class'] = $projection['destination_class'];
        $physicalIdentity = (new PhysicalResourceReferenceIdentity())->resolve('new', $identityItem);

        return self::sortKeys([
            'inputs' => $projection['inputs'],
            'staff_corrections' => $staffCorrections,
            'source_snapshot' => $sourceSnapshot,
            'material_type_id' => EffectiveMaterialType::id($item),
            'material_type_key' => $projection['effective_material_type']['key'],
            'physical_identity' => $physicalIdentity,
            'destination_class_choice' => $item['destination_class_choice'] ?? null,
            'is_reuse' => (int)($item['is_reuse'] ?? 0),
            'source_barcode' => $item['source_barcode'] ?? null,
            'source_call_number' => $item['source_call_number'] ?? null,
            'source_resource_id' => $item['source_resource_id'] ?? null,
            'source_folio_instance_id' => $item['source_folio_instance_id'] ?? null,
            'source_folio_holdings_id' => $item['source_folio_holdings_id'] ?? null,
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

    private static function decode($value)
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }
        return is_array($value) ? $value : [];
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
