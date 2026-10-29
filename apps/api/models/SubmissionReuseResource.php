<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * SubmissionReuseResource model
 *
 * @property int $id
 * @property int $submission_id
 * @property int $source_resource_id
 * @property string $barcode
 * @property string $call_number
 * @property string $item_status
 * @property int $display_order
 * @property int $position_in_folder
 * @property string $folder_name
 * @property string $faculty_notes
 * @property string $public_note
 * @property string $assigned_pages
 * @property int $materialized_resource_id
 * @property int $materialized_course_resource_id
 * @property int $materialized_physical_reference_id
 * @property int $materialized_folder_id
 * @property string $materialized_at
 * @property string $materialized_by_staff_id
 * @property string $created_at
 */
class SubmissionReuseResource extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'submission_reuse_resources';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['submission_id'], 'required'],
            [['submission_id', 'source_resource_id', 'display_order', 'position_in_folder', 'materialized_resource_id', 'materialized_course_resource_id', 'materialized_physical_reference_id', 'materialized_folder_id'], 'integer'],
            [['faculty_notes', 'public_note', 'assigned_pages'], 'string'],
            [['created_at', 'materialized_at'], 'safe'],
            [['folder_name', 'barcode', 'call_number', 'item_status', 'materialized_by_staff_id'], 'string', 'max' => 255],
            [['display_order'], 'default', 'value' => 999],
            [['item_status'], 'default', 'value' => 'pending'],
        ];
    }

    public function beforeSave($insert)
    {
        if (!parent::beforeSave($insert)) {
            return false;
        }
        if ($this->hasAttribute('source_snapshot_json')) {
            $sourceChanged = $insert || (string)$this->getOldAttribute('source_resource_id')
                !== (string)$this->source_resource_id;
            if ($sourceChanged || !$this->source_snapshot_json) {
                $snapshot = \app\services\SubmissionSourceSnapshot::capture($this->source_resource_id);
                $this->source_snapshot_json = $snapshot ? json_encode($snapshot, JSON_UNESCAPED_SLASHES) : null;
                if ($snapshot && $this->material_type_id === null) {
                    $this->material_type_id = $snapshot['material_type_id'];
                }
            }
        }
        return true;
    }

    public function fields()
    {
        $fields = parent::fields();
        foreach ([
            'staff_material_type_id', 'destination_class_choice', 'source_snapshot_json', 'staff_corrections_json',
        ] as $field) {
            unset($fields[$field]);
        }
        $fields['material_type_id'] = function ($model) {
            return \app\services\EffectiveMaterialType::id($model->getAttributes());
        };
        $fields['materialType'] = function ($model) {
            return $model->getEffectiveMaterialType();
        };
        return $fields;
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'submission_id' => 'Submission ID',
            'source_resource_id' => 'Source Resource ID',
            'display_order' => 'Display Order',
            'folder_name' => 'Folder Name',
            'faculty_notes' => 'Faculty Notes',
            'public_note' => 'Public Note',
            'assigned_pages' => 'Assigned Pages',
            'materialized_resource_id' => 'Materialized Resource ID',
            'materialized_course_resource_id' => 'Materialized Course Resource ID',
            'materialized_physical_reference_id' => 'Materialized Physical Reference ID',
            'materialized_folder_id' => 'Materialized Folder ID',
            'materialized_at' => 'Materialized At',
            'materialized_by_staff_id' => 'Materialized By Staff ID',
            'created_at' => 'Created At',
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSubmission()
    {
        return $this->hasOne(FacultySubmission::class, ['submission_id' => 'submission_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSourceResource()
    {
        return $this->hasOne(Resources::class, ['resource_id' => 'source_resource_id']);
    }

    public function getEffectiveMaterialType()
    {
        $id = \app\services\EffectiveMaterialType::id($this->getAttributes());
        return $id ? MaterialTypes::findOne($id) : null;
    }
}
