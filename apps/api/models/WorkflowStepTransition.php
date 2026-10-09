<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * WorkflowStepTransition model
 *
 * @property int $id
 * @property int $from_step_id
 * @property int $to_step_id
 * @property int $condition_id
 * @property string $condition_value
 * @property string $transition_label
 * @property int $priority
 * @property string $actions JSON
 * @property int $is_default
 * @property string $metadata JSON
 * @property string $created_at
 * @property string $updated_at
 *
 * @property WorkflowStep $fromStep
 * @property WorkflowStep $toStep
 * @property WorkflowCondition $condition
 */
class WorkflowStepTransition extends ActiveRecord
{
    public static function tableName()
    {
        return 'workflow_step_transitions';
    }

    public function rules()
    {
        return [
            [['from_step_id'], 'required'],
            [['from_step_id', 'to_step_id', 'condition_id', 'priority', 'is_default'], 'integer'],
            [['condition_value', 'transition_label'], 'string', 'max' => 255],
            [['actions', 'metadata'], 'safe'],
        ];
    }

    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'from_step_id' => 'From Step',
            'to_step_id' => 'To Step',
            'condition_id' => 'Condition',
            'condition_value' => 'Condition Value',
            'transition_label' => 'Label',
            'priority' => 'Priority',
            'is_default' => 'Is Default',
        ];
    }

    /**
     * Gets query for [[WorkflowStep]] from.
     */
    public function getFromStep()
    {
        return $this->hasOne(WorkflowStep::class, ['id' => 'from_step_id']);
    }

    /**
     * Gets query for [[WorkflowStep]] to.
     */
    public function getToStep()
    {
        return $this->hasOne(WorkflowStep::class, ['id' => 'to_step_id']);
    }

    /**
     * Gets query for [[WorkflowCondition]].
     */
    public function getCondition()
    {
        return $this->hasOne(WorkflowCondition::class, ['id' => 'condition_id']);
    }

    /**
     * Parse JSON fields after find
     */
    public function afterFind()
    {
        parent::afterFind();
        if ($this->actions && is_string($this->actions)) {
            $this->actions = json_decode($this->actions, true);
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
            if (is_array($this->actions)) {
                $this->actions = json_encode($this->actions);
            }
            if (is_array($this->metadata)) {
                $this->metadata = json_encode($this->metadata);
            }
            return true;
        }
        return false;
    }

    /**
     * Check if this transition should be taken
     */
    public function shouldTransition($conditionResults = [])
    {
        // If it's the default transition and no condition matches
        if ($this->is_default) {
            return true;
        }

        // Check if condition matches
        if ($this->condition_id && isset($conditionResults[$this->condition_id])) {
            return $conditionResults[$this->condition_id] == $this->condition_value;
        }

        return false;
    }

    /**
     * Execute actions associated with this transition
     */
    public function executeActions($instance)
    {
        if (empty($this->actions) || !is_array($this->actions)) {
            return true;
        }

        foreach ($this->actions as $action) {
            $actionType = $action['type'] ?? null;
            
            switch ($actionType) {
                case 'notify':
                    $this->sendNotification($instance, $action);
                    break;

                case 'assign':
                    $this->assignToUser($instance, $action);
                    break;

                case 'update_field':
                    $this->updateField($instance, $action);
                    break;

                case 'webhook':
                    $this->callWebhook($action);
                    break;

                default:
                    // Log unknown action type
                    Yii::warning("Unknown action type: {$actionType}", __METHOD__);
            }
        }

        return true;
    }

    /**
     * Send notification
     */
    protected function sendNotification($instance, $action)
    {
        // Implementation for sending notifications
        // This could integrate with your communication system
        $recipient = $action['recipient'] ?? null;
        $message = $action['message'] ?? 'Workflow update';

        // TODO: Integrate with SubmissionCommunication or email system
        Yii::info("Would send notification to {$recipient}: {$message}", __METHOD__);
    }

    /**
     * Assign to user
     */
    protected function assignToUser($instance, $action)
    {
        $userId = $action['user_id'] ?? null;
        $role = $action['role'] ?? null;

        if ($userId) {
            $instance->assigned_to_user_id = $userId;
        }
        if ($role) {
            $instance->assigned_to_role = $role;
        }

        $instance->save(false);
    }

    /**
     * Update workflow data field
     */
    protected function updateField($instance, $action)
    {
        $field = $action['field'] ?? null;
        $value = $action['value'] ?? null;

        if ($field && $value !== null) {
            $data = $instance->workflow_data ?? [];
            $data[$field] = $value;
            $instance->workflow_data = $data;
            $instance->save(false);
        }
    }

    /**
     * Call webhook
     */
    protected function callWebhook($action)
    {
        $url = $action['url'] ?? null;
        $payload = $action['payload'] ?? [];

        if ($url) {
            // TODO: Implement HTTP client call
            Yii::info("Would call webhook: {$url}", __METHOD__);
        }
    }
}
