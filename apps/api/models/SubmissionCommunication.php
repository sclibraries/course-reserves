<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;
use yii\behaviors\TimestampBehavior;

/**
 * SubmissionCommunication model
 * 
 * Handles all communications related to faculty submissions:
 * - Faculty to staff questions/notes
 * - Staff to faculty responses/updates  
 * - Staff to staff internal notes/tasks
 *
 * @property int $id
 * @property int $submission_id
 * @property int $parent_message_id
 * @property int $resource_id
 * @property string $communication_type
 * @property string $visibility
 * @property string $category
 * @property string $subject
 * @property string $message
 * @property string $sender_type
 * @property string $sender_id
 * @property string $sender_name
 * @property string $sender_email
 * @property string $recipient_type
 * @property string $recipient_id
 * @property string $recipient_name
 * @property string $department
 * @property string $priority
 * @property string $status
 * @property int $is_read
 * @property int $is_flagged
 * @property int $is_task
 * @property string $task_status
 * @property string $task_due_date
 * @property string $task_assignee
 * @property string $attachments
 * @property string $metadata
 * @property string $created_at
 * @property string $updated_at
 * @property string $read_at
 * @property string $resolved_at
 */
class SubmissionCommunication extends ActiveRecord
{
    // Communication types
    const TYPE_FACULTY_TO_STAFF = 'faculty_to_staff';
    const TYPE_STAFF_TO_FACULTY = 'staff_to_faculty';
    const TYPE_STAFF_TO_STAFF = 'staff_to_staff';
    
    // Visibility levels
    const VISIBILITY_FACULTY = 'faculty_visible';  // Faculty can see
    const VISIBILITY_STAFF_ONLY = 'staff_only';    // Only staff can see
    const VISIBILITY_ALL_STAFF = 'all_staff';      // All staff can see
    const VISIBILITY_ASSIGNED = 'assigned_only';   // Only assigned staff can see
    
    // Sender/Recipient types
    const ACTOR_FACULTY = 'faculty';
    const ACTOR_STAFF = 'staff';
    const ACTOR_SYSTEM = 'system';
    
    // Categories
    const CATEGORY_QUESTION = 'question';
    const CATEGORY_ISSUE = 'issue';
    const CATEGORY_UPDATE = 'update';
    const CATEGORY_TASK = 'task';
    const CATEGORY_ACQUISITIONS = 'acquisitions';
    const CATEGORY_CATALOGING = 'cataloging';
    const CATEGORY_DIGITIZATION = 'digitization';
    const CATEGORY_COPYRIGHT = 'copyright';
    const CATEGORY_NOTE = 'note';
    
    // Priority levels
    const PRIORITY_LOW = 'low';
    const PRIORITY_NORMAL = 'normal';
    const PRIORITY_HIGH = 'high';
    const PRIORITY_URGENT = 'urgent';
    
    // Status
    const STATUS_ACTIVE = 'active';
    const STATUS_RESOLVED = 'resolved';
    const STATUS_ARCHIVED = 'archived';
    
    // Task status
    const TASK_STATUS_PENDING = 'pending';
    const TASK_STATUS_IN_PROGRESS = 'in_progress';
    const TASK_STATUS_COMPLETED = 'completed';
    const TASK_STATUS_CANCELED = 'canceled';
    
    // Departments
    const DEPT_RESERVES = 'reserves';
    const DEPT_ACQUISITIONS = 'acquisitions';
    const DEPT_CATALOGING = 'cataloging';
    const DEPT_DIGITIZATION = 'digitization';
    const DEPT_ILL = 'interlibrary_loan';
    const DEPT_ACCESS_SERVICES = 'access_services';

    public static function tableName()
    {
        return 'submission_communications';
    }

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

