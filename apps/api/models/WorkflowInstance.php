<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;
use app\models\WorkflowInstanceSteps;
use app\services\WorkflowProgress;

/**
 * WorkflowInstance model
 *
 * @property int $id
 * @property int $template_id
 * @property int $template_version
 * @property string $entity_type (course|item)
 * @property int $entity_id
 * @property int $submission_id
 * @property int $current_step_id
 * @property string $status (not_started|in_progress|completed|cancelled|on_hold)
 * @property float $progress_percentage
 * @property string $assigned_to_user_id
 * @property string $assigned_to_role
 * @property string $started_at
 * @property string $completed_at
 * @property string $due_date
 * @property string $priority (low|normal|high|urgent)
 * @property string $workflow_data JSON
 * @property string $metadata JSON
 * @property string $progress_mode (all_steps|required_only)
 * @property string $created_at
 * @property string $updated_at
 *
 * @property WorkflowTemplate $template
 * @property WorkflowStep $currentStep
 * @property WorkflowStepHistory[] $history
 */
class WorkflowInstance extends ActiveRecord
{
    const STATUS_NOT_STARTED = 'not_started';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_COMPLETED = 'completed';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_ON_HOLD = 'on_hold';

    const PRIORITY_LOW = 'low';
    const PRIORITY_NORMAL = 'normal';
    const PRIORITY_HIGH = 'high';
    const PRIORITY_URGENT = 'urgent';

    public static function tableName()
    {
        return 'workflow_instances';
    }

    public function rules()
    {
        return [
            [['template_id', 'template_version', 'entity_type', 'entity_id'], 'required'],
            [['template_id', 'template_version', 'entity_id', 'submission_id', 'current_step_id'], 'integer'],
            [['entity_type'], 'in', 'range' => ['course', 'item']],
            [['status'], 'in', 'range' => [
                self::STATUS_NOT_STARTED,
                self::STATUS_IN_PROGRESS,
                self::STATUS_COMPLETED,
                self::STATUS_CANCELLED,
                self::STATUS_ON_HOLD
            ]],
            [['priority'], 'in', 'range' => [
                self::PRIORITY_LOW,
                self::PRIORITY_NORMAL,
                self::PRIORITY_HIGH,
                self::PRIORITY_URGENT
            ]],
            [['progress_percentage'], 'number', 'min' => 0, 'max' => 100],
            [['progress_mode'], 'in', 'range' => ['all_steps', 'required_only']],
            [['assigned_to_user_id'], 'string', 'max' => 255],
            [['assigned_to_role'], 'string', 'max' => 100],
            [['started_at', 'completed_at', 'due_date'], 'safe'],
            [['workflow_data', 'metadata'], 'safe'],
        ];
    }

    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'template_id' => 'Template',
            'entity_type' => 'Entity Type',
            'entity_id' => 'Entity ID',
            'submission_id' => 'Submission',
            'current_step_id' => 'Current Step',
            'status' => 'Status',
            'progress_percentage' => 'Progress',
            'progress_mode' => 'Progress Mode',
            'assigned_to_user_id' => 'Assigned To',
            'priority' => 'Priority',
            'started_at' => 'Started',
            'completed_at' => 'Completed',
            'due_date' => 'Due Date',
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
     * Gets query for [[WorkflowStep]].
     */
    public function getCurrentStep()
    {
        return $this->hasOne(WorkflowStep::class, ['id' => 'current_step_id']);
    }

    /**
     * Checklist rows for each step in the instance.
     */
    public function getInstanceSteps()
    {
        return $this->hasMany(WorkflowInstanceSteps::class, ['instance_id' => 'id'])
            ->joinWith('step')
            ->orderBy(['workflow_steps.sequence_order' => SORT_ASC]);
    }

    /**
     * Gets query for [[WorkflowStepHistory]].
     */
    public function getHistory()
    {
        return $this->hasMany(WorkflowStepHistory::class, ['instance_id' => 'id'])
            ->orderBy(['created_at' => SORT_ASC]);
    }

    /**
     * Parse JSON fields after find
     */
    public function afterFind()
    {
        parent::afterFind();
        if ($this->workflow_data && is_string($this->workflow_data)) {
            $decoded = json_decode($this->workflow_data, true);
            $this->workflow_data = $decoded !== null ? $decoded : $this->workflow_data;
        }
        if ($this->metadata && is_string($this->metadata)) {
            $decoded = json_decode($this->metadata, true);
            $this->metadata = $decoded !== null ? $decoded : $this->metadata;
        }
    }

    /**
     * Encode JSON fields before save
     */
    public function beforeSave($insert)
    {
        if (parent::beforeSave($insert)) {
            if (is_array($this->workflow_data)) {
                $this->workflow_data = json_encode($this->workflow_data);
            }
            if (is_array($this->metadata)) {
                $this->metadata = json_encode($this->metadata);
            }
            return true;
        }
        return false;
    }

    /**
     * Start the workflow
     */
    public function start()
    {
        if ($this->status !== self::STATUS_NOT_STARTED) {
            throw new \Exception('Workflow already started');
        }

        $firstStep = $this->template->firstStep;
        if (!$firstStep) {
            throw new \Exception('No steps defined in workflow template');
        }

        $this->current_step_id = $firstStep->id;
        $this->status = self::STATUS_IN_PROGRESS;
        $this->started_at = date('Y-m-d H:i:s');
        $this->progress_percentage = 0;

        if ($this->save()) {
            // Log history
            $this->logStepHistory($firstStep, 'started');
            return true;
        }

        return false;
    }

