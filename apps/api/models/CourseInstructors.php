<?php

namespace app\models;

use Yii;

/**
 * This is the model class for table "course_instructors".
 *
 * @property int $course_instructor_id
 * @property int $course_id
 * @property int $instructor_id
 *
 * @property Courses $course
 * @property Instructors $instructor
 */
class CourseInstructors extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'course_instructors';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['course_id', 'instructor_id'], 'required'],
            [['course_id', 'instructor_id'], 'integer'],
            [['course_id', 'instructor_id'], 'unique', 'targetAttribute' => ['course_id', 'instructor_id']],
            [['course_id'], 'exist', 'skipOnError' => true, 'targetClass' => Courses::class, 'targetAttribute' => ['course_id' => 'course_id']],
            [['instructor_id'], 'exist', 'skipOnError' => true, 'targetClass' => Instructors::class, 'targetAttribute' => ['instructor_id' => 'instructor_id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'course_instructor_id' => 'Course Instructor ID',
            'course_id' => 'Course ID',
            'instructor_id' => 'Instructor ID',
        ];
    }

    /**
     * Gets query for [[Course]].
     *
     * @return \yii\db\ActiveQuery|CoursesQuery
     */
    public function getCourse()
    {
        return $this->hasOne(Courses::class, ['course_id' => 'course_id']);
    }

    /**
     * Gets query for [[Instructor]].
     *
     * @return \yii\db\ActiveQuery|InstructorsQuery
     */
    public function getInstructor()
    {
        return $this->hasOne(Instructors::class, ['instructor_id' => 'instructor_id']);
    }

    /**
     * {@inheritdoc}
     * @return CourseInstructorsQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new CourseInstructorsQuery(get_called_class());
    }
}
