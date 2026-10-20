<?php

namespace app\models;

use Yii;
use app\services\SubmissionConfirmationState;
use yii\db\ActiveRecord;
use yii\behaviors\TimestampBehavior;

/**
 * FacultySubmission model
 *
 * @property int $submission_id
 * @property string $submission_uuid
 * @property string $shibboleth_user_id
 * @property string $proxy_shibboleth_user_id
 * @property string $term_code
 * @property string $course_code
 * @property string $section
 * @property string $course_title
 * @property string $its_course_id
 * @property string $academic_period
 * @property string $roster_term_id
 * @property string $folio_course_listing_id
 * @property int $offering_id
 * @property string $needed_by_date
 * @property string $status
 * @property string $submission_notes
 * @property string $faculty_display_name
 * @property string $proxy_display_name
 * @property string $assignee_staff_user_id
 * @property int $email_confirmation_sent
 * @property int $is_duplicate_previous
 * @property string $duplicate_note
 * @property int $is_locked
 * @property string $locked_at
 * @property string $locked_by_staff_id
 * @property string $lock_reason
 * @property string $created_at
 * @property string $updated_at
 * @property string $submitted_at
 * @property string $email_confirmation_status
 * @property string $email_confirmation_requested_at
 * @property string $email_confirmation_queued_at
 * @property string $email_confirmation_sent_at
 * @property string $email_confirmation_failed_at
 * @property string $email_confirmation_error_at
 * @property string $email_confirmation_error
 * @property int $email_confirmation_legacy_sent
 */
class FacultySubmission extends ActiveRecord
{
    const STATUS_DRAFT = 'draft';
    const STATUS_SUBMITTED = 'submitted';
    const STATUS_IN_REVIEW = 'in_review';
    const STATUS_PARTIALLY_COMPLETE = 'partially_complete';
    const STATUS_COMPLETE = 'complete';
    const STATUS_CANCELED = 'canceled';

    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'faculty_submissions';
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
            [['shibboleth_user_id', 'term_code', 'course_code', 'course_title'], 'required'],
            [['submission_notes', 'faculty_display_name', 'proxy_display_name', 'duplicate_note', 'lock_reason'], 'string'],
            [['needed_by_date', 'locked_at'], 'date'],
            [['created_at', 'updated_at', 'submitted_at'], 'safe'],
            [['email_confirmation_sent', 'is_duplicate_previous', 'is_locked', 'offering_id'], 'integer'],
            [['email_confirmation_status'], 'string', 'max' => 32],
            [['email_confirmation_status'], 'in', 'range' => SubmissionConfirmationState::allowedStatuses()],
            [['email_confirmation_status'], 'default', 'value' => SubmissionConfirmationState::NOT_REQUESTED],
            [['submission_uuid'], 'string', 'max' => 36],
            [['shibboleth_user_id', 'proxy_shibboleth_user_id', 'folio_course_listing_id', 'faculty_display_name', 'proxy_display_name', 'assignee_staff_user_id', 'locked_by_staff_id'], 'string', 'max' => 255],
            [['term_code'], 'string', 'max' => 32],
            [['its_course_id', 'roster_term_id'], 'string', 'max' => 64],
            [['academic_period'], 'string', 'max' => 16],
            [['course_code'], 'string', 'max' => 64],
            [['section'], 'string', 'max' => 16],
            [['course_title'], 'string', 'max' => 500],
            [['status'], 'string'],
            [['status'], 'in', 'range' => [self::STATUS_DRAFT, self::STATUS_SUBMITTED, self::STATUS_IN_REVIEW, self::STATUS_PARTIALLY_COMPLETE, self::STATUS_COMPLETE, self::STATUS_CANCELED]],
            [['submission_uuid'], 'unique'],
            [['section'], 'default', 'value' => ''],
            [['email_confirmation_sent', 'is_duplicate_previous', 'is_locked'], 'default', 'value' => 0],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function attributeLabels()
    {
        return [
            'submission_id' => 'Submission ID',
            'submission_uuid' => 'Submission UUID',
            'shibboleth_user_id' => 'Faculty User ID',
            'proxy_shibboleth_user_id' => 'Proxy User ID',
            'term_code' => 'Term Code',
            'course_code' => 'Course Code',
            'section' => 'Section',
            'course_title' => 'Course Title',
            'folio_course_listing_id' => 'FOLIO Course Listing ID',
            'offering_id' => 'Course Offering ID',
            'needed_by_date' => 'Needed By Date',
            'status' => 'Status',
            'submission_notes' => 'Submission Notes',
            'faculty_display_name' => 'Faculty Name',
            'proxy_display_name' => 'Proxy Name',
            'assignee_staff_user_id' => 'Assigned Staff Member',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
            'submitted_at' => 'Submitted At',
            'is_locked' => 'Is Locked',
            'locked_at' => 'Locked At',
            'locked_by_staff_id' => 'Locked By Staff',
            'lock_reason' => 'Lock Reason',
        ];
    }

