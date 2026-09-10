<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

class MaterialTypeFields extends ActiveRecord
{
    public static function tableName()
    {
        return 'material_type_fields';
    }

    public function rules()
    {
        return [
            [['material_type_id', 'field_name', 'label', 'field_type'], 'required'],
            [['material_type_id'], 'integer'],
            [['field_name', 'label'], 'string', 'max' => 255],
            [['field_type'], 'string', 'max' => 50],
            [['options_json'], 'string'],
        ];
    }

    public function getMaterialType()
    {
        return $this->hasOne(MaterialTypes::class, ['material_type_id' => 'material_type_id']);
    }
}
