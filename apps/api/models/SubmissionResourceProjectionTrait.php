<?php

namespace app\models;

/** Shared API-109 input projection behavior for both submission item kinds. */
trait SubmissionResourceProjectionTrait
{
    protected function captureSourceSnapshot($insert, $resourceDataTypeWins = false)
    {
        if (!$this->hasAttribute('source_snapshot_json')) {
            return;
        }
        $sourceChanged = $insert || (string)$this->getOldAttribute('source_resource_id')
            !== (string)$this->source_resource_id;
        if (!$sourceChanged && $this->source_snapshot_json) {
            return;
        }
        $snapshot = \app\services\SubmissionSourceSnapshot::capture($this->source_resource_id);
        $this->source_snapshot_json = $snapshot ? json_encode($snapshot, JSON_UNESCAPED_SLASHES) : null;
        if ($snapshot && $this->material_type_id === null
            && (!$resourceDataTypeWins || !$this->hasResourceDataMaterialType())) {
            $this->material_type_id = $snapshot['material_type_id'];
        }
    }

    protected function effectiveMaterialTypeFields(array $fields, array $additionalHiddenFields = [], $includeResourceData = false)
    {
        foreach (array_merge($additionalHiddenFields, [
            'staff_material_type_id', 'destination_class_choice', 'source_snapshot_json', 'staff_corrections_json',
        ]) as $field) {
            unset($fields[$field]);
        }
        $fields['material_type_id'] = function ($model) {
            return \app\services\EffectiveMaterialType::modelId($model);
        };
        $fields['material_type_key'] = function ($model) {
            return \app\services\EffectiveMaterialType::modelKey($model);
        };
        if ($includeResourceData) {
            $fields['resource_data'] = function ($model) {
                return $model->getResourceDataForPresentation();
            };
        }
        $fields['materialType'] = function ($model) {
            return $model->getEffectiveMaterialType();
        };
        return $fields;
    }

    protected function resourceDataForPresentation()
    {
        return \app\services\EffectiveMaterialType::resourceDataForModel($this);
    }

    private function hasResourceDataMaterialType()
    {
        if (!$this->hasAttribute('resource_data')) {
            return false;
        }
        $data = json_decode($this->resource_data, true);
        return is_array($data) && (array_key_exists('materialType', $data) || array_key_exists('material_type_id', $data));
    }
}
