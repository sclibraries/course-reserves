<?php

namespace app\services;

/** Shares the item-local material type rule across reads, writes and SQL filters. */
class EffectiveMaterialType
{
    public static function id(array $item)
    {
        $id = $item['staff_material_type_id'] ?? null;
        if ($id === null || $id === '') {
            $id = $item['default_material_type_id'] ?? $item['material_type_id'] ?? null;
        }
        return $id === null || $id === '' ? null : (int)$id;
    }

    public static function sql($alias)
    {
        return 'COALESCE(' . $alias . '.staff_material_type_id, ' . $alias . '.material_type_id)';
    }
}
