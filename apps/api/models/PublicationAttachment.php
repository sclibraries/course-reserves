<?php

namespace app\models;

use yii\db\ActiveRecord;

class PublicationAttachment extends ActiveRecord
{
    public static function tableName()
    {
        return 'publication_attachments';
    }

    public function rules()
    {
        return [
            [['destination_id', 'item_kind', 'item_id', 'attached_snapshot_json'], 'required'],
            [['destination_id', 'item_id', 'live'], 'integer'],
            [['attached_snapshot_json'], 'string'],
            [['item_kind'], 'in', 'range' => ['new', 'reuse']],
            [['attached_at', 'updated_at', 'detached_at'], 'safe'],
        ];
    }

    public function getDestination()
    {
        return $this->hasOne(PublicationDestination::class, ['id' => 'destination_id']);
    }
}
