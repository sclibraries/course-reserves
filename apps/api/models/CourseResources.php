<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * This is the model class for table "course_resources".
 *
 * @property int $offering_id
 * @property int $resource_id
 * @property int $order
 * @property int|null $folder_id
 * @property string|null $start_visibility
 * @property string|null $end_visibility
 * @property int $use_resource_visibility
 * @property string|null $primary_link_start_visibility
 * @property string|null $primary_link_end_visibility
 * @property int $use_primary_link_visibility
 *
 * @property CourseOfferings $courseOffering
 */
class CourseResources extends ActiveRecord
{
    // Update table name if you renamed the column
    public static function tableName()
    {
        return 'course_resources';
    }

    public function rules()
    {
        return [
            [['offering_id', 'resource_id'], 'required'],
            [['offering_id', 'resource_id', 'order', 'folder_id', 'use_resource_visibility', 'use_primary_link_visibility'], 'integer'],
            [['order'], 'default', 'value' => 999],
            [['use_resource_visibility', 'use_primary_link_visibility'], 'default', 'value' => 0],
            [['start_visibility', 'end_visibility', 'primary_link_start_visibility', 'primary_link_end_visibility'], 'date', 'format' => 'php:Y-m-d'],
            [['created_at'], 'safe'],
            [
                ['offering_id'],
                'exist',
                'skipOnError' => true,
                'targetClass' => CourseOfferings::class,
                'targetAttribute' => ['offering_id' => 'offering_id']
            ],
        ];
    }

    public function attributeLabels()
    {
        return [
            'offering_id' => 'Course Offering ID',
            'resource_id' => 'Resource ID',
            'order' => 'Display Order',
            'folder_id' => 'Folder',
            'start_visibility' => 'Start Visibility Date',
            'end_visibility' => 'End Visibility Date',
            'use_resource_visibility' => 'Use Resource Visibility',
            'primary_link_start_visibility' => 'Primary Link Start Visibility',
            'primary_link_end_visibility' => 'Primary Link End Visibility',
            'use_primary_link_visibility' => 'Use Primary Link Visibility',
        ];
    }

    public function getCourseOffering()
    {
        return $this->hasOne(CourseOfferings::class, ['offering_id' => 'offering_id']);
    }

    public function getResource()
    {
        return $this->hasOne(Resources::class, ['resource_id' => 'resource_id']);
    }

    public function getFolder()
    {
        return $this->hasOne(Folder::class, ['folder_id' => 'folder_id']);
    }
}
