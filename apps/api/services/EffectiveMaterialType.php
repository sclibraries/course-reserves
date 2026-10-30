<?php

namespace app\services;

/** Shares the item-local material type rule across reads, writes and SQL filters. */
class EffectiveMaterialType
{
    const KEYS = ['book', 'ebook', 'article', 'chapter', 'video', 'website', 'other'];

    public static function id(array $item)
    {
        $id = $item['staff_material_type_id'] ?? null;
        if ($id === null || $id === '') {
            $id = $item['default_material_type_id'] ?? $item['material_type_id'] ?? null;
        }
        if ($id === null || $id === '') {
            $id = $item['source_material_type_id'] ?? null;
        }
        return $id === null || $id === '' ? null : (int)$id;
    }

    public static function modelId($model)
    {
        $id = self::id($model->getAttributes());
        if ($id !== null) {
            return $id;
        }
        $sourceId = $model->source_resource_id;
        if ($sourceId === null || $sourceId === '') {
            return null;
        }
        $source = \app\models\Resources::findOne(['resource_id' => $sourceId]);
        return $source && $source->material_type_id !== null ? (int)$source->material_type_id : null;
    }

    public static function modelKey($model)
    {
        $type = $model->getEffectiveMaterialType();
        return self::keyForModel($model, $type);
    }

    public static function resourceDataForModel($model)
    {
        $data = json_decode($model->resource_data, true);
        if (!is_array($data)) {
            return $model->resource_data;
        }
        $typeId = self::modelId($model);
        $type = $typeId ? \app\models\MaterialTypes::findOne($typeId) : null;
        if ($type) {
            $data['materialType'] = self::keyForModel($model, $type);
            if (array_key_exists('material_type_id', $data)) {
                $data['material_type_id'] = $typeId;
            }
        } else {
            unset($data['materialType'], $data['material_type_id']);
        }
        return $data;
    }

    public static function key(array $item, $materialTypeName = null)
    {
        $hasStaffOverride = isset($item['staff_material_type_id'])
            && $item['staff_material_type_id'] !== '';
        if ($hasStaffOverride) {
            return self::firstKey([
                $item['staff_material_type_key'] ?? null,
                $item['staff_material_type_name'] ?? null,
                $item['material_type_name'] ?? null,
                $item['material_type'] ?? null,
                $item['materialType'] ?? null,
                $materialTypeName,
            ]);
        }

        $resourceData = $item['resource_data'] ?? null;
        if (is_string($resourceData)) {
            $resourceData = json_decode($resourceData, true);
        }
        $resourceData = is_array($resourceData) ? $resourceData : [];
        $itemKey = self::firstKey([
            $resourceData['materialTypeKey'] ?? null,
            $resourceData['material_type_key'] ?? null,
            $resourceData['materialType'] ?? null,
        ]);
        if ($itemKey !== null) {
            return $itemKey;
        }

        return self::firstKey([
            $item['material_type_key'] ?? null,
            $item['materialTypeKey'] ?? null,
            $item['material_type_name'] ?? null,
            $materialTypeName,
            $item['material_type'] ?? null,
            $item['materialType'] ?? null,
        ]);
    }

    public static function sql($alias, $sourceAlias = null)
    {
        $types = [$alias . '.staff_material_type_id', $alias . '.material_type_id'];
        if ($sourceAlias !== null) {
            $types[] = $sourceAlias . '.material_type_id';
        }
        return 'COALESCE(' . implode(', ', $types) . ')';
    }

    private static function firstKey(array $values)
    {
        foreach ($values as $value) {
            $key = self::normalizeKey($value);
            if ($key !== null) {
                return $key;
            }
        }
        return null;
    }

    private static function keyForModel($model, $type)
    {
        $item = $model->getAttributes();
        $item['material_type'] = $type ? $type->name : null;
        return self::key($item, $type ? $type->name : null);
    }

    private static function normalizeKey($value)
    {
        if (is_array($value)) {
            return self::normalizeKey($value['key'] ?? $value['name'] ?? null);
        }
        if (!is_scalar($value)) {
            return null;
        }
        $normalized = strtolower(trim((string)$value));
        $normalized = preg_replace('/[^a-z0-9]+/', '_', $normalized);
        $normalized = trim($normalized, '_');
        $aliases = [
            'e_book' => 'ebook',
            'electronic_book' => 'ebook',
            'web_site' => 'website',
        ];
        if (isset($aliases[$normalized])) {
            return $aliases[$normalized];
        }
        if (in_array($normalized, self::KEYS, true)) {
            return $normalized;
        }
        $parts = explode('_', $normalized);
        $suffix = end($parts);
        return in_array($suffix, self::KEYS, true) ? $suffix : null;
    }
}
