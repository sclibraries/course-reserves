<?php

namespace app\services;

/** Defines the permitted acquisition paths for the item's own material type. */
class AccessPathPolicy
{
    const PATHS = ['purchase', 'ags', 'ill', 'in_house_copy', 'faculty_supplies'];

    public static function allowedForItem(array $item)
    {
        $data = $item['resource_data'] ?? null;
        if (is_string($data)) {
            $data = json_decode($data, true);
        }
        $type = is_array($data) ? strtolower(trim((string)($data['materialType'] ?? ''))) : '';
        return in_array($type, ['article', 'chapter'], true)
            ? self::PATHS
            : ['purchase', 'faculty_supplies'];
    }
}
