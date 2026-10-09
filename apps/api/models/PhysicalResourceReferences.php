<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

class PhysicalResourceReferences extends ActiveRecord
{
    public static function tableName()
    {
        return 'physical_resource_references';
    }

    public function rules()
    {
        return [
            [['external_resource_id', 'offering_id'], 'required'],
            [['offering_id', 'order', 'folder_id'], 'integer'],
            [['external_resource_id', 'display_name'], 'string', 'max' => 255],
            [['resource_type'], 'string', 'max' => 50],
            [['order'], 'default', 'value' => 999],
            [['external_resource_id', 'offering_id'], 'unique', 'targetAttribute' => ['external_resource_id', 'offering_id']],
            [
                ['offering_id'],
                'exist',
                'skipOnError' => true,
                'targetClass' => CourseOfferings::class,
                'targetAttribute' => ['offering_id' => 'offering_id']
            ],
        ];
    }

    public function attributeLabels()
    {
        return [
            'reference_id' => 'Reference ID',
            'external_resource_id' => 'External Resource ID',
            'resource_type' => 'Resource Type',
            'display_name' => 'Display Name',
            'offering_id' => 'Offering ID',
            'folder_id' => 'Folder',
            'order' => 'Display Order',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At'
        ];
    }

    public function getCourseOffering()
    {
        return $this->hasOne(CourseOfferings::class, ['offering_id' => 'offering_id']);
    }

    public function getFolder()
    {
        return $this->hasOne(Folder::class, ['folder_id' => 'folder_id']);
    }
}
