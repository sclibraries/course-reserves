<?php

namespace app\services;

/** Defines the permitted acquisition paths for the item's own material type. */
class AccessPathPolicy
{
    const PATHS = ['purchase', 'ags', 'ill', 'in_house_copy', 'faculty_supplies'];

    public static function allowedForItem(array $item)
    {
        $type = EffectiveMaterialType::key($item);
        return in_array($type, ['article', 'chapter'], true)
            ? self::PATHS
            : ['purchase', 'faculty_supplies'];
    }
}
