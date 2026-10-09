<?php

namespace app\models;

use Yii;
use Ramsey\Uuid\Uuid;

/**
 * This is the model class for table "courses".
 *
 * @property int $course_id
 * @property string|null $folio_course_id
 * @property string $course_name
 * @property string $course_number
 * @property string|null $department_id
 * @property string|null $department_name
 * @property string|null $term_id
 * @property string|null $term_name
 * @property string|null $location_id
 * @property string|null $location_name
 * @property string $created_at
 *
 * @property CourseInstructors[] $courseInstructors
 * @property CourseResources[] $courseResources
 * @property Instructors[] $instructors
 * @property Resources[] $resources
 */
class Courses extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'courses';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['course_name', 'course_number'], 'required'],
            [['created_at'], 'safe'],
            [['course_name'], 'string', 'max' => 1025],
            [['department_name', 'location_name'], 'string', 'max' => 255],
            [['department_id', 'location_id'], 'string', 'max' => 255],
            [['course_number'], 'string', 'max' => 50],
            [['permanent_course_uuid'], 'unique'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'course_id' => 'Course ID',
            'course_name' => 'Course Name',
            'course_number' => 'Course Number',
            'department_id' => 'Department ID',
            'department_name' => 'Department Name',
            'location_id' => 'Location ID',
            'location_name' => 'Location Name',
            'created_at' => 'Created At',
        ];
    }

    public function beforeSave($insert)
    {
        if (parent::beforeSave($insert)) {
            if ($insert && empty($this->permanent_course_uuid)) {
                $this->permanent_course_uuid = Uuid::uuid4()->toString();
            }
            return true;
        }
        return false;
    }

    public function fields()
    {
        return array_merge(parent::fields(), ['permanent_course_uuid']);
    }

    /**
     * Gets query for [[CourseOfferings]].
     *
     * @return \yii\db\ActiveQuery
     */
    public function getCourseOfferings()
    {
        return $this->hasMany(CourseOfferings::class, ['course_id' => 'course_id']);
    }

    /**
     * Gets query for [[CourseInstructors]].
     *
     * @return \yii\db\ActiveQuery|CourseInstructorsQuery
     */
    public function getCourseInstructors()
    {
        return $this->hasMany(CourseInstructors::class, ['course_id' => 'course_id']);
    }

    /**
     * Gets query for [[CourseResources]].
     *
     * @return \yii\db\ActiveQuery|CourseResourcesQuery
     */
    public function getCourseResources()
    {
        return $this->hasMany(CourseResources::class, ['course_id' => 'course_id']);
    }

    /**
     * Gets query for [[Instructors]].
     *
     * @return \yii\db\ActiveQuery|InstructorsQuery
     */
    public function getInstructors()
    {
        return $this->hasMany(Instructors::class, ['instructor_id' => 'instructor_id'])->viaTable('course_instructors', ['course_id' => 'course_id']);
    }

    /**
     * Gets query for [[Resources]].
     *
     * @return \yii\db\ActiveQuery|ResourcesQuery
     */
    public function getResources()
    {
        return $this->hasMany(Resources::class, ['resource_id' => 'resource_id'])->viaTable('course_resources', ['course_id' => 'course_id']);
    }

    /**
     * {@inheritdoc}
     * @return CoursesQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new CoursesQuery(get_called_class());
    }
}
