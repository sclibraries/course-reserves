<?php

namespace app\models;

use yii\db\ActiveRecord;

class PublicationDestination extends ActiveRecord
{
    public static function tableName()
    {
        return 'publication_destinations';
    }

    public function rules()
    {
        return [
            [['destination_kind', 'origin_offering_id', 'ownership_source'], 'required'],
            [['course_resource_id', 'physical_reference_id', 'offering_id', 'origin_offering_id', 'owner_item_id', 'owner_live'], 'integer'],
            [['destination_kind'], 'in', 'range' => ['electronic', 'physical']],
            [['owner_item_kind'], 'in', 'range' => ['new', 'reuse']],
            [['ownership_source'], 'in', 'range' => ['published', 'released', 'none']],
            [['retired_at', 'created_at', 'updated_at'], 'safe'],
        ];
    }

    public function getAttachments()
    {
        return $this->hasMany(PublicationAttachment::class, ['destination_id' => 'id']);
    }
}
