<?php

namespace app\services;

/** Defines the permitted acquisition paths for the item's own material type. */
class AccessPathPolicy
{
    const PATHS = ['purchase', 'ags', 'ill', 'in_house_copy', 'faculty_supplies'];

    public static function allowedForItem(array $item)
    {
        if (array_key_exists('material_type', $item)) {
            $type = strtolower(trim((string)$item['material_type']));
        } elseif (array_key_exists('materialType', $item)) {
            $materialType = $item['materialType'];
            $type = is_array($materialType) ? strtolower(trim((string)($materialType['name'] ?? ''))) : '';
        } else {
            $data = $item['resource_data'] ?? null;
            if (is_string($data)) {
                $data = json_decode($data, true);
            }
            $type = is_array($data) ? strtolower(trim((string)($data['materialType'] ?? ''))) : '';
        }
        return in_array($type, ['article', 'chapter'], true)
            ? self::PATHS
            : ['purchase', 'faculty_supplies'];
    }
}
