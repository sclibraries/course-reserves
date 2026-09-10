<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * This is the model class for table "course_offerings".
 *
 * @property int $offering_id
 * @property int $course_id
 * @property string $term_id
 * @property string $term_name
 * @property string|null $start_date
 * @property string|null $end_date
 * @property string $status
 * @property string $created_at
 *
 * @property Courses $course
 */
class CourseOfferings extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'course_offerings';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['course_id', 'term_id', 'term_name'], 'required'],
            [['course_id'], 'integer'],
            [['folio_course_id'], 'unique'],
            [['start_date', 'end_date', 'created_at'], 'safe'],
            [['status'], 'in', 'range' => ['active', 'inactive']],
            [['folio_course_id','term_id', 'term_name'], 'string', 'max' => 255],
            [['status'], 'default', 'value' => 'active'],
            [
                ['course_id'], 
                'exist', 
                'skipOnError' => true, 
                'targetClass' => Courses::class, 
                'targetAttribute' => ['course_id' => 'course_id']
            ],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'offering_id' => 'Offering ID',
            'course_id' => 'Course ID',
            'term_id' => 'Term ID',
            'term_name' => 'Term Name',
            'start_date' => 'Start Date',
            'end_date' => 'End Date',
            'status' => 'Status',
            'created_at' => 'Created At',
        ];
    }

    /**
     * Gets query for [[Course]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getCourse()
    {
        return $this->hasOne(Courses::class, ['course_id' => 'course_id']);
    }
}
