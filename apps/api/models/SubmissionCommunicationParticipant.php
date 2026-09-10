<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * SubmissionCommunicationParticipant model
 * Tracks participants/watchers in communication threads
 *
 * @property int $id
 * @property int $communication_id
 * @property string $participant_type
 * @property string $participant_id
 * @property string $participant_name
 * @property string $participant_email
 * @property string $role
 * @property string $notification_preference
 * @property int $is_muted
 * @property string $last_read_at
 * @property string $added_at
 */
class SubmissionCommunicationParticipant extends ActiveRecord
{
    const ROLE_SENDER = 'sender';
    const ROLE_RECIPIENT = 'recipient';
    const ROLE_WATCHER = 'watcher';
    const ROLE_ASSIGNEE = 'assignee';
    
    const NOTIFY_ALL = 'all';
    const NOTIFY_MENTIONS = 'mentions';
    const NOTIFY_NONE = 'none';

    public static function tableName()
    {
        return 'submission_communication_participants';
    }

    public function rules()
    {
        return [
            [['communication_id', 'participant_type', 'participant_id'], 'required'],
            [['communication_id', 'is_muted'], 'integer'],
            [['last_read_at', 'added_at'], 'safe'],
            [['participant_type', 'role', 'notification_preference'], 'string', 'max' => 32],
            [['participant_id', 'participant_name', 'participant_email'], 'string', 'max' => 255],
            [['role'], 'default', 'value' => self::ROLE_WATCHER],
            [['notification_preference'], 'default', 'value' => self::NOTIFY_ALL],
            [['is_muted'], 'default', 'value' => 0],
        ];
    }

    public function getCommunication()
    {
        return $this->hasOne(SubmissionCommunication::class, ['id' => 'communication_id']);
    }
}
