<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * SubmissionCommunicationRead model
 * Tracks read receipts for messages
 *
 * @property int $id
 * @property int $communication_id
 * @property string $reader_type
 * @property string $reader_id
 * @property string $reader_name
 * @property string $read_at
 */
class SubmissionCommunicationRead extends ActiveRecord
{
    public static function tableName()
    {
        return 'submission_communication_reads';
    }

    public function rules()
    {
        return [
            [['communication_id', 'reader_type', 'reader_id'], 'required'],
            [['communication_id'], 'integer'],
            [['read_at'], 'safe'],
            [['reader_type'], 'string', 'max' => 32],
            [['reader_id', 'reader_name'], 'string', 'max' => 255],
        ];
    }

    public function getCommunication()
    {
        return $this->hasOne(SubmissionCommunication::class, ['id' => 'communication_id']);
    }
}
