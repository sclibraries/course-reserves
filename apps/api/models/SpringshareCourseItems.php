<?php

namespace app\models;

use Yii;

/**
 * This is the model class for table "springshare_course_items".
 *
 * @property int $id
 * @property string $course_identifier
 * @property string|null $item_name
 * @property string|null $item_description
 * @property string|null $permalink
 * @property string|null $created_at
 */
class SpringshareCourseItems extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'springshare_course_items';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['course_identifier'], 'required'],
            [['item_description', 'permalink'], 'string'],
            [['created_at'], 'safe'],
            [['course_identifier', 'item_name'], 'string', 'max' => 255],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'course_identifier' => 'Course Identifier',
            'item_name' => 'Item Name',
            'item_description' => 'Item Description',
            'permalink' => 'Permalink',
            'created_at' => 'Created At',
        ];
    }

    /**
     * {@inheritdoc}
     * @return SpringshareCourseItemsQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new SpringshareCourseItemsQuery(get_called_class());
    }
}
