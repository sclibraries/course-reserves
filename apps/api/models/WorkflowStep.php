<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * WorkflowStep model
 *
 * @property int $id
 * @property int $template_id
 * @property string $step_key
 * @property string $step_name
 * @property string $step_description
 * @property string $step_type (decision|action|notification|assignment|approval)
 * @property int $sequence_order
 * @property int $is_required
 * @property int $is_automated
 * @property int $is_gate
 * @property string $assigned_role
 * @property int $estimated_duration_minutes
 * @property string $instructions
 * @property string $form_fields JSON
 * @property string $depends_on JSON
 * @property string $automation_handler
 * @property string $automation_config JSON
 * @property string $metadata JSON
 * @property string $created_at
 * @property string $updated_at
 *
 * @property WorkflowTemplate $template
 * @property WorkflowCondition[] $conditions
 * @property WorkflowStepTransition[] $transitions
 * @property WorkflowStepTransition[] $incomingTransitions
 */
class WorkflowStep extends ActiveRecord
{
    const TYPE_DECISION = 'decision';
    const TYPE_ACTION = 'action';
    const TYPE_NOTIFICATION = 'notification';
    const TYPE_ASSIGNMENT = 'assignment';
    const TYPE_APPROVAL = 'approval';

    public static function tableName()
    {
        return 'workflow_steps';
    }

    public function rules()
    {
        return [
            [['template_id', 'step_key', 'step_name', 'step_type', 'sequence_order'], 'required'],
            [['template_id', 'sequence_order', 'is_required', 'is_automated', 'is_gate', 'estimated_duration_minutes'], 'integer'],
            [['step_key', 'assigned_role', 'automation_handler'], 'string', 'max' => 150],
            [['step_name'], 'string', 'max' => 255],
            [['step_description', 'instructions'], 'string'],
            [['step_type'], 'in', 'range' => [
                self::TYPE_DECISION,
                self::TYPE_ACTION,
                self::TYPE_NOTIFICATION,
                self::TYPE_ASSIGNMENT,
                self::TYPE_APPROVAL
            ]],
            [['form_fields', 'metadata', 'depends_on', 'automation_config'], 'safe'],
        ];
    }

    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'template_id' => 'Template ID',
            'step_key' => 'Step Key',
            'step_name' => 'Step Name',
            'step_description' => 'Description',
            'step_type' => 'Step Type',
            'sequence_order' => 'Sequence Order',
            'is_required' => 'Required',
            'is_automated' => 'Automated',
            'assigned_role' => 'Assigned Role',
            'estimated_duration_minutes' => 'Est. Duration (min)',
            'instructions' => 'Instructions',
        ];
    }

    /**
     * Gets query for [[WorkflowTemplate]].
     */
    public function getTemplate()
    {
        return $this->hasOne(WorkflowTemplate::class, ['id' => 'template_id']);
    }

    /**
     * Gets query for [[WorkflowConditions]].
     */
    public function getConditions()
    {
        return $this->hasMany(WorkflowCondition::class, ['step_id' => 'id']);
    }

    /**
     * Gets query for [[WorkflowStepTransitions]] (outgoing).
     */
    public function getTransitions()
    {
        return $this->hasMany(WorkflowStepTransition::class, ['from_step_id' => 'id']);
    }

    /**
     * Gets query for [[WorkflowStepTransitions]] (incoming).
     */
    public function getIncomingTransitions()
    {
        return $this->hasMany(WorkflowStepTransition::class, ['to_step_id' => 'id']);
    }

    /**
     * Parse JSON fields after find
     */
    public function afterFind()
    {
        parent::afterFind();
        if ($this->form_fields && is_string($this->form_fields)) {
            $this->form_fields = json_decode($this->form_fields, true);
        }
        if ($this->metadata && is_string($this->metadata)) {
            $this->metadata = json_decode($this->metadata, true);
        }
        if ($this->depends_on && is_string($this->depends_on)) {
            $this->depends_on = json_decode($this->depends_on, true);
        }
        if ($this->automation_config && is_string($this->automation_config)) {
            $this->automation_config = json_decode($this->automation_config, true);
        }
    }

    /**
     * Encode JSON fields before save
     */
    public function beforeSave($insert)
    {
        if (parent::beforeSave($insert)) {
            if (is_array($this->form_fields)) {
                $this->form_fields = json_encode($this->form_fields);
            }
            if (is_array($this->metadata)) {
                $this->metadata = json_encode($this->metadata);
            }
            if (is_array($this->depends_on)) {
                $this->depends_on = json_encode($this->depends_on);
            }
            if (is_array($this->automation_config)) {
                $this->automation_config = json_encode($this->automation_config);
            }
            return true;
        }
        return false;
    }

    /**
     * Get next step based on condition result
     */
    public function getNextStep($conditionResults = [])
    {
        $query = WorkflowStepTransition::find()
            ->where(['from_step_id' => $this->id]);
        
        // Build condition matching
        if (!empty($conditionResults)) {
            $query->andWhere(function ($q) use ($conditionResults) {
                $q->where(['is_default' => 1]);
                
                // Match condition results
                foreach ($conditionResults as $conditionId => $value) {
                    $q->orWhere([
                        'condition_id' => $conditionId,
                        'condition_value' => $value
                    ]);
                }
            });
        } else {
            // No conditions provided, just get default transition
            $query->andWhere(['is_default' => 1]);
        }
        
        $transition = $query->orderBy(['priority' => SORT_ASC])->one();

        if ($transition && $transition->to_step_id) {
            return self::findOne($transition->to_step_id);
        }

        return null;
    }
}
