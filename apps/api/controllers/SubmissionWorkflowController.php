<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\ContentNegotiator;
use yii\web\Response;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\ConflictHttpException;
use yii\data\ActiveDataProvider;
use app\models\FacultySubmission;
use app\models\SubmissionWorkflowAssignment;
use app\models\SubmissionNewResource;
use app\models\User;
use app\services\SubmissionItemMaterializationService;

/**
 * Staff Workflow Controller
 * Handles staff processing of faculty submissions
 */
class SubmissionWorkflowController extends Controller
{
    private const STAFF_WORKFLOW_ROLES = ['staff', 'admin'];

    public function behaviors()
    {
        $behaviors = parent::behaviors();
        
        $behaviors['contentNegotiator'] = [
            'class' => ContentNegotiator::class,
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];

        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options'],
        ];

        // CORS handling
        $behaviors['corsFilter'] = [
            'class' => \yii\filters\Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:3001',
                    'http://localhost:5173',
                    'http://localhost:5174',
                    'http://127.0.0.1:3001',
                    'http://127.0.0.1:5173',
                    'http://127.0.0.1:5174',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 86400,
            ],
        ];

        return $behaviors;
    }

    public function beforeAction($action)
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        if ($action->id === 'options' || Yii::$app->request->method === 'OPTIONS') {
            return true;
        }

        $this->assertStaffWorkflowAccess(Yii::$app->user->identity);

        return true;
    }

    private function assertStaffWorkflowAccess($identity): void
    {
        if (!$this->isStaffWorkflowUser($identity)) {
            throw new ForbiddenHttpException('Staff workflow access requires a staff or admin role.');
        }
    }

    private function isStaffWorkflowUser($identity): bool
    {
        return in_array($identity->role ?? null, self::STAFF_WORKFLOW_ROLES, true);
    }

    /**
     * Handle OPTIONS requests for CORS
     */
    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    /**
     * Get pending submissions for staff review
     */
    public function actionPendingSubmissions()
    {
        $dataProvider = new ActiveDataProvider([
            'query' => FacultySubmission::find()
                ->where(['status' => FacultySubmission::STATUS_SUBMITTED])
                ->with(['reuseResources', 'newResources'])
                ->orderBy(['submitted_at' => SORT_ASC]),
            'pagination' => [
                'pageSize' => 20,
            ],
        ]);

        return $dataProvider;
    }

    /**
     * Get submissions assigned to current staff member
     */
    public function actionMyAssignments()
    {
        $currentUser = Yii::$app->user->identity;
        
        $dataProvider = new ActiveDataProvider([
            'query' => FacultySubmission::find()
                ->joinWith('workflowAssignment')
                ->where(['submission_workflow_assignments.assigned_staff_user_id' => $currentUser->id])
                ->with(['reuseResources', 'newResources', 'workflowAssignment'])
                ->orderBy(['submission_workflow_assignments.locked_at' => SORT_DESC]),
            'pagination' => [
                'pageSize' => 20,
            ],
        ]);

        return $dataProvider;
    }

    /**
     * Assign submission to staff member
     */
    public function actionAssignSubmission()
    {
        $data = Yii::$app->request->getBodyParams();
        $currentUser = Yii::$app->user->identity;
        
        if (empty($data['submission_id'])) {
            throw new BadRequestHttpException('submission_id is required');
        }

        $submission = FacultySubmission::findOne($data['submission_id']);
        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }

        $existingAssignment = SubmissionWorkflowAssignment::find()
            ->where(['submission_id' => $submission->submission_id])
            ->one();

        $this->assertSubmissionCanBeAssigned($submission, $existingAssignment);

        // Create assignment
        $assignment = new SubmissionWorkflowAssignment();
        $assignment->submission_id = $submission->submission_id;
        $assignment->assigned_staff_user_id = $currentUser->id;
        $assignment->assignment_type = SubmissionWorkflowAssignment::ASSIGNMENT_FULL_COURSE;
        $assignment->lockAssignment();

        // Update submission status
        $submission->status = FacultySubmission::STATUS_IN_REVIEW;
        $submission->save();

        if ($assignment->save()) {
            return [
                'success' => true,
                'assignment' => $assignment,
                'message' => 'Submission assigned successfully'
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $assignment->errors];
        }
    }

    /**
     * Update assignment status or notes
     */
    public function actionUpdateAssignment($id)
    {
        $currentUser = Yii::$app->user->identity;
        $data = Yii::$app->request->getBodyParams();
        
        $assignment = SubmissionWorkflowAssignment::find()
            ->where(['assignment_id' => $id, 'assigned_staff_user_id' => $currentUser->id])
            ->one();

        if (!$assignment) {
            throw new NotFoundHttpException('Assignment not found');
        }

        if (isset($data['status'])) {
            $this->assertAssignmentStatusIsValid($data['status']);
            $assignment->status = $data['status'];
        }

        if (isset($data['staff_notes'])) {
            $assignment->staff_notes = $data['staff_notes'];
        }

        if (isset($data['due_date'])) {
            $assignment->due_date = $data['due_date'];
        }

        if ($assignment->save()) {
            return $assignment;
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $assignment->errors];
        }
    }

    private function assertSubmissionCanBeAssigned($submission, $existingAssignment): void
    {
        if ($submission->status !== FacultySubmission::STATUS_SUBMITTED) {
            throw new BadRequestHttpException('Submission must be in submitted status');
        }

        if ($existingAssignment) {
            throw new ConflictHttpException('Submission already assigned');
        }
    }

    private function assertAssignmentStatusIsValid($status): void
    {
        $validStatuses = [
            SubmissionWorkflowAssignment::STATUS_ASSIGNED,
            SubmissionWorkflowAssignment::STATUS_IN_PROGRESS,
            SubmissionWorkflowAssignment::STATUS_COMPLETED,
            SubmissionWorkflowAssignment::STATUS_ON_HOLD,
        ];

        if (!in_array($status, $validStatuses, true)) {
            throw new BadRequestHttpException('Invalid assignment status.');
        }
    }

    /**
     * Update individual item status and notes
     * For staff to mark items as complete, in-progress, unavailable, etc.
     */
    public function actionUpdateItem($itemId)
    {
        $currentUser = Yii::$app->user->identity;
        $this->assertClaimActor($currentUser);
        $data = Yii::$app->request->getBodyParams();
        
        $item = SubmissionNewResource::findOne($itemId);
        
        if (!$item) {
            throw new NotFoundHttpException('Item not found');
        }

        $this->assertItemCanBeMutatedBy($item, $currentUser, 'updated');

        // Update item status
        if (isset($data['item_status'])) {
            $validStatuses = ['pending', 'in_progress', 'complete', 'unavailable'];
            if (in_array($data['item_status'], $validStatuses)) {
                $item->item_status = $data['item_status'];
            } else {
                throw new BadRequestHttpException('Invalid item_status. Must be: pending, in_progress, complete, or unavailable');
            }
        }

        // Update staff notes (add this field to the table if it doesn't exist)
        if (isset($data['staff_notes'])) {
            $item->staff_notes = $data['staff_notes'];
        }

        // Update faculty notes if needed
        if (isset($data['faculty_notes'])) {
            $item->faculty_notes = $data['faculty_notes'];
        }

        // Update priority
        if (isset($data['priority'])) {
            $validPriorities = ['high', 'medium', 'low'];
            if (in_array($data['priority'], $validPriorities)) {
                $item->priority = $data['priority'];
            }
        }

        if ($item->save()) {
            return [
                'success' => true,
                'item' => $item,
                'message' => 'Item updated successfully'
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $item->errors];
        }
    }

    /**
     * Claim an item for processing
     * Staff member claims an item to work on it, automatically sets status to in_progress
     */
    public function actionClaimItem($itemId)
    {
        $currentUser = Yii::$app->user->identity;
        $this->assertClaimActor($currentUser);
        
        $item = SubmissionNewResource::findOne($itemId);
        
        if (!$item) {
            throw new NotFoundHttpException('Item not found');
        }

        $this->assertItemCanBeClaimedBy($item, $currentUser);

        // Claim the item
        $item->item_status = 'in_progress';
        $item->claimed_by_staff_id = $currentUser->id;
        $item->claimed_at = date('Y-m-d H:i:s');
        
        // Add a staff note about who claimed it (for visibility)
        $staffName = $currentUser->fullName ?? $currentUser->full_name ?? $currentUser->username ?? $currentUser->id;
        $claimNote = "Claimed by {$staffName} at " . date('Y-m-d H:i:s');
        
        if (!empty($item->staff_notes)) {
            $item->staff_notes .= "\n" . $claimNote;
        } else {
            $item->staff_notes = $claimNote;
        }

        if ($item->save()) {
            return [
                'success' => true,
                'item' => $item,
                'message' => 'Item claimed successfully',
                'claimed_by' => $staffName,
                'claimed_by_id' => $currentUser->id,
                'claimed_at' => $item->claimed_at
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $item->errors];
        }
    }

    /**
     * Complete staff processing and publish the item into the linked course.
     */
    public function actionCompleteProcessing($itemId)
    {
        $currentUser = Yii::$app->user->identity;
        $this->assertClaimActor($currentUser);

        $item = SubmissionNewResource::findOne($itemId);
        if (!$item) {
            throw new NotFoundHttpException('Item not found');
        }

        $this->assertItemCanBeMutatedBy($item, $currentUser, 'completed');

        $service = new SubmissionItemMaterializationService();
        $materialization = $service->completeProcessing(
            $item,
            $currentUser->id,
            Yii::$app->request->getBodyParams()
        );

        $item->refresh();
        $submission = $item->submission;
        $submissionData = $this->normalizeSubmissionResponse($submission);

        return [
            'success' => true,
            'item' => $this->formatWorkflowItemResponse(
                $this->normalizeItemResponse($item),
                $submissionData,
                '/admin/submissions/' . $submissionData['submission_id']
            ),
            'materialization' => $materialization,
            'message' => 'Item processing completed and published to the course.',
        ];
    }

    private function assertClaimActor($identity): void
    {
        if (!$this->isStaffWorkflowUser($identity) || empty($identity->id)) {
            throw new ForbiddenHttpException('Staff workflow item claims require a staff or admin identity with an id.');
        }
    }

    private function assertItemCanBeClaimedBy($item, $identity): void
    {
        $status = $item->item_status ?? null;
        $claimedBy = $item->claimed_by_staff_id ?? null;
        $claimedByCurrentUser = $claimedBy !== null && (string)$claimedBy === (string)$identity->id;

        if ($status === 'complete') {
            throw new ConflictHttpException('Completed items cannot be claimed.');
        }

        if ($claimedBy !== null && !$claimedByCurrentUser) {
            throw new ConflictHttpException(sprintf(
                'Item is already claimed by staff user %s.',
                $claimedBy
            ));
        }

        if ($status === 'in_progress' && !$claimedByCurrentUser) {
            throw new ConflictHttpException('Item is already in progress.');
        }
    }

    private function assertItemCanBeMutatedBy($item, $identity, $action): void
    {
        $claimedBy = $item->claimed_by_staff_id ?? null;

        if ($claimedBy !== null && (string)$claimedBy !== (string)$identity->id) {
            throw new ConflictHttpException(sprintf(
                'Item is already claimed by staff user %s and cannot be %s by the current user.',
                $claimedBy,
                $action
            ));
        }
    }

    /**
     * Get all items claimed by the current user
     * Returns items with their parent submission info and course details
     */
    public function actionMyClaimedItems()
    {
        $currentUser = Yii::$app->user->identity;

        $items = SubmissionNewResource::find()
            ->where(['claimed_by_staff_id' => $currentUser->id])
            ->with([
                'submission',
                'materialType'
            ])
            ->orderBy(['claimed_at' => SORT_DESC])
            ->all();

        return array_map(function ($item) {
            return $this->formatClaimedItemResponse($item);
        }, $items);
    }

    /**
     * Get all communications for a submission (staff view)
     * GET /submission-workflow/submission/{id}/communications
     */
    public function actionCommunications($id)
    {
        $currentUser = Yii::$app->user->identity;
        
        $submission = FacultySubmission::findOne($id);
        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }

        // Get all messages (staff can see all)
        $messages = \app\models\SubmissionCommunication::find()
            ->where(['submission_id' => $submission->submission_id, 'parent_message_id' => null])
            ->orderBy(['created_at' => SORT_DESC])
            ->all();

        // Format messages with replies
        $formattedMessages = [];
        foreach ($messages as $message) {
            $formattedMessages[] = $this->formatCommunication($message);
        }

        return [
            'messages' => $formattedMessages,
            'submission' => [
                'submission_id' => $submission->submission_id,
                'course_code' => $submission->course_code,
                'course_title' => $submission->course_title,
                'status' => $submission->status,
            ]
        ];
    }

    /**
     * Create a new communication (staff message)
     * POST /submission-workflow/submission/{id}/communications
     * 
     * Body: {
     *   "message": "Message text with @username mentions",
     *   "subject": "Optional subject",
     *   "category": "question|issue|update|note|acquisitions|cataloging|etc",
     *   "priority": "low|normal|high|urgent",
     *   "visibility": "faculty_visible|staff_only|all_staff|assigned_only",
     *   "resource_id": 123,  // optional - link to specific item
     *   "parent_message_id": 456,  // optional - for replies
     *   "is_task": true,  // optional - create as task
     *   "task_assignee": "username",  // optional - assign task
     *   "task_due_date": "2025-12-01"  // optional
     * }
     */
    public function actionCreateCommunication($id)
    {
        $currentUser = Yii::$app->user->identity;
        $request = Yii::$app->request;
        
        $submission = FacultySubmission::findOne($id);
        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }

        $message = $request->post('message');
        if (empty($message)) {
            throw new BadRequestHttpException('Message is required');
        }

        // Extract @mentions from message
        $mentions = $this->extractMentions($message);
        
        // Create communication
        $communication = new \app\models\SubmissionCommunication();
        $communication->submission_id = $submission->submission_id;
        $communication->communication_type = \app\models\SubmissionCommunication::TYPE_STAFF_TO_STAFF;
        $communication->message = $message;
        $communication->sender_type = \app\models\SubmissionCommunication::ACTOR_STAFF;
        $communication->sender_id = (string)$currentUser->id;  // Cast to string
        $communication->sender_name = $currentUser->full_name ?? $currentUser->username;
        $communication->sender_email = $currentUser->email;
        
        // Optional fields
        $communication->subject = $request->post('subject');
        $communication->category = $request->post('category', \app\models\SubmissionCommunication::CATEGORY_NOTE);
        $communication->priority = $request->post('priority', \app\models\SubmissionCommunication::PRIORITY_NORMAL);
        $communication->visibility = $request->post('visibility', \app\models\SubmissionCommunication::VISIBILITY_ALL_STAFF);
        $communication->resource_id = $request->post('resource_id');
        $communication->parent_message_id = $request->post('parent_message_id');
        $communication->department = $request->post('department', \app\models\SubmissionCommunication::DEPT_RESERVES);
        
        // Store mentions in metadata
        if (!empty($mentions)) {
            $communication->metadata = json_encode(['mentions' => $mentions]);
        }

        // Handle tasks
        if ($request->post('is_task')) {
            $communication->is_task = 1;
            $communication->task_status = \app\models\SubmissionCommunication::TASK_STATUS_PENDING;
            $assignee = $request->post('task_assignee');
            if ($assignee) {
                $communication->task_assignee = $assignee;
            }
            $dueDate = $request->post('task_due_date');
            if ($dueDate) {
                $communication->task_due_date = $dueDate;
            }
        }

        // Determine recipient if it's a faculty-visible message
        if ($communication->visibility === \app\models\SubmissionCommunication::VISIBILITY_FACULTY) {
            $communication->recipient_type = \app\models\SubmissionCommunication::ACTOR_FACULTY;
            $communication->recipient_id = $submission->shibboleth_user_id;
            $communication->recipient_name = $submission->faculty_display_name;
        }

        if ($communication->save()) {
            // Create participant records for @mentions
            if (!empty($mentions)) {
                $this->createMentionParticipants($communication->id, $mentions);
            }

            // Log activity
            $communication->logActivity((string)$currentUser->id, \app\models\SubmissionCommunication::ACTOR_STAFF, 'created');

            return [
                'success' => true,
                'communication' => $this->formatCommunication($communication),
                'message' => 'Communication created successfully'
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $communication->errors];
        }
    }

    /**
     * Update a communication
     * PUT /submission-workflow/communications/{messageId}
     */
    public function actionUpdateCommunication($messageId)
    {
        $currentUser = Yii::$app->user->identity;
        $request = Yii::$app->request;
        
        $communication = \app\models\SubmissionCommunication::findOne($messageId);
        if (!$communication) {
            throw new NotFoundHttpException('Communication not found');
        }

        // Only sender or admin can edit
        if ($communication->sender_id != (string)$currentUser->id && $currentUser->role !== 'admin') {
            throw new ForbiddenHttpException('You can only edit your own messages');
        }

        $message = $request->post('message');
        if ($message !== null) {
            $communication->message = $message;
            
            // Re-extract mentions
            $mentions = $this->extractMentions($message);
            if (!empty($mentions)) {
                $metadata = $communication->getMetadataArray();
                $metadata['mentions'] = $mentions;
                $communication->metadata = json_encode($metadata);
                
                // Update participants
                $this->createMentionParticipants($communication->id, $mentions);
            }
        }

        if ($communication->save()) {
            $communication->logActivity((string)$currentUser->id, \app\models\SubmissionCommunication::ACTOR_STAFF, 'updated');
            
            return [
                'success' => true,
                'communication' => $this->formatCommunication($communication)
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $communication->errors];
        }
    }

    /**
     * Mark communication as read
     * POST /submission-workflow/communications/{messageId}/read
     */
    public function actionMarkCommunicationRead($messageId)
    {
        $currentUser = Yii::$app->user->identity;
        
        $communication = \app\models\SubmissionCommunication::findOne($messageId);
        if (!$communication) {
            throw new NotFoundHttpException('Communication not found');
        }

        $communication->markAsRead((string)$currentUser->id, \app\models\SubmissionCommunication::ACTOR_STAFF);

        return [
            'success' => true,
            'message' => 'Marked as read'
        ];
    }

    /**
     * Search for staff users (for @mention autocomplete)
     * GET /submission-workflow/search-staff?q=rob
     */
    public function actionSearchStaff()
    {
        $query = Yii::$app->request->get('q', '');
        
        if (strlen($query) < 2) {
            return ['users' => []];
        }

        $users = \app\models\User::find()
            ->where(['like', 'username', $query])
            ->orWhere(['like', 'full_name', $query])
            ->limit(10)
            ->all();

        return [
            'users' => array_map(function($user) {
                return [
                    'id' => $user->id,
                    'username' => $user->username,
                    'full_name' => $user->full_name ?? $user->username,
                    'email' => $user->email
                ];
            }, $users)
        ];
    }

    /**
     * Get unread message count for current user
     * GET /submission-workflow/my-unread-count
     */
    public function actionMyUnreadCount()
    {
        $currentUser = Yii::$app->user->identity;
        
        // Find all communications where user is mentioned
        $allMentions = \app\models\SubmissionCommunicationParticipant::find()
            ->select('communication_id')
            ->where([
                'participant_id' => (string)$currentUser->id,
                'participant_type' => 'staff'
            ])
            ->column();
        
        if (empty($allMentions)) {
            return [
                'unread_count' => 0,
                'user_id' => $currentUser->id,
                'username' => $currentUser->username
            ];
        }
        
        // Find which ones have been read
        $readMentions = \app\models\SubmissionCommunicationRead::find()
            ->select('communication_id')
            ->where([
                'communication_id' => $allMentions,
                'reader_id' => (string)$currentUser->id
            ])
            ->column();
        
        // Unread = all mentions minus read mentions
        $unreadCount = count($allMentions) - count($readMentions);

        return [
            'unread_count' => $unreadCount,
            'user_id' => $currentUser->id,
            'username' => $currentUser->username
        ];
    }

    /**
     * Get all messages where current user is mentioned
     * GET /submission-workflow/my-mentions
     */
    public function actionMyMentions()
    {
        $currentUser = Yii::$app->user->identity;
        
        // Get all communications where user is a participant
        $mentions = \app\models\SubmissionCommunicationParticipant::find()
            ->joinWith('communication')
            ->where([
                'submission_communication_participants.participant_id' => (string)$currentUser->id,
                'submission_communication_participants.participant_type' => 'staff'
            ])
            ->orderBy(['submission_communications.created_at' => SORT_DESC])
            ->all();

        $result = [];
        foreach ($mentions as $participant) {
            $comm = $participant->communication;
            
            // Check if user has read this message
            $isRead = \app\models\SubmissionCommunicationRead::find()
                ->where([
                    'communication_id' => $comm->id,
                    'reader_id' => (string)$currentUser->id
                ])
                ->exists();
            
            $result[] = [
                'id' => $comm->id,
                'submission_id' => $comm->submission_id,
                'subject' => $comm->subject,
                'message' => $comm->message,
                'sender_name' => $comm->sender_name,
                'created_at' => $comm->created_at,
                'is_read' => $isRead,
                'priority' => $comm->priority,
                'category' => $comm->category
            ];
        }

        return [
            'mentions' => $result,
            'total' => count($result)
        ];
    }

    /**
     * Extract @mentions from message text
     * Returns array of usernames mentioned
     */
    protected function extractMentions($message)
    {
        $mentions = [];
        if (preg_match_all('/@(\w+)/', $message, $matches)) {
            $mentions = array_unique($matches[1]);
        }
        return $mentions;
    }

    /**
     * Create participant records for mentioned users
     */
    protected function createMentionParticipants($communicationId, $mentions)
    {
        foreach ($mentions as $username) {
            $user = User::findOne(['username' => $username]);
            if ($user) {
                // Check if participant already exists
                $existing = \app\models\SubmissionCommunicationParticipant::findOne([
                    'communication_id' => $communicationId,
                    'participant_id' => $user->id
                ]);

                if (!$existing) {
                    $participant = new \app\models\SubmissionCommunicationParticipant();
                    $participant->communication_id = $communicationId;
                    $participant->participant_type = 'staff';
                    $participant->participant_id = (string)$user->id;  // Cast to string
                    $participant->participant_name = $user->full_name ?? $user->username;
                    $participant->participant_email = $user->email;
                    $participant->role = \app\models\SubmissionCommunicationParticipant::ROLE_RECIPIENT;
                    $participant->save();
                }
            }
        }
    }

    /**
     * Format communication for API response
     */
    protected function formatCommunication($communication)
    {
        $data = [
            'id' => $communication->id,
            'submission_id' => $communication->submission_id,
            'parent_message_id' => $communication->parent_message_id,
            'resource_id' => $communication->resource_id,
            'communication_type' => $communication->communication_type,
            'visibility' => $communication->visibility,
            'category' => $communication->category,
            'subject' => $communication->subject,
            'message' => $communication->message,
            'sender_type' => $communication->sender_type,
            'sender_id' => $communication->sender_id,
            'sender_name' => $communication->sender_name,
            'sender_email' => $communication->sender_email,
            'priority' => $communication->priority,
            'status' => $communication->status,
            'is_read' => $communication->is_read,
            'is_flagged' => $communication->is_flagged,
            'is_task' => $communication->is_task,
            'task_status' => $communication->task_status,
            'task_assignee' => $communication->task_assignee,
            'task_due_date' => $communication->task_due_date,
            'created_at' => $communication->created_at,
            'updated_at' => $communication->updated_at,
            'metadata' => $communication->getMetadataArray(),
            'replies' => [],
        ];

        // Add replies
        $replies = $communication->getReplies()->all();
        foreach ($replies as $reply) {
            $data['replies'][] = $this->formatCommunication($reply);
        }

        return $data;
    }

    /**
     * Get submission details for staff review
     */
    public function actionViewSubmission($id)
    {
        $submission = FacultySubmission::find()
            ->where(['submission_id' => $id])
            ->with([
                'reuseResources.sourceResource',
                'newResources.materialType',
                'workflowAssignment.assignedStaff',
                'communications'
            ])
            ->one();

        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }

        return $this->formatSubmissionDetailResponse($submission);
    }

    protected function formatSubmissionDetailResponse($submission)
    {
        $submissionData = $this->normalizeSubmissionResponse($submission);
        $returnTo = '/admin/submissions/' . $submissionData['submission_id'];

        $submissionData['newResources'] = array_map(function ($item) use ($submissionData, $returnTo) {
            return $this->formatWorkflowItemResponse($item, $submissionData, $returnTo);
        }, isset($submissionData['newResources']) && is_array($submissionData['newResources']) ? $submissionData['newResources'] : []);

        $submissionData['reuseResources'] = array_map(function ($item) use ($submissionData, $returnTo) {
            return $this->formatWorkflowItemResponse($item, $submissionData, $returnTo);
        }, isset($submissionData['reuseResources']) && is_array($submissionData['reuseResources']) ? $submissionData['reuseResources'] : []);

        return $submissionData;
    }

    protected function formatClaimedItemResponse($item)
    {
        $itemData = $this->normalizeItemResponse($item);
        $submissionData = isset($itemData['submission']) && is_array($itemData['submission'])
            ? $itemData['submission']
            : [];

        $itemData['submission'] = $this->normalizeClaimedItemSubmission($submissionData);
        $itemData['processing_context'] = $this->buildProcessingContext(
            $itemData['submission'],
            $itemData,
            '/admin/work-queue/' . $itemData['id']
        );
        $itemData['folio_course_listing_id'] = $itemData['submission']['folio_course_listing_id'];
        $itemData['offering_id'] = $itemData['submission']['offering_id'];

        return $itemData;
    }

    protected function formatWorkflowItemResponse(array $itemData, array $submissionData, $returnTo)
    {
        $itemData['processing_context'] = $this->buildProcessingContext($submissionData, $itemData, $returnTo);
        $itemData['folio_course_listing_id'] = $submissionData['folio_course_listing_id'];
        $itemData['offering_id'] = $submissionData['offering_id'];

        return $itemData;
    }

    protected function buildProcessingContext(array $submissionData, array $itemData, $returnTo)
    {
        $submissionId = $this->normalizeInt($this->arrayValue($submissionData, 'submission_id'));
        $itemId = $this->normalizeInt($this->arrayValue($itemData, 'id'));
        $offeringId = $this->normalizeInt($this->arrayValue($submissionData, 'offering_id'));
        $folioCourseListingId = $this->normalizeString($this->arrayValue($submissionData, 'folio_course_listing_id'));
        $itemStatus = $this->normalizeString($this->arrayValue($itemData, 'item_status'));
        $blockingReason = $this->determineProcessingBlockingReason(
            $submissionId,
            $itemId,
            $folioCourseListingId,
            $offeringId,
            $itemStatus
        );

        return [
            'submission_id' => $submissionId,
            'submission_uuid' => $this->normalizeString($this->arrayValue($submissionData, 'submission_uuid')),
            'item_id' => $itemId,
            'folio_course_listing_id' => $folioCourseListingId,
            'offering_id' => $offeringId,
            'item_status' => $itemStatus,
            'claimed_by_staff_id' => $this->normalizeInt($this->arrayValue($itemData, 'claimed_by_staff_id')),
            'claimed_at' => $this->arrayValue($itemData, 'claimed_at'),
            'course_linked' => $folioCourseListingId !== null && $offeringId !== null,
            'can_open_processing' => $blockingReason === null,
            'blocking_reason' => $blockingReason,
            'return_to' => $returnTo,
        ];
    }

    protected function determineProcessingBlockingReason($submissionId, $itemId, $folioCourseListingId, $offeringId, $itemStatus)
    {
        if ($submissionId === null) {
            return 'Submission is missing a numeric submission_id.';
        }

        if ($itemId === null) {
            return 'Workflow item is missing a numeric item id.';
        }

        if ($folioCourseListingId === null) {
            return 'Submission is not linked to a FOLIO course listing yet.';
        }

        if ($offeringId === null) {
            return 'Submission is missing a local offering_id.';
        }

        if (in_array($itemStatus, ['complete', 'unavailable'], true)) {
            return 'Item status blocks processing handoff.';
        }

        return null;
    }

    protected function normalizeSubmissionResponse($submission)
    {
        if (is_object($submission) && method_exists($submission, 'toArray')) {
            $submission = $submission->toArray([], [
                'reuseResources.sourceResource',
                'newResources.materialType',
                'workflowAssignment.assignedStaff',
                'communications',
            ]);
        }

        $submission['submission_id'] = $this->normalizeInt($this->arrayValue($submission, 'submission_id'));
        $submission['offering_id'] = $this->normalizeInt($this->arrayValue($submission, 'offering_id'));
        $submission['folio_course_listing_id'] = $this->normalizeString($this->arrayValue($submission, 'folio_course_listing_id'));

        return $submission;
    }

    protected function normalizeItemResponse($item)
    {
        if (is_object($item) && method_exists($item, 'toArray')) {
            $item = $item->toArray([], ['submission', 'materialType']);
        }

        $item['id'] = $this->normalizeInt($this->arrayValue($item, 'id'));
        $item['submission_id'] = $this->normalizeInt($this->arrayValue($item, 'submission_id'));
        $item['material_type_id'] = $this->normalizeInt($this->arrayValue($item, 'material_type_id'));
        $item['claimed_by_staff_id'] = $this->normalizeInt($this->arrayValue($item, 'claimed_by_staff_id'));

        return $item;
    }

    protected function normalizeClaimedItemSubmission(array $submission)
    {
        return [
            'submission_id' => $this->normalizeInt($this->arrayValue($submission, 'submission_id')),
            'submission_uuid' => $this->normalizeString($this->arrayValue($submission, 'submission_uuid')),
            'course_code' => $this->arrayValue($submission, 'course_code'),
            'course_title' => $this->arrayValue($submission, 'course_title'),
            'term_code' => $this->arrayValue($submission, 'term_code'),
            'section' => $this->arrayValue($submission, 'section'),
            'faculty_display_name' => $this->arrayValue($submission, 'faculty_display_name'),
            'needed_by_date' => $this->arrayValue($submission, 'needed_by_date'),
            'status' => $this->arrayValue($submission, 'status'),
            'folio_course_listing_id' => $this->normalizeString($this->arrayValue($submission, 'folio_course_listing_id')),
            'offering_id' => $this->normalizeInt($this->arrayValue($submission, 'offering_id')),
        ];
    }

    protected function arrayValue($data, $key, $default = null)
    {
        return is_array($data) && array_key_exists($key, $data) ? $data[$key] : $default;
    }

    protected function normalizeInt($value)
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (int) $value : null;
    }

    protected function normalizeString($value)
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    /**
     * Complete a submission (mark as processed)
     */
    public function actionCompleteSubmission($id)
    {
        $currentUser = Yii::$app->user->identity;

        $assignment = SubmissionWorkflowAssignment::find()
            ->where(['submission_id' => $id, 'assigned_staff_user_id' => $currentUser->id])
            ->one();

        if (!$assignment) {
            throw new ForbiddenHttpException('You are not assigned to this submission');
        }

        return $this->completeAssignment($assignment);
    }

    protected function completeAssignment($assignment)
    {
        $assignment->status = SubmissionWorkflowAssignment::STATUS_COMPLETED;
        $assignment->save();

        $submission = $assignment->submission;
        $submission->status = FacultySubmission::STATUS_COMPLETE;
        $submission->save();

        return [
            'success' => true,
            'message' => 'Submission marked as completed'
        ];
    }
}
