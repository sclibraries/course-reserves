<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * WorkflowTemplate model
 *
 * @property int $id
 * @property string $name
 * @property string $description
 * @property string $workflow_type (course|item)
 * @property int $is_active
 * @property int $version
 * @property string $category
 * @property string $trigger_conditions JSON
 * @property string $metadata JSON
 * @property string $created_by
 * @property string $updated_by
 * @property string $created_at
 * @property string $updated_at
 *
 * @property WorkflowStep[] $steps
 * @property WorkflowInstance[] $instances
 */
class WorkflowTemplate extends ActiveRecord
{
    const TYPE_COURSE = 'course';
    const TYPE_ITEM = 'item';

    public static function tableName()
    {
        return 'workflow_templates';
    }

    public function rules()
    {
        return [
            [['name', 'workflow_type'], 'required'],
            [['name'], 'string', 'max' => 255],
            [['description'], 'string'],
            [['workflow_type'], 'in', 'range' => [self::TYPE_COURSE, self::TYPE_ITEM]],
            [['is_active', 'version'], 'integer'],
            [['category', 'created_by', 'updated_by'], 'string', 'max' => 255],
            [['trigger_conditions', 'metadata'], 'safe'],
        ];
    }

    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'name' => 'Workflow Name',
            'description' => 'Description',
            'workflow_type' => 'Workflow Type',
            'is_active' => 'Active',
            'version' => 'Version',
            'category' => 'Category',
            'trigger_conditions' => 'Trigger Conditions',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
        ];
    }

    /**
     * Gets query for [[WorkflowSteps]].
     */
    public function getSteps()
    {
        return $this->hasMany(WorkflowStep::class, ['template_id' => 'id'])
            ->orderBy(['sequence_order' => SORT_ASC]);
    }

    /**
     * Gets query for [[WorkflowInstances]].
     */
    public function getInstances()
    {
        return $this->hasMany(WorkflowInstance::class, ['template_id' => 'id']);
    }

    /**
     * Get first step in workflow
     */
    public function getFirstStep()
    {
        return $this->hasOne(WorkflowStep::class, ['template_id' => 'id'])
            ->orderBy(['sequence_order' => SORT_ASC])
            ->limit(1);
    }

    /**
     * Parse JSON fields after find
     */
    public function afterFind()
    {
        parent::afterFind();
        if ($this->trigger_conditions && is_string($this->trigger_conditions)) {
            $this->trigger_conditions = json_decode($this->trigger_conditions, true);
        }
        if ($this->metadata && is_string($this->metadata)) {
            $this->metadata = json_decode($this->metadata, true);
        }
    }

    /**
     * Encode JSON fields before save
     */
    public function beforeSave($insert)
    {
        if (parent::beforeSave($insert)) {
            if (is_array($this->trigger_conditions)) {
                $this->trigger_conditions = json_encode($this->trigger_conditions);
            }
            if (is_array($this->metadata)) {
                $this->metadata = json_encode($this->metadata);
            }

            // Set created_by/updated_by
            $user = Yii::$app->user->identity;
            if ($user) {
                if ($insert) {
                    $this->created_by = (string)$user->id;
                }
                $this->updated_by = (string)$user->id;
            }

            return true;
        }
        return false;
    }

    /**
     * Duplicate this template with a new version
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
            $newTemplate->version = $this->version + 1;
            $newTemplate->is_active = 0; // Inactive by default
            $newTemplate->save(false);

            // Copy steps
            foreach ($this->steps as $step) {
                $newStep = new WorkflowStep();
                $newStep->attributes = $step->attributes;
                $newStep->id = null;
                $newStep->template_id = $newTemplate->id;
                $newStep->save(false);

                // Map old step ID to new step ID
                $stepMapping[$step->id] = $newStep->id;

                // Copy conditions
                foreach ($step->conditions as $condition) {
                    $newCondition = new WorkflowCondition();
                    $newCondition->attributes = $condition->attributes;
                    $newCondition->id = null;
                    $newCondition->step_id = $newStep->id;
                    $newCondition->save(false);

                    $conditionMapping[$condition->id] = $newCondition->id;
                }
            }

            // Copy transitions with updated step IDs
            foreach ($this->steps as $step) {
                foreach ($step->transitions as $transition) {
                    $newTransition = new WorkflowStepTransition();
                    $newTransition->attributes = $transition->attributes;
                    $newTransition->id = null;
                    $newTransition->from_step_id = $stepMapping[$transition->from_step_id] ?? null;
                    $newTransition->to_step_id = $transition->to_step_id ? ($stepMapping[$transition->to_step_id] ?? null) : null;
                    $newTransition->condition_id = $transition->condition_id ? ($conditionMapping[$transition->condition_id] ?? null) : null;
                    $newTransition->save(false);
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
