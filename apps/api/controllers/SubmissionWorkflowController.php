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
use app\components\Roles;
use app\models\FacultySubmission;
use app\models\SubmissionWorkflowAssignment;
use app\models\SubmissionNewResource;
use app\models\User;
use app\services\SubmissionItemMaterializationService;
use app\services\SubmissionLinkGuard;
use app\services\ItemClaimService;

/**
 * Staff Workflow Controller
 * Handles staff processing of faculty submissions
 */
class SubmissionWorkflowController extends Controller
{
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
        return Roles::isStaff($identity->role ?? null);
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
            'query' => (new \app\services\SubmittedSubmissionScope())->staffSubmissionList(FacultySubmission::find())
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
            'query' => (new \app\services\SubmittedSubmissionScope())->excludeDrafts(FacultySubmission::find())
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
        if (!$submission) throw new NotFoundHttpException('Submission not found');
        if ($blocked = SubmissionLinkGuard::errorResponse($submission)) return $blocked;

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

        if (!$assignment) throw new NotFoundHttpException('Assignment not found');
        if ($blocked = SubmissionLinkGuard::errorResponse($assignment->submission)) return $blocked;

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
        
        if (!$item) throw new NotFoundHttpException('Item not found');
        if ($blocked = SubmissionLinkGuard::errorResponse($item->submission)) return $blocked;

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
            Yii::$container->get(ItemClaimService::class)->recordActivity('new', $item->id);
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
        if (!$item) throw new NotFoundHttpException('Item not found');
        if ($blocked = SubmissionLinkGuard::errorResponse($item->submission)) return $blocked;
        $result = Yii::$container->get(ItemClaimService::class)->claim('new', $itemId, $this->claimActor($currentUser));
        if ($result['status'] !== 200) {
            Yii::$app->response->statusCode = $result['status'];
            return $result['body'];
        }
        $item->refresh();
        $itemData = $item->toArray([], ['materialType']);
        $itemData['claimed_by_staff_id'] = $this->normalizeInt($currentUser->id);
        $itemData['claimed_at'] = $item->claimed_at;
        return [
            'success' => true,
            'item' => $itemData,
            'message' => 'Item claimed successfully',
            'claimed_by' => $result['body']['item']['claimed_by_display'],
            'claimed_by_id' => $currentUser->id,
            'claimed_at' => $item->claimed_at,
        ];
    }

    /**
     * Complete staff processing and publish the item into the linked course.
     */
    public function actionCompleteProcessing($itemId)
    {
        $currentUser = Yii::$app->user->identity;
        $this->assertClaimActor($currentUser);

        $item = SubmissionNewResource::findOne($itemId);
        if (!$item) throw new NotFoundHttpException('Item not found');
        if ($blocked = SubmissionLinkGuard::errorResponse($item->submission)) return $blocked;

        $this->assertItemCanBeMutatedBy($item, $currentUser, 'completed');

        $service = new SubmissionItemMaterializationService();
        $materialization = $service->completeProcessing(
            $item,
            $currentUser->id,
            Yii::$app->request->getBodyParams()
        );
        Yii::$container->get(ItemClaimService::class)->recordActivity('new', $item->id);

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

    private function claimActor($identity)
    {
        return [
            'username' => $identity->username ?? (string)$identity->id,
            'role' => $identity->role,
        ];
    }

    private function assertItemCanBeMutatedBy($item, $identity, $action): void
    {
        $claimedBy = $item->claimed_by ?? null;
        $username = $identity->username ?? (string)$identity->id;

        if ($claimedBy !== null && (string)$claimedBy !== (string)$username) {
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

        $items = Yii::$container->get(ItemClaimService::class)
            ->legacyClaimedNewItems($currentUser->username ?? (string)$currentUser->id);

        return array_map(function ($item) use ($currentUser) {
            $response = $this->formatClaimedItemResponse($item);
            if ($response['claimed_by_staff_id'] === null) {
                $response['claimed_by_staff_id'] = $this->normalizeInt($currentUser->id);
            }
            return $response;
        }, $items);
    }

    /** Get all communications for a submission (staff view). */
    public function actionCommunications($id)
    {
        $service = $this->communicationService();
        $submission = $service->findStaffSubmission($id);
        return [
            'messages' => $service->threads($submission->submission_id, false),
            'submission' => [
                'submission_id' => $submission->submission_id,
                'course_code' => $submission->course_code,
                'course_title' => $submission->course_title,
                'status' => $submission->status,
            ],
        ];
    }

    public function actionCreateCommunication($id)
    {
        $currentUser = Yii::$app->user->identity;
        $service = $this->communicationService();
        $submission = $service->findStaffSubmission($id);
        $result = $service->create($submission, Yii::$app->request->post(), [
            'id' => $currentUser->id,
            'name' => $currentUser->full_name ?? $currentUser->username,
            'email' => $currentUser->email,
        ], false);
        if (!$result['saved']) {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $result['communication']->errors];
        }
        return [
            'success' => true,
            'communication' => $service->formatCommunication($result['communication'], false),
            'message' => 'Communication created successfully',
        ];
    }

    public function actionUpdateCommunication($messageId)
    {
        $currentUser = Yii::$app->user->identity;
        $service = $this->communicationService();
        $communication = $service->findMessage($messageId);
        if ($communication->sender_id != (string)$currentUser->id && $currentUser->role !== 'admin') {
            throw new ForbiddenHttpException('You can only edit your own messages');
        }
        if (!$service->update($communication, Yii::$app->request->post(), [
            'id' => $currentUser->id,
        ], false)) {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $communication->errors];
        }
        return [
            'success' => true,
            'communication' => $service->formatCommunication($communication, false),
        ];
    }

    public function actionMarkCommunicationRead($messageId)
    {
        $currentUser = Yii::$app->user->identity;
        $communication = $this->communicationService()->findMessage($messageId);
        $this->communicationService()->markAsRead(
            $communication,
            $currentUser->id,
            \app\models\SubmissionCommunication::ACTOR_STAFF
        );
        return ['success' => true, 'message' => 'Marked as read'];
    }

    protected function communicationService()
    {
        return new \app\services\SubmissionCommunicationService();
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
        if ($item instanceof SubmissionNewResource) {
            $model = $item;
            $item = $model->toArray([], ['submission', 'materialType']);
            $item['claimed_by_staff_id'] = $this->normalizeInt($model->getAttribute('claimed_by_staff_id'));
            $item['claimed_at'] = $model->getAttribute('claimed_at');
        } elseif (is_object($item) && method_exists($item, 'toArray')) {
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

        if (!$assignment) throw new ForbiddenHttpException('You are not assigned to this submission');
        if ($blocked = SubmissionLinkGuard::errorResponse($assignment->submission)) return $blocked;

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
