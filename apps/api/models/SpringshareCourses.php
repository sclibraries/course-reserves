<?php

namespace app\models;

use Yii;

/**
 * This is the model class for table "springshare_courses".
 *
 * @property int $id
 * @property string $course_identifier
 * @property string|null $course_title
 * @property string|null $creators
 * @property string|null $subjects
 * @property string|null $publisher
 * @property string|null $coverage
 * @property string|null $date
 * @property string|null $course_url
 * @property string|null $course_code
 * @property string|null $last_updated
 */
class SpringshareCourses extends \yii\db\ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'springshare_courses';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['course_identifier'], 'required'],
            [['creators', 'subjects'], 'string'],
            [['date', 'last_updated'], 'safe'],
            [['course_identifier', 'course_title', 'publisher', 'coverage', 'course_url'], 'string', 'max' => 255],
            [['course_code'], 'string', 'max' => 100],
            [['course_identifier'], 'unique'],
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
            'course_title' => 'Course Title',
            'creators' => 'Creators',
            'subjects' => 'Subjects',
            'publisher' => 'Publisher',
            'coverage' => 'Coverage',
            'date' => 'Date',
            'course_url' => 'Course Url',
            'course_code' => 'Course Code',
            'last_updated' => 'Last Updated',
        ];
    }

    /**
     * {@inheritdoc}
     * @return SpringshareCoursesQuery the active query used by this AR class.
     */
    public static function find()
    {
        return new SpringshareCoursesQuery(get_called_class());
    }
}
