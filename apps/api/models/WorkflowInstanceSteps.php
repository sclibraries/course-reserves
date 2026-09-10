<?php
namespace app\models;

use yii\db\ActiveRecord;

/**
 * Checklist row representing an instance/step pairing.
 *
 * @property int $id
 * @property int $instance_id
 * @property int $step_id
 * @property string $status
 * @property string $blocked_reason
 * @property string $skip_reason
 * @property string $assigned_to_user_id
 * @property string $assigned_to_role
 * @property string $started_at
 * @property string $completed_at
 * @property int $version
 * @property string $created_at
 * @property string $updated_at
 *
 * @property WorkflowInstance $instance
 * @property WorkflowStep $step
 */
class WorkflowInstanceSteps extends ActiveRecord
{
    const STATUS_NOT_STARTED = 'not_started';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_BLOCKED = 'blocked';
    const STATUS_SKIPPED = 'skipped';
    const STATUS_COMPLETED = 'completed';

    public static function tableName()
    {
        return 'workflow_instance_steps';
    }

    public function rules()
    {
        return [
            [['instance_id', 'step_id'], 'required'],
            [['instance_id', 'step_id', 'version'], 'integer'],
            [['status'], 'in', 'range' => [
                self::STATUS_NOT_STARTED,
                self::STATUS_IN_PROGRESS,
                self::STATUS_BLOCKED,
                self::STATUS_SKIPPED,
                self::STATUS_COMPLETED,
            ]],
            [['blocked_reason', 'skip_reason'], 'string'],
            [['started_at', 'completed_at'], 'safe'],
            [['assigned_to_user_id'], 'string', 'max' => 255],
            [['assigned_to_role'], 'string', 'max' => 100],
        ];
    }

    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'instance_id' => 'Instance',
            'step_id' => 'Step',
            'status' => 'Status',
            'assigned_to_user_id' => 'Assigned To User',
            'assigned_to_role' => 'Assigned Role',
        ];
    }

    public function getInstance()
    {
        return $this->hasOne(WorkflowInstance::class, ['id' => 'instance_id']);
    }

    public function getStep()
    {
        return $this->hasOne(WorkflowStep::class, ['id' => 'step_id']);
    }

    public function beforeValidate()
    {
        if ($this->status === null) {
            $this->status = self::STATUS_NOT_STARTED;
        }
        if ($this->version === null) {
            $this->version = 0;
        }
        return parent::beforeValidate();
    }
}
