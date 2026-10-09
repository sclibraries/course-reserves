<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * SubmissionCommunicationActivity model
 * Activity/audit log for communication actions
 *
 * @property int $id
 * @property int $communication_id
 * @property string $actor_type
 * @property string $actor_id
 * @property string $actor_name
 * @property string $action
 * @property string $action_data
 * @property string $created_at
 */
class SubmissionCommunicationActivity extends ActiveRecord
{
    public static function tableName()
    {
        return 'submission_communication_activity';
    }

    public function rules()
    {
        return [
            [['communication_id', 'actor_type', 'actor_id', 'action'], 'required'],
            [['communication_id'], 'integer'],
            [['action_data'], 'string'],
            [['created_at'], 'safe'],
            [['actor_type'], 'string', 'max' => 32],
            [['actor_id', 'actor_name'], 'string', 'max' => 255],
            [['action'], 'string', 'max' => 64],
        ];
    }

    public function getCommunication()
    {
        return $this->hasOne(SubmissionCommunication::class, ['id' => 'communication_id']);
    }
    
    public function getActionDataArray()
    {
        return $this->action_data ? json_decode($this->action_data, true) : [];
    }
}
