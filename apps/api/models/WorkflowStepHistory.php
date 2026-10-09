<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * WorkflowStepHistory model
 *
 * @property int $id
 * @property int $instance_id
 * @property int $step_id
 * @property string $step_key
 * @property string $status (started|completed|skipped|failed|blocked|reverted|assigned)
 * @property string $result_data JSON
 * @property string $condition_results JSON
 * @property string $notes
 * @property string $error_code
 * @property string $completed_by_user_id
 * @property string $completed_by_name
 * @property string $actor_type (user|automation|system)
 * @property string $started_at
 * @property string $completed_at
 * @property int $duration_minutes
 * @property string $created_at
 *
 * @property WorkflowInstance $instance
 * @property WorkflowStep $step
 */
class WorkflowStepHistory extends ActiveRecord
{
    const STATUS_STARTED = 'started';
    const STATUS_COMPLETED = 'completed';
    const STATUS_SKIPPED = 'skipped';
    const STATUS_FAILED = 'failed';
    const STATUS_REVERTED = 'reverted';
    const STATUS_BLOCKED = 'blocked';
    const STATUS_ASSIGNED = 'assigned';

    public static function tableName()
    {
        return 'workflow_step_history';
    }

    public function rules()
    {
        return [
            [['instance_id', 'step_id', 'step_key', 'status'], 'required'],
            [['instance_id', 'step_id', 'duration_minutes'], 'integer'],
            [['step_key'], 'string', 'max' => 100],
            [['status'], 'in', 'range' => [
                self::STATUS_STARTED,
                self::STATUS_COMPLETED,
                self::STATUS_SKIPPED,
                self::STATUS_FAILED,
                self::STATUS_REVERTED,
                self::STATUS_BLOCKED,
                self::STATUS_ASSIGNED,
            ]],
            [['notes'], 'string'],
            [['error_code'], 'string', 'max' => 100],
            [['completed_by_user_id', 'completed_by_name'], 'string', 'max' => 255],
            [['actor_type'], 'in', 'range' => ['user', 'automation', 'system']],
            [['started_at', 'completed_at'], 'safe'],
            [['result_data', 'condition_results'], 'safe'],
        ];
    }

    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'instance_id' => 'Instance',
            'step_id' => 'Step',
            'step_key' => 'Step Key',
            'status' => 'Status',
            'completed_by_user_id' => 'Completed By',
            'actor_type' => 'Actor Type',
            'duration_minutes' => 'Duration (min)',
            'created_at' => 'Created At',
        ];
    }

    /**
     * Gets query for [[WorkflowInstance]].
     */
    public function getInstance()
    {
        return $this->hasOne(WorkflowInstance::class, ['id' => 'instance_id']);
    }

    /**
     * Gets query for [[WorkflowStep]].
     */
    public function getStep()
    {
        return $this->hasOne(WorkflowStep::class, ['id' => 'step_id']);
    }

    /**
     * Parse JSON fields after find
     */
    public function afterFind()
    {
        parent::afterFind();
        if ($this->result_data && is_string($this->result_data)) {
            $this->result_data = json_decode($this->result_data, true);
        }
        if ($this->condition_results && is_string($this->condition_results)) {
            $this->condition_results = json_decode($this->condition_results, true);
        }
    }

    /**
     * Encode JSON fields before save
     */
    public function beforeSave($insert)
    {
        if (parent::beforeSave($insert)) {
            if (is_array($this->result_data)) {
                $encoded = json_encode($this->result_data);
                if ($encoded === false) {
                    throw new \Exception('Invalid result_data: ' . json_last_error_msg());
                }
                $this->result_data = $encoded;
            }
            if (is_array($this->condition_results)) {
                $encoded = json_encode($this->condition_results);
                if ($encoded === false) {
                    throw new \Exception('Invalid condition_results: ' . json_last_error_msg());
                }
                $this->condition_results = $encoded;
            }
            if ($this->actor_type === null) {
                $this->actor_type = 'user';
            }
            return true;
        }
        return false;
    }
}
