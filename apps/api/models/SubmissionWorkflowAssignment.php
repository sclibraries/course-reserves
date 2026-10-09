<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;
use yii\behaviors\TimestampBehavior;

/**
 * SubmissionWorkflowAssignment model
 *
 * @property int $assignment_id
 * @property int $submission_id
 * @property int $assigned_staff_user_id
 * @property string $assignment_type
 * @property string $status
 * @property string $locked_at
 * @property string $due_date
 * @property string $staff_notes
 * @property string $created_at
 * @property string $updated_at
 */
class SubmissionWorkflowAssignment extends ActiveRecord
{
    const ASSIGNMENT_FULL_COURSE = 'full_course';
    const ASSIGNMENT_INDIVIDUAL_ITEMS = 'individual_items';
    
    const STATUS_ASSIGNED = 'assigned';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_COMPLETED = 'completed';
    const STATUS_ON_HOLD = 'on_hold';

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'submission_workflow_assignments';
    }

    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        return [
            [
                'class' => TimestampBehavior::class,
                'createdAtAttribute' => 'created_at',
                'updatedAtAttribute' => 'updated_at',
                'value' => function() {
                    return date('Y-m-d H:i:s');
                }
            ]
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['submission_id', 'assigned_staff_user_id', 'assignment_type'], 'required'],
            [['submission_id', 'assigned_staff_user_id'], 'integer'],
            [['staff_notes'], 'string'],
            [['locked_at', 'due_date', 'created_at', 'updated_at'], 'safe'],
            [['assignment_type'], 'in', 'range' => [self::ASSIGNMENT_FULL_COURSE, self::ASSIGNMENT_INDIVIDUAL_ITEMS]],
            [['status'], 'in', 'range' => [self::STATUS_ASSIGNED, self::STATUS_IN_PROGRESS, self::STATUS_COMPLETED, self::STATUS_ON_HOLD]],
            [['status'], 'default', 'value' => self::STATUS_ASSIGNED],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'assignment_id' => 'Assignment ID',
            'submission_id' => 'Submission ID',
            'assigned_staff_user_id' => 'Assigned Staff User ID',
            'assignment_type' => 'Assignment Type',
            'status' => 'Status',
            'locked_at' => 'Locked At',
            'due_date' => 'Due Date',
            'staff_notes' => 'Staff Notes',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
        ];
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getSubmission()
    {
        return $this->hasOne(FacultySubmission::class, ['submission_id' => 'submission_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getAssignedStaff()
    {
        return $this->hasOne(User::class, ['id' => 'assigned_staff_user_id']);
    }

    /**
     * Lock assignment to current timestamp
     */
    public function lockAssignment()
    {
        $this->locked_at = date('Y-m-d H:i:s');
        $this->status = self::STATUS_IN_PROGRESS;
        return $this->save();
    }
}