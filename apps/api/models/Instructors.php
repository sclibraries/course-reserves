<?php

namespace app\models;

use Yii;

/**
 * This is the model class for table "instructors".
 *
 * @property int $instructor_id
 * @property string|null $folio_instructor_id
 * @property string $name
 * @property string|null $barcode
 * @property string $created_at
 *
 * @property CourseInstructors[] $courseInstructors
 * @property Courses[] $courses
 */
class Instructors extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'instructors';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['name'], 'required'],
            [['created_at'], 'safe'],
            [['folio_instructor_id', 'name', 'barcode'], 'string', 'max' => 255],
            [['folio_instructor_id'], 'unique'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'instructor_id' => 'Instructor ID',
            'folio_instructor_id' => 'Folio Instructor ID',
            'name' => 'Name',
            'barcode' => 'Barcode',
            'created_at' => 'Created At',
        ];
    }

    /**
     * Gets query for [[CourseInstructors]].
     *
     * @return \yii\db\ActiveQuery|CourseInstructorsQuery
     */
    public function getCourseInstructors()
    {
        return $this->hasMany(CourseInstructors::class, ['instructor_id' => 'instructor_id']);
    }

    /**
     * Gets query for [[Courses]].
     *
     * @return \yii\db\ActiveQuery|CoursesQuery
     */
    public function getCourses()
    {
        return $this->hasMany(Courses::class, ['course_id' => 'course_id'])->viaTable('course_instructors', ['instructor_id' => 'instructor_id']);
    }

    /**
     * {@inheritdoc}
     * @return InstructorsQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new InstructorsQuery(get_called_class());
    }
}
