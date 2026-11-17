<?php

namespace app\services;

/** Classifies effective item changes by their strongest workflow effect. */
class ItemChangeClass
{
    const IDENTITY = 'identity';
    const DISPLAY_ONLY = 'display_only';
    const PLACEMENT = 'placement';

    private const DISPLAY_ONLY_FIELDS = [
        'description', 'display_start_date', 'display_end_date', 'public_note', 'assigned_pages',
    ];
    private const PLACEMENT_FIELDS = ['folder_name', 'display_order', 'position_in_folder'];

    public static function classify(array $changedFields)
    {
        $class = null;
        foreach ($changedFields as $field) {
            if (in_array($field, self::DISPLAY_ONLY_FIELDS, true)) {
                $class = self::DISPLAY_ONLY;
            } elseif (in_array($field, self::PLACEMENT_FIELDS, true)) {
                $class = $class ?: self::PLACEMENT;
            } else {
                return self::IDENTITY;
            }
        }
        return $class;
    }
}
