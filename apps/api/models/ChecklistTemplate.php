<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * ChecklistTemplate model
 *
 * @property int $id
 * @property string $name
 * @property string $description
 * @property string $material_types JSON array
 * @property string $format
 * @property bool $is_active
 * @property string $created_at
 * @property string $updated_at
 * @property string $created_by
 *
 * @property ChecklistTemplateTask[] $tasks
 * @property ItemChecklist[] $itemChecklists
 */
class ChecklistTemplate extends ActiveRecord
{
    public static function tableName()
    {
        return 'checklist_templates';
    }

    public function rules()
    {
        return [
            [['name'], 'required'],
            [['description'], 'string'],
            [['material_types'], 'safe'],
            [['format'], 'in', 'range' => ['any', 'physical', 'electronic']],
            [['is_active'], 'boolean'],
            [['created_by'], 'integer'],
        ];
    }

    public function getTasks()
    {
        return $this->hasMany(ChecklistTemplateTask::class, ['template_id' => 'id'])
            ->orderBy(['task_order' => SORT_ASC]);
    }

    public function getItemChecklists()
    {
        return $this->hasMany(ItemChecklist::class, ['template_id' => 'id']);
    }

    /**
     * Get material types as array
     */
    public function getMaterialTypesArray()
    {
        if (empty($this->material_types)) {
            return [];
        }
        return json_decode($this->material_types, true) ?: [];
    }

    /**
     * Set material types from array
     */
    public function setMaterialTypesArray($array)
    {
        $this->material_types = json_encode($array ?: []);
    }

    /**
     * Format for API response
     */
    public function toArray(array $fields = [], array $expand = [], $recursive = true)
    {
        $data = parent::toArray($fields, $expand, $recursive);
        
        // Decode material_types JSON
        if (isset($data['material_types'])) {
            $data['material_types'] = $this->getMaterialTypesArray();
        }
        
        // Add tasks if expanded
        if (in_array('tasks', $expand) && $this->tasks) {
            $data['tasks'] = array_map(function($task) {
                return [
                    'id' => $task->id,
                    'label' => $task->label,
                    'help_text' => $task->help_text,
                    'order' => $task->task_order,
                    'optional' => (bool)$task->optional,
                ];
            }, $this->tasks);
        } else {
            // Add task count if tasks not expanded
            $data['task_count'] = $this->getTasks()->count();
        }
        
        return $data;
    }

    /**
     * Duplicate this template
     */
    public function duplicate()
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            // Create new template
            $newTemplate = new self();
            $newTemplate->attributes = $this->attributes;
            $newTemplate->id = null;
            $newTemplate->name = $this->name . ' (Copy)';
            $newTemplate->created_at = null;
            $newTemplate->updated_at = null;
            $newTemplate->created_by = Yii::$app->user->id ?? null;
            
            if (!$newTemplate->save()) {
                throw new \Exception('Failed to duplicate template');
            }

            // Duplicate tasks
            foreach ($this->tasks as $task) {
                $newTask = new ChecklistTemplateTask();
                $newTask->attributes = $task->attributes;
                $newTask->id = null;
                $newTask->template_id = $newTemplate->id;
                $newTask->created_at = null;
                $newTask->updated_at = null;
                
                if (!$newTask->save()) {
                    throw new \Exception('Failed to duplicate task');
                }
            }

            $transaction->commit();
            return $newTemplate;
        } catch (\Exception $e) {
            $transaction->rollBack();
            throw $e;
        }
    }
}
