<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * ItemChecklistTask model
 *
 * @property int $id
 * @property int $item_checklist_id
 * @property int $template_task_id
 * @property bool $completed
 * @property string $completed_at
 * @property string $completed_by
 * @property string $notes
 *
 * @property ItemChecklist $itemChecklist
 * @property ChecklistTemplateTask $templateTask
 */
class ItemChecklistTask extends ActiveRecord
{
    public static function tableName()
    {
        return 'item_checklist_tasks';
    }

    public function rules()
    {
        return [
            [['item_checklist_id', 'template_task_id'], 'required'],
            [['item_checklist_id', 'template_task_id'], 'integer'],
            [['completed'], 'boolean'],
            [['completed_at'], 'safe'],
            [['completed_by'], 'string', 'max' => 255],
            [['notes'], 'string'],
        ];
    }

    public function getItemChecklist()
    {
        return $this->hasOne(ItemChecklist::class, ['id' => 'item_checklist_id']);
    }

    public function getTemplateTask()
    {
        return $this->hasOne(ChecklistTemplateTask::class, ['id' => 'template_task_id']);
    }

    /**
     * Format for API response with template task details
     */
    public function toArrayWithTemplate()
    {
        $data = [
            'id' => $this->id,
            'template_task_id' => $this->template_task_id,
            'completed' => (bool)$this->completed,
            'completed_at' => $this->completed_at,
            'completed_by' => $this->completed_by,
            'notes' => $this->notes,
        ];
        
        // Add template task details
        if ($this->templateTask) {
            $data['label'] = $this->templateTask->label;
            $data['help_text'] = $this->templateTask->help_text;
            $data['optional'] = (bool)$this->templateTask->optional;
            $data['task_order'] = $this->templateTask->task_order;
        }
        
        return $data;
    }
}