    /**
     * Complete current step and move to next
     */
    public function completeStep($stepData = [], $conditionResults = [])
    {
        if (!$this->current_step_id) {
            throw new \Exception('No current step');
        }

        $currentStep = $this->currentStep;
        if (!$currentStep) {
            throw new \Exception('Current step not found');
        }

        // Save step data to workflow_data
        $workflowData = $this->workflow_data ?? [];
        $workflowData[$currentStep->step_key] = $stepData;
        $this->workflow_data = $workflowData;

        // Log step completion
        $user = Yii::$app->user->identity;
        $this->logStepHistory($currentStep, 'completed', $stepData, $conditionResults, $user);

        // Get next step based on conditions
        $nextStep = $currentStep->getNextStep($conditionResults);

        if ($nextStep) {
            // Move to next step
            $this->current_step_id = $nextStep->id;
            $this->assigned_to_role = $nextStep->assigned_role;
            $this->logStepHistory($nextStep, 'started');
        } else {
            // Workflow complete
            $this->current_step_id = null;
            $this->status = self::STATUS_COMPLETED;
            $this->completed_at = date('Y-m-d H:i:s');
            $this->progress_percentage = 100;
        }

        // Update progress
        $this->updateProgress();

        return $this->save();
    }

    /**
     * Update progress percentage
     */
    protected function updateProgress()
    {
        if ($this->progress_mode === 'all_steps') {
            $allRows = $this->getInstanceSteps()->count();
            if ($allRows === 0) {
                $this->progress_percentage = 0;
                return;
            }

            $completed = WorkflowInstanceSteps::find()
                ->where(['instance_id' => $this->id, 'status' => WorkflowInstanceSteps::STATUS_COMPLETED])
                ->count();

            $this->progress_percentage = $allRows > 0 ? ($completed / $allRows) * 100 : 0;
            return;
        }

        $this->progress_percentage = WorkflowProgress::computeRequiredOnly($this->id);
    }

    /**
     * Log step history
     */
    protected function logStepHistory($step, $status, $resultData = [], $conditionResults = [], $user = null)
    {
        $history = new WorkflowStepHistory();
        $history->instance_id = $this->id;
        $history->step_id = $step->id;
        $history->step_key = $step->step_key;
        $history->status = $status;
        $history->result_data = $resultData;
        $history->condition_results = $conditionResults;

        if ($user) {
            $history->completed_by_user_id = (string)$user->id;
            $history->completed_by_name = $user->full_name ?? $user->username;
        }

        if ($status === 'started') {
            $history->started_at = date('Y-m-d H:i:s');
        } elseif ($status === 'completed') {
            $history->completed_at = date('Y-m-d H:i:s');
            
            // Calculate duration if we have a started entry
            $startedEntry = WorkflowStepHistory::findOne([
                'instance_id' => $this->id,
                'step_id' => $step->id,
                'status' => 'started'
            ]);
            
            if ($startedEntry && $startedEntry->started_at) {
                $start = new \DateTime($startedEntry->started_at);
                $end = new \DateTime($history->completed_at);
                $history->duration_minutes = $end->diff($start)->i;
            }
        }

        $history->save();
    }

    /**
     * Skip current step
     */
    public function skipStep($reason = '')
    {
        if (!$this->current_step_id) {
            throw new \Exception('No current step');
        }

        $currentStep = $this->currentStep;
        $user = Yii::$app->user->identity;

        // Log as skipped
        $history = new WorkflowStepHistory();
        $history->instance_id = $this->id;
        $history->step_id = $currentStep->id;
        $history->step_key = $currentStep->step_key;
        $history->status = 'skipped';
        $history->notes = $reason;
        if ($user) {
            $history->completed_by_user_id = (string)$user->id;
            $history->completed_by_name = $user->full_name ?? $user->username;
        }
        $history->save();

        // Get next step (using default transition)
        $nextStep = $currentStep->getNextStep([]);

        if ($nextStep) {
            $this->current_step_id = $nextStep->id;
            $this->assigned_to_role = $nextStep->assigned_role;
            $this->logStepHistory($nextStep, 'started');
        } else {
            // No more steps
            $this->current_step_id = null;
            $this->status = self::STATUS_COMPLETED;
            $this->completed_at = date('Y-m-d H:i:s');
        }

        $this->updateProgress();
        return $this->save();
    }

    /**
     * Cancel workflow
     */
    public function cancel($reason = '')
    {
        $this->status = self::STATUS_CANCELLED;
        $metadata = $this->metadata ?? [];
        $metadata['cancellation_reason'] = $reason;
        $metadata['cancelled_at'] = date('Y-m-d H:i:s');
        $metadata['cancelled_by'] = Yii::$app->user->identity->id ?? null;
        $this->metadata = $metadata;
        
        return $this->save();
    }

    /**
     * Put workflow on hold
     */
    public function putOnHold($reason = '')
    {
        $this->status = self::STATUS_ON_HOLD;
        $metadata = $this->metadata ?? [];
        $metadata['hold_reason'] = $reason;
        $metadata['held_at'] = date('Y-m-d H:i:s');
        $this->metadata = $metadata;
        
        return $this->save();
    }

    /**
     * Resume workflow from hold
     */
    public function resume()
    {
        if ($this->status !== self::STATUS_ON_HOLD) {
            throw new \Exception('Workflow is not on hold');
        }

        $this->status = self::STATUS_IN_PROGRESS;
        $metadata = $this->metadata ?? [];
        $metadata['resumed_at'] = date('Y-m-d H:i:s');
        $this->metadata = $metadata;
        
        return $this->save();
    }
}
