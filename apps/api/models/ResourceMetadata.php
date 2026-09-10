<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

class ResourceMetadata extends ActiveRecord
{
    public static function tableName()
    {
        return 'resource_metadata';
    }

    public function rules()
    {
        return [
            [['resource_id', 'field_name', 'field_value'], 'required'],
            [['resource_id'], 'integer'],
            [['field_name'], 'string', 'max' => 255],
            [['field_value'], 'string'],
        ];
    }

    public function getResource()
    {
        return $this->hasOne(Resources::class, ['resource_id' => 'resource_id']);
    }
}