    /**
     * Define which fields should be included in serialization
     */
    public function fields()
    {
        $fields = parent::fields();
        unset($fields['email_confirmation_legacy_sent']);
        // Add related data fields
        $fields['reuseResources'] = 'reuseResources';
        $fields['newResources'] = 'newResources';
        $fields['workflowAssignment'] = 'workflowAssignment';
        $fields['communications'] = function ($model) {
            return (new \app\services\SubmissionCommunicationService())
                ->submissionMessages($model->submission_id);
        };
        $fields['read_only'] = function ($model) { return $model->status === self::STATUS_DRAFT; };
        $fields['status_label'] = function ($model) { return $model->status === self::STATUS_DRAFT ? 'Draft - not submitted yet' : $model->status; };
        $fields['courseOffering'] = 'courseOffering';
        return $fields;
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getReuseResources()
    {
        return $this->hasMany(SubmissionReuseResource::class, ['submission_id' => 'submission_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getNewResources()
    {
        return $this->hasMany(SubmissionNewResource::class, ['submission_id' => 'submission_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getWorkflowAssignment()
    {
        return $this->hasOne(SubmissionWorkflowAssignment::class, ['submission_id' => 'submission_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getCommunications()
    {
        return $this->hasMany(SubmissionCommunication::class, ['submission_id' => 'submission_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getCourseOffering()
    {
        return $this->hasOne(CourseOfferings::class, ['offering_id' => 'offering_id']);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getFolders()
    {
        return $this->hasMany(SubmissionFolder::class, ['submission_id' => 'submission_id'])
            ->orderBy(['display_order' => SORT_ASC]);
    }

    /**
     * @return \yii\db\ActiveQuery
     */
    public function getMetadata()
    {
        return $this->hasOne(SubmissionMetadata::class, ['submission_id' => 'submission_id']);
    }

    public function beforeValidate()
    {
        if (!parent::beforeValidate()) {
            return false;
        }

        SubmissionConfirmationState::synchronizeCompatibilityBoolean($this);

        return true;
    }

    public function requestEmailConfirmation($requested)
    {
        SubmissionConfirmationState::request($this, $requested);
    }

    /**
     * Generate UUID before saving
     */
    public function beforeSave($insert)
    {
        SubmissionConfirmationState::synchronizeCompatibilityBoolean($this);

        if ($insert && empty($this->submission_uuid)) {
            $this->submission_uuid = $this->generateUuid();
        }
        
        if ($this->status === self::STATUS_SUBMITTED && empty($this->submitted_at)) {
            $this->submitted_at = date('Y-m-d H:i:s');
        }

        return parent::beforeSave($insert);
    }

    /**
     * Generate a UUID
     */
    private function generateUuid()
    {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    /**
     * Get all items (reuse + new) for this submission
     */
    public function getAllItems()
    {
        $reuseItems = $this->reuseResources;
        $newItems = $this->newResources;
        
        $allItems = [];
        
        foreach ($reuseItems as $item) {
            $allItems[] = [
                'type' => 'reuse',
                'id' => $item->id,
                'data' => $item,
                'order' => $item->display_order
            ];
        }
        
        foreach ($newItems as $item) {
            $allItems[] = [
                'type' => 'new',
                'id' => $item->id,
                'data' => $item,
                'order' => $item->display_order
            ];
        }
        
        // Sort by display order
        usort($allItems, function($a, $b) {
            return $a['order'] - $b['order'];
        });
        
        return $allItems;
    }

    /**
     * Check if submission is editable
     */
    public function isEditable()
    {
        return in_array($this->status, [self::STATUS_DRAFT]);
    }

    /**
     * Check if submission is locked
     */
    public function isLocked()
    {
        return (bool)$this->is_locked;
    }

    /**
     * Check if submission can be edited (not locked and not complete)
     */
    public function canEdit()
    {
        return !$this->isLocked() && !in_array($this->status, [self::STATUS_COMPLETE, self::STATUS_CANCELED]);
    }

    /**
     * Lock the submission
     * @param string $staffId The staff member ID locking the submission
     * @param string $reason Optional reason for locking
     * @return bool Whether the lock was successful
     */
    public function lock($staffId, $reason = null)
    {
        if ($this->isLocked()) {
            return false; // Already locked
        }

        $this->is_locked = 1;
        $this->locked_at = date('Y-m-d H:i:s');
        $this->locked_by_staff_id = $staffId;
        $this->lock_reason = $reason;

        return $this->save(false);
    }

    /**
     * Unlock the submission
     * @return bool Whether the unlock was successful
     */
    public function unlock()
    {
        if (!$this->isLocked()) {
            return false; // Already unlocked
        }

        $this->is_locked = 0;
        $this->locked_at = null;
        $this->locked_by_staff_id = null;
        $this->lock_reason = null;

        return $this->save(false);
    }

    /**
     * Get lock status information
     * @return array Lock status details
     */
    public function getLockStatus()
    {
        return [
            'is_locked' => $this->isLocked(),
            'locked_at' => $this->locked_at,
            'locked_by' => $this->locked_by_staff_id,
            'lock_reason' => $this->lock_reason,
            'can_edit' => $this->canEdit(),
        ];
    }

    /**
     * Get status options
     */
    public static function getStatusOptions()
    {
        return [
            self::STATUS_DRAFT => 'Draft',
            self::STATUS_SUBMITTED => 'Submitted',
            self::STATUS_IN_REVIEW => 'In Review',
            self::STATUS_PARTIALLY_COMPLETE => 'Partially Complete',
            self::STATUS_COMPLETE => 'Complete',
            self::STATUS_CANCELED => 'Canceled',
        ];
    }
}
