<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * This is the model class for table "course_assignments".
 *
 * @property string $academic_period
 * @property string $course_id
 * @property string $course_title
 * @property string $smith_id
 * @property string $role
 * @property string $created_at
 * @property string $updated_at
 */
class CourseAssignments extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'course_assignments';
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['academic_period', 'course_id', 'course_title', 'smith_id', 'role'], 'required'],
            [['created_at', 'updated_at'], 'safe'],
            [['academic_period'], 'string', 'max' => 20],
            [['course_id'], 'string', 'max' => 50],
            [['course_title'], 'string', 'max' => 500],
            [['smith_id'], 'string', 'max' => 20],
            [['role'], 'string', 'max' => 50],
            [['academic_period', 'course_id', 'smith_id'], 'unique', 'targetAttribute' => ['academic_period', 'course_id', 'smith_id']],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'academic_period' => 'Academic Period',
            'course_id' => 'Course ID',
            'course_title' => 'Course Title',
            'smith_id' => 'Smith ID',
            'role' => 'Role',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
        ];
    }

    /**
     * Behaviors for auto-updating timestamps
     */
    public function behaviors()
    {
        return [
            [
                'class' => \yii\behaviors\TimestampBehavior::class,
                'createdAtAttribute' => 'created_at',
                'updatedAtAttribute' => 'updated_at',
                'value' => new \yii\db\Expression('NOW()'),
            ],
        ];
    }
}
