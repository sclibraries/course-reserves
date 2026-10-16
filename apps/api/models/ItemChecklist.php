<?php

namespace app\models;

use yii\db\ActiveRecord;

/**
 * ItemChecklist model
 *
 * @property int $id
 * @property int $submission_item_id
 * @property int $template_id
 * @property string $assigned_at
 * @property string $assigned_by
 * @property string $completed_at
 * @property string $completed_by
 *
 * @property ChecklistTemplate $template
 * @property SubmissionNewResource $submissionItem
 * @property ItemChecklistTask[] $tasks
 */
class ItemChecklist extends ActiveRecord
{
    public static function tableName()
    {
        return 'item_checklists';
    }

    public function rules()
    {
        return [
            [['submission_item_id', 'template_id'], 'required'],
            [['submission_item_id', 'template_id', 'assigned_by', 'completed_by'], 'integer'],
            [['assigned_at', 'completed_at'], 'safe'],
        ];
    }

    public function getTemplate()
    {
        return $this->hasOne(ChecklistTemplate::class, ['id' => 'template_id']);
    }

    public function getSubmissionItem()
    {
        return $this->hasOne(SubmissionNewResource::class, ['id' => 'submission_item_id']);
    }

    public function getTasks()
    {
        return $this->hasMany(ItemChecklistTask::class, ['item_checklist_id' => 'id'])
            ->joinWith('templateTask')
            ->orderBy(['checklist_template_tasks.task_order' => SORT_ASC]);
    }

    /**
     * Format for API response with template and task details
     */
    public function toArray(array $fields = [], array $expand = [], $recursive = true)
    {
        $data = parent::toArray($fields, $expand, $recursive);
        
        // Add template info
        if ($this->template) {
            $data['template_name'] = $this->template->name;
            $data['description'] = $this->template->description;
        }
        
        // Add tasks with full details
        if (in_array('tasks', $expand) || !isset($expand) || empty($expand)) {
            $data['tasks'] = array_map(function($task) {
                return $task->toArrayWithTemplate();
            }, $this->tasks);
        }
        
        return $data;
    }

    /**
     * Check if all required tasks are completed
     */
    public function areRequiredTasksComplete()
    {
        $incompleteTasks = ItemChecklistTask::find()
            ->joinWith('templateTask')
            ->where([
                'item_checklist_id' => $this->id,
                'completed' => false
            ])
            ->andWhere(['checklist_template_tasks.optional' => false])
            ->count();
        
        return (int)$incompleteTasks === 0;
    }
}
