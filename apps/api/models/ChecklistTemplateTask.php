<?php

namespace app\models;

use yii\db\ActiveRecord;

/**
 * ChecklistTemplateTask model
 *
 * @property int $id
 * @property int $template_id
 * @property string $label
 * @property string $help_text
 * @property int $task_order
 * @property bool $optional
 * @property string $created_at
 * @property string $updated_at
 *
 * @property ChecklistTemplate $template
 */
class ChecklistTemplateTask extends ActiveRecord
{
    public static function tableName()
    {
        return 'checklist_template_tasks';
    }

    public function rules()
    {
        return [
            [['template_id', 'label', 'task_order'], 'required'],
            [['template_id', 'task_order'], 'integer'],
            [['label'], 'string', 'max' => 255],
            [['help_text'], 'string'],
            [['optional'], 'boolean'],
        ];
    }

    public function getTemplate()
    {
        return $this->hasOne(ChecklistTemplate::class, ['id' => 'template_id']);
    }
}
