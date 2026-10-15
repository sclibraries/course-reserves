<?php

namespace app\models;

use yii\db\ActiveRecord;

/**
 * Faculty proxy activity log entry.
 */
class FacultyProxyActivityLog extends ActiveRecord
{
    public static function tableName()
    {
        return 'faculty_proxy_activity_log';
    }

    public function rules()
    {
        return [
            [['faculty_shibboleth_id', 'proxy_shibboleth_id', 'action'], 'required'],
            [['submission_id'], 'integer'],
            [['details'], 'string'],
            [['created_at'], 'safe'],
            [['faculty_shibboleth_id', 'proxy_shibboleth_id'], 'string', 'max' => 255],
            [['action'], 'string', 'max' => 100],
        ];
    }

    public function getDetailsDecoded()
    {
        return $this->details ? json_decode($this->details, true) : null;
    }
}
