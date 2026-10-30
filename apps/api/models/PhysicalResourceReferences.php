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
            [['public_note', 'assigned_pages'], 'string'],
            [['start_visibility', 'end_visibility'], 'date', 'format' => 'php:Y-m-d'],
            [['use_visibility'], 'boolean'],
            [['end_visibility'], 'validateVisibilityRange'],
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

    public function validateVisibilityRange($attribute, $params = [], $validator = null)
    {
        if ((int)$this->use_visibility === 1 && $this->start_visibility && $this->$attribute
            && $this->$attribute < $this->start_visibility) {
            $this->addError($attribute, 'Visibility end date must not precede its start date.');
        }
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
            'public_note' => 'Public Note',
            'assigned_pages' => 'Assigned Pages',
            'start_visibility' => 'Visibility Start Date',
            'end_visibility' => 'Visibility End Date',
            'use_visibility' => 'Use Visibility Dates',
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