    public function rules()
    {
        return [
            [['submission_id', 'communication_type', 'message', 'sender_type', 'sender_id'], 'required'],
            [['submission_id', 'parent_message_id', 'resource_id', 'is_read', 'is_flagged', 'is_task'], 'integer'],
            [['message', 'attachments', 'metadata'], 'string'],
            [['task_due_date', 'created_at', 'updated_at', 'read_at', 'resolved_at'], 'safe'],
            [['communication_type', 'visibility', 'category', 'sender_type', 'recipient_type', 'priority', 'status', 'task_status'], 'string', 'max' => 32],
            [['subject'], 'string', 'max' => 255],
            [['sender_id', 'sender_name', 'sender_email', 'recipient_id', 'recipient_name', 'task_assignee'], 'string', 'max' => 255],
            [['department'], 'string', 'max' => 64],
            
            // Defaults
            [['visibility'], 'default', 'value' => self::VISIBILITY_STAFF_ONLY],
            [['priority'], 'default', 'value' => self::PRIORITY_NORMAL],
            [['status'], 'default', 'value' => self::STATUS_ACTIVE],
            [['is_read', 'is_flagged', 'is_task'], 'default', 'value' => 0],
            
            // Validation
            [['communication_type'], 'in', 'range' => [self::TYPE_FACULTY_TO_STAFF, self::TYPE_STAFF_TO_FACULTY, self::TYPE_STAFF_TO_STAFF]],
            [['visibility'], 'in', 'range' => [self::VISIBILITY_FACULTY, self::VISIBILITY_STAFF_ONLY, self::VISIBILITY_ALL_STAFF, self::VISIBILITY_ASSIGNED]],
            [['sender_type', 'recipient_type'], 'in', 'range' => [self::ACTOR_FACULTY, self::ACTOR_STAFF, self::ACTOR_SYSTEM]],
            [['priority'], 'in', 'range' => [self::PRIORITY_LOW, self::PRIORITY_NORMAL, self::PRIORITY_HIGH, self::PRIORITY_URGENT]],
            [['status'], 'in', 'range' => [self::STATUS_ACTIVE, self::STATUS_RESOLVED, self::STATUS_ARCHIVED]],
        ];
    }

    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'submission_id' => 'Submission ID',
            'parent_message_id' => 'Parent Message ID',
            'resource_id' => 'Resource ID',
            'communication_type' => 'Communication Type',
            'visibility' => 'Visibility',
            'category' => 'Category',
            'subject' => 'Subject',
            'message' => 'Message',
            'sender_type' => 'Sender Type',
            'sender_id' => 'Sender ID',
            'sender_name' => 'Sender Name',
            'sender_email' => 'Sender Email',
            'recipient_type' => 'Recipient Type',
            'recipient_id' => 'Recipient ID',
            'recipient_name' => 'Recipient Name',
            'department' => 'Department',
            'priority' => 'Priority',
            'status' => 'Status',
            'is_read' => 'Is Read',
            'is_flagged' => 'Is Flagged',
            'is_task' => 'Is Task',
            'task_status' => 'Task Status',
            'task_due_date' => 'Task Due Date',
            'task_assignee' => 'Task Assignee',
            'created_at' => 'Created At',
            'updated_at' => 'Updated At',
        ];
    }

    // Relations
    
    public function getSubmission()
    {
        return $this->hasOne(FacultySubmission::class, ['submission_id' => 'submission_id']);
    }

    public function getResource()
    {
        return $this->hasOne(SubmissionNewResource::class, ['id' => 'resource_id']);
    }

    public function getParentMessage()
    {
        return $this->hasOne(SubmissionCommunication::class, ['id' => 'parent_message_id']);
    }

    public function getReplies()
    {
        return $this->hasMany(SubmissionCommunication::class, ['parent_message_id' => 'id'])
            ->orderBy(['created_at' => SORT_ASC]);
    }

    public function getParticipants()
    {
        return $this->hasMany(SubmissionCommunicationParticipant::class, ['communication_id' => 'id']);
    }

    public function getReadReceipts()
    {
        return $this->hasMany(SubmissionCommunicationRead::class, ['communication_id' => 'id']);
    }

    public function getActivityLog()
    {
        return $this->hasMany(SubmissionCommunicationActivity::class, ['communication_id' => 'id'])
            ->orderBy(['created_at' => SORT_DESC]);
    }

    // Helper methods
    
    public function isVisibleToFaculty()
    {
        return (new \app\services\SubmissionCommunicationVisibilityPolicy())
            ->isFacultyVisible($this->visibility);
    }

    public function isVisibleToStaff($staffId = null)
    {
        if ($this->visibility === self::VISIBILITY_ASSIGNED) {
            return $staffId && ($this->recipient_id === $staffId || $this->task_assignee === $staffId);
        }
        
        return true;  // All other visibility levels are visible to staff
    }

    public function isThread()
    {
        return $this->parent_message_id === null;
    }

    public function isReply()
    {
        return $this->parent_message_id !== null;
    }

    public function getThreadId()
    {
        return $this->parent_message_id ?? $this->id;
    }

    public function markAsRead($readerId, $readerType = self::ACTOR_STAFF)
    {
        if (!$this->is_read) {
            $this->is_read = 1;
            $this->read_at = date('Y-m-d H:i:s');
            $this->save(false);
        }

        // Create read receipt
        $read = new SubmissionCommunicationRead();
        $read->communication_id = $this->id;
        $read->reader_type = $readerType;
        $read->reader_id = $readerId;
        $read->save();

        // Log activity
        $this->logActivity($readerId, $readerType, 'read');
    }

    public function markAsResolved($actorId, $actorType = self::ACTOR_STAFF)
    {
        $this->status = self::STATUS_RESOLVED;
        $this->resolved_at = date('Y-m-d H:i:s');
        $this->save(false);

        $this->logActivity($actorId, $actorType, 'resolved');
    }

    public function toggleFlag($actorId, $actorType = self::ACTOR_STAFF)
    {
        $this->is_flagged = !$this->is_flagged;
        $this->save(false);

        $action = $this->is_flagged ? 'flagged' : 'unflagged';
        $this->logActivity($actorId, $actorType, $action);
    }

    public function assignTask($assigneeId, $assigneeName, $dueDate = null, $actorId = null, $actorType = self::ACTOR_STAFF)
    {
        $this->is_task = 1;
        $this->task_assignee = $assigneeId;
        $this->task_status = self::TASK_STATUS_PENDING;
        
        if ($dueDate) {
            $this->task_due_date = $dueDate;
        }
        
        $this->save(false);

        $this->logActivity($actorId ?? $assigneeId, $actorType, 'assigned', [
            'assignee_id' => $assigneeId,
            'assignee_name' => $assigneeName,
            'due_date' => $dueDate
        ]);
    }

    public function updateTaskStatus($newStatus, $actorId, $actorType = self::ACTOR_STAFF)
    {
        $oldStatus = $this->task_status;
        $this->task_status = $newStatus;
        
        if ($newStatus === self::TASK_STATUS_COMPLETED) {
            $this->status = self::STATUS_RESOLVED;
            $this->resolved_at = date('Y-m-d H:i:s');
        }
        
        $this->save(false);

        $this->logActivity($actorId, $actorType, 'task_status_changed', [
            'old_status' => $oldStatus,
            'new_status' => $newStatus
        ]);
    }

    public function logActivity($actorId, $actorType, $action, $actionData = null)
    {
        $activity = new SubmissionCommunicationActivity();
        $activity->communication_id = $this->id;
        $activity->actor_type = $actorType;
        $activity->actor_id = $actorId;
        $activity->action = $action;
        
        if ($actionData) {
            $activity->action_data = json_encode($actionData);
        }
        
        $activity->save();
    }

    public function getAttachmentsArray()
    {
        return $this->attachments ? json_decode($this->attachments, true) : [];
    }

    public function getMetadataArray()
    {
        return $this->metadata ? json_decode($this->metadata, true) : [];
    }

    // Static helper methods

    public static function getCommunicationTypeOptions()
    {
        return [
            self::TYPE_FACULTY_TO_STAFF => 'Faculty to Staff',
            self::TYPE_STAFF_TO_FACULTY => 'Staff to Faculty',
            self::TYPE_STAFF_TO_STAFF => 'Staff to Staff',
        ];
    }

    public static function getCategoryOptions()
    {
        return [
            self::CATEGORY_QUESTION => 'Question',
            self::CATEGORY_ISSUE => 'Issue',
            self::CATEGORY_UPDATE => 'Update',
            self::CATEGORY_TASK => 'Task',
            self::CATEGORY_ACQUISITIONS => 'Acquisitions',
            self::CATEGORY_CATALOGING => 'Cataloging',
            self::CATEGORY_DIGITIZATION => 'Digitization',
            self::CATEGORY_COPYRIGHT => 'Copyright',
            self::CATEGORY_NOTE => 'Note',
        ];
    }

    public static function getDepartmentOptions()
    {
        return [
            self::DEPT_RESERVES => 'Reserves',
            self::DEPT_ACQUISITIONS => 'Acquisitions',
            self::DEPT_CATALOGING => 'Cataloging',
            self::DEPT_DIGITIZATION => 'Digitization',
            self::DEPT_ILL => 'Interlibrary Loan',
            self::DEPT_ACCESS_SERVICES => 'Access Services',
        ];
    }

    public static function getPriorityOptions()
    {
        return [
            self::PRIORITY_LOW => 'Low',
            self::PRIORITY_NORMAL => 'Normal',
            self::PRIORITY_HIGH => 'High',
            self::PRIORITY_URGENT => 'Urgent',
        ];
    }
}
