<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;
use yii\behaviors\TimestampBehavior;

/**
 * SubmissionNewResource model
 *
 * @property int $id
 * @property int $submission_id
 * @property int $material_type_id
 * @property string $resource_data
 * @property int $is_reuse
 * @property string $source_barcode
 * @property string $source_call_number
 * @property string $source_resource_id
 * @property string $source_folio_instance_id
 * @property string $item_status
 * @property int $display_order
 * @property int $position_in_folder
 * @property string $folder_name
 * @property string $faculty_notes
 * @property string $public_note
 * @property string $assigned_pages
 * @property string $staff_notes
 * @property string $priority
 * @property int $materialized_resource_id
 * @property int $materialized_course_resource_id
 * @property int $materialized_physical_reference_id
 * @property int $materialized_folder_id
 * @property string $materialized_at
 * @property string $materialized_by_staff_id
 * @property string $created_at
 * @property string $updated_at
 */
class SubmissionNewResource extends ActiveRecord
{
    const PRIORITY_HIGH = 'high';
    const PRIORITY_MEDIUM = 'medium';
    const PRIORITY_LOW = 'low';

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'submission_new_resources';
    }

    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        return [
            [
                'class' => TimestampBehavior::class,
                'createdAtAttribute' => 'created_at',
                'updatedAtAttribute' => 'updated_at',
                'value' => function() {
                    return date('Y-m-d H:i:s');
                }
            ]
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['submission_id', 'resource_data'], 'required'],
            [['submission_id', 'material_type_id', 'display_order', 'position_in_folder', 'is_reuse', 'materialized_resource_id', 'materialized_course_resource_id', 'materialized_physical_reference_id', 'materialized_folder_id'], 'integer'],
            [['resource_data', 'faculty_notes', 'public_note', 'assigned_pages', 'staff_notes'], 'string'],
            [['created_at', 'updated_at', 'materialized_at'], 'safe'],
            [['folder_name', 'item_status', 'source_barcode', 'source_resource_id', 'source_folio_instance_id', 'materialized_by_staff_id'], 'string', 'max' => 255],
            [['source_call_number'], 'string', 'max' => 512],
            [['priority'], 'string'],
            [['priority'], 'in', 'range' => [self::PRIORITY_HIGH, self::PRIORITY_MEDIUM, self::PRIORITY_LOW]],
            [['display_order'], 'default', 'value' => 999],
            [['priority'], 'default', 'value' => self::PRIORITY_MEDIUM],
            [['item_status'], 'default', 'value' => 'pending'],
            [['is_reuse'], 'default', 'value' => 0],
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
                if ($snapshot && $this->material_type_id === null && !$this->hasResourceMaterialType()) {
                    $this->material_type_id = $snapshot['material_type_id'];
                }
            }
        }
        return true;
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'submission_id' => 'Submission ID',
            'material_type_id' => 'Material Type ID',
            'resource_data' => 'Resource Data',
            'is_reuse' => 'Is Reuse Item',
            'source_barcode' => 'Source Barcode',
            'source_call_number' => 'Source Call Number',
            'source_resource_id' => 'Source Resource ID',
            'source_folio_instance_id' => 'Source FOLIO Instance ID',
            'item_status' => 'Item Status',
            'display_order' => 'Display Order',
            'position_in_folder' => 'Position in Folder',
            'folder_name' => 'Folder Name',
            'faculty_notes' => 'Faculty Notes',
            'public_note' => 'Public Note',
            'assigned_pages' => 'Assigned Pages',
            'staff_notes' => 'Staff Notes',
            'priority' => 'Priority',
            'materialized_resource_id' => 'Materialized Resource ID',
            'materialized_course_resource_id' => 'Materialized Course Resource ID',
            'materialized_physical_reference_id' => 'Materialized Physical Reference ID',
            'materialized_folder_id' => 'Materialized Folder ID',
            'materialized_at' => 'Materialized At',
            'materialized_by_staff_id' => 'Materialized By Staff ID',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
        ];
    }

    /**
     * Define which fields should be included in serialization
     */
    public function fields()
    {
        $fields = parent::fields();
        foreach ([
            'claimed_by', 'claimed_by_staff_id', 'claimed_at', 'last_activity_at', 'assigned_group_id',
            'staff_material_type_id', 'destination_class_choice', 'source_snapshot_json', 'staff_corrections_json',
        ] as $field) {
            unset($fields[$field]);
        }
        $fields['material_type_id'] = function ($model) {
            return \app\services\EffectiveMaterialType::id($model->getAttributes());
        };
        $fields['resource_data'] = function ($model) {
            return $model->getResourceDataForPresentation();
        };
        // Only add materialType relation, NOT submission to avoid circular reference
        // (FacultySubmission already includes newResources)
        $fields['materialType'] = function ($model) {
            return $model->getEffectiveMaterialType();
        };
        
        return $fields;
    }
    
    /**
     * Extra fields that can be explicitly requested via ?expand=submission
     */
    public function extraFields()
    {
        return [
            'submission' => function() {
                // Return only the course-related fields from submission to avoid circular reference
                $submission = $this->submission;
                if (!$submission) {
                    return null;
                }
                return [
                    'submission_id' => $submission->submission_id,
                    'submission_uuid' => $submission->submission_uuid,
                    'course_code' => $submission->course_code,
                    'course_title' => $submission->course_title,
                    'term_code' => $submission->term_code,
                    'section' => $submission->section,
                    'faculty_display_name' => $submission->faculty_display_name,
                    'needed_by_date' => $submission->needed_by_date,
                    'status' => $submission->status,
                    'offering_id' => $submission->offering_id,
                    'folio_course_listing_id' => $submission->folio_course_listing_id,
                ];
            },
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
    public function getMaterialType()
    {
        return $this->hasOne(MaterialTypes::class, ['material_type_id' => 'material_type_id']);
    }

    public function getEffectiveMaterialType()
    {
        $id = \app\services\EffectiveMaterialType::id($this->getAttributes());
        return $id ? MaterialTypes::findOne($id) : null;
    }

    public function getResourceDataForPresentation()
    {
        $data = $this->getResourceDataDecoded();
        if (!is_array($data)) {
            return $this->resource_data;
        }
        $typeId = \app\services\EffectiveMaterialType::id($this->getAttributes());
        $type = $this->getEffectiveMaterialType();
        if ($type) {
            $data['materialType'] = $type->name;
            if (array_key_exists('material_type_id', $data)) {
                $data['material_type_id'] = $typeId;
            }
        } else {
            unset($data['materialType']);
            unset($data['material_type_id']);
        }
        return $data;
    }

    private function hasResourceMaterialType()
    {
        $data = $this->getResourceDataDecoded();
        return is_array($data) && (array_key_exists('materialType', $data) || array_key_exists('material_type_id', $data));
    }

    /**
     * Get decoded resource data
     */
    public function getResourceDataDecoded()
    {
        return json_decode($this->resource_data, true);
    }

    /**
     * Set resource data from array
     */
    public function setResourceDataFromArray($data)
    {
        $this->resource_data = json_encode($data);
    }

    /**
     * Get priority options
     */
    public static function getPriorityOptions()
    {
        return [
            self::PRIORITY_HIGH => 'High',
            self::PRIORITY_MEDIUM => 'Medium',
            self::PRIORITY_LOW => 'Low',
        ];
    }

    /**
     * Get title from resource data
     */
    public function getTitle()
    {
        $data = $this->getResourceDataDecoded();
        return isset($data['title']) ? $data['title'] : 'Untitled';
    }

    /**
     * Get author from resource data
     */
    public function getAuthor()
    {
        $data = $this->getResourceDataDecoded();
        return isset($data['author']) ? $data['author'] : null;
    }

    /**
     * Check if this is a reuse item
     */
    public function isReuseItem()
    {
        return $this->is_reuse == 1;
    }

    /**
     * Check if this is a new item
     */
    public function isNewItem()
    {
        return $this->is_reuse == 0;
    }

    /**
     * Get barcode (from source_barcode for reuse items, or resource_data for new items)
     */
    public function getBarcode()
    {
        if ($this->isReuseItem()) {
            return $this->source_barcode;
        }
        
        $data = $this->getResourceDataDecoded();
        return isset($data['barcode']) ? $data['barcode'] : null;
    }

    /**
     * Get call number (from source_call_number for reuse items, or resource_data for new items)
     */
    public function getCallNumber()
    {
        if ($this->isReuseItem()) {
            return $this->source_call_number;
        }
        
        $data = $this->getResourceDataDecoded();
        return isset($data['callNumber']) ? $data['callNumber'] : null;
    }

    /**
     * Auto-assign appropriate checklist when item is claimed
     */
    public function autoAssignChecklist()
    {
        // Don't assign if already has checklist
        $existing = ItemChecklist::findOne(['submission_item_id' => $this->id]);
        if ($existing) {
            return;
        }

        // Determine format
        $format = $this->determineFormat(); // 'physical' or 'electronic'
        
        // Get material type
        $materialType = $this->materialType ? $this->materialType->name : null;

        // Find best matching template
        $template = ChecklistTemplate::find()
            ->where(['is_active' => true])
            ->andWhere([
                'or',
                ['format' => $format],
                ['format' => 'any']
            ])
            ->orderBy([
                new \yii\db\Expression("CASE WHEN format = :format THEN 0 ELSE 1 END"),
                new \yii\db\Expression("CASE WHEN material_types LIKE :materialType THEN 0 ELSE 1 END")
            ])
            ->addParams([
                ':format' => $format,
                ':materialType' => '%' . $materialType . '%'
            ])
            ->one();

        if ($template) {
            $transaction = \Yii::$app->db->beginTransaction();
            try {
                // Create checklist
                $checklist = new ItemChecklist();
                $checklist->submission_item_id = $this->id;
                $checklist->template_id = $template->id;
                $checklist->assigned_by = \Yii::$app->user->id ?? 'system';
                $checklist->save();

                // Copy tasks
                foreach ($template->tasks as $templateTask) {
                    $task = new ItemChecklistTask();
                    $task->item_checklist_id = $checklist->id;
                    $task->template_task_id = $templateTask->id;
                    $task->completed = false;
                    $task->save();
                }

                $transaction->commit();
            } catch (\Exception $e) {
                $transaction->rollBack();
                \Yii::error('Failed to auto-assign checklist: ' . $e->getMessage());
            }
        }
    }

    /**
     * Determine if item is physical or electronic
     */
    protected function determineFormat()
    {
        $resourceData = json_decode($this->resource_data, true);
        
        // Check for URL - indicates electronic
        if (!empty($resourceData['url'])) {
            return 'electronic';
        }
        
        // Check for barcode/call number - indicates physical
        if (!empty($this->source_barcode) || !empty($this->source_call_number)) {
            return 'physical';
        }
        
        // Check material type
        if ($this->materialType) {
            $electronicTypes = ['ebook', 'article', 'database', 'website', 'streaming'];
            if (in_array(strtolower($this->materialType->name), $electronicTypes)) {
                return 'electronic';
            }
        }
        
        return 'physical'; // Default
    }
}
