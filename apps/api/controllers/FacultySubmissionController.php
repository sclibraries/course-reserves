<?php

namespace app\controllers;

use Yii;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\ConflictHttpException;
use yii\data\ActiveDataProvider;
use app\models\FacultySubmission;
use app\models\SubmissionReuseResource;
use app\models\SubmissionNewResource;
use app\models\SubmissionFolder;
use app\models\SubmissionMetadata;
use app\models\MaterialTypes;
use app\models\Course;
use app\models\CourseOffering;
use app\services\{FacultyTokenClaims, SubmissionOwnershipPolicy, SubmissionPayloadService, SubmittedSubmissionUpdateValidator};
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;
use yii\helpers\ArrayHelper;

/**
 * Faculty Submission Controller
 * Handles faculty course reserve submissions
 */
class FacultySubmissionController extends BaseRestController
{
    public $modelClass = 'app\models\FacultySubmission';
    public $serializer = [
        'class' => \yii\rest\Serializer::class,
        'collectionEnvelope' => 'items',
    ];

    // Exempt mock-login from auth and apply its environment/role policy.
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['mockLoginAccess'] = ['class' => \app\filters\MockLoginAccessFilter::class];
        $behaviors['authenticator']['except'][] = 'mock-login';
        return $behaviors;
    }

    public function actions()
    {
        $actions = parent::actions();
        
        // Disable default actions we don't want
        unset($actions['index'], $actions['view'], $actions['create'], $actions['update'], $actions['delete']);
        
        return $actions;
    }

    /**
     * Handle OPTIONS requests for CORS preflight
     * The CORS filter handles most of this, but we provide this action
     * to explicitly allow OPTIONS on all routes
     */
    public function actionOptions($id = null)
    {
        // Return 204 No Content for OPTIONS (standard CORS preflight response)
        Yii::$app->response->statusCode = 204;
        return null;
    }

    /**
     * Mock login endpoint for testing purposes
     * Creates a JWT token for a mock user based on full_name
     * 
     * POST /faculty-submission/mock-login
     * Body: { "full_name": "Synthetic Faculty", "internal_id": "999000001" }
     * 
     * Returns: {
     *   "token": "eyJ...",
     *   "refreshToken": "eyJ...",
     *   "user": { ... }
     * }
     * 
     * WARNING: This endpoint should ONLY be enabled in development!
     * In production, remove this action or add IP restrictions.
     */
    public function actionMockLogin()
    {
        $request = Yii::$app->request;
        $fullName = $request->post('full_name');
        $internalId = $request->post('internal_id');

        if (!$fullName) {
            throw new BadRequestHttpException('full_name is required');
        }

        // Generate username from full name (first initial + last name)
        $parts = preg_split('/\s+/', trim($fullName));
        if (count($parts) < 2) {
            $username = strtolower($parts[0]);
        } else {
            $firstName = $parts[0];
            $lastName = $parts[count($parts) - 1];
            $username = strtolower($firstName[0] . $lastName);
        }

        // Default institution
        $institution = $request->post('institution', 'SM'); // Smith College default
        $role = $request->post('role', 'faculty');
        $email = $username . '@' . $this->getInstitutionDomain($institution);

        // Create access token (8 hours)
        $secretKey = getenv('JWT_SECRET_KEY');
        $issuedAt = time();
        $expire = $issuedAt + FacultyTokenClaims::ACCESS_TOKEN_LIFETIME;

        $identityClaims = [
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'full_name' => $fullName,
            'email' => $email,
            'institution' => $institution,
        ];
        $accessPayload = FacultyTokenClaims::forAuthorization(
            $identityClaims,
            $internalId,
            $issuedAt,
            $expire
        );

        $accessToken = JWT::encode($accessPayload, $secretKey, 'HS256');

        // Create refresh token (24 hours)
        $refreshExpire = $issuedAt + 86400; // 24 hours
        $refreshPayload = FacultyTokenClaims::forAuthorization(
            $identityClaims,
            $internalId,
            $issuedAt,
            $refreshExpire
        );

        $refreshToken = JWT::encode($refreshPayload, $secretKey, 'HS256');

        Yii::info("Mock login created for: $fullName ($username)", 'faculty-auth');

        return [
            'token' => $accessToken,
            'refreshToken' => $refreshToken,
            'user' => [
                'username' => $username,
                'full_name' => $fullName,
                'email' => $email,
                'institution' => $institution,
                'role' => $role,
                'exp' => $expire,
            ],
            'message' => 'Mock login successful. This token is valid for 8 hours.',
            'warning' => 'This is a MOCK token for development only!',
        ];
    }

    /**
     * Get email domain for institution code
     */
    private function getInstitutionDomain($code)
    {
        $domains = [
            'SM' => 'smith.edu',
            'AM' => 'amherst.edu',
            'MH' => 'mtholyoke.edu',
            'HA' => 'hampshire.edu',
            'UM' => 'umass.edu',
        ];
        return $domains[$code] ?? 'smith.edu';
    }

    /**
     * Get faculty's submissions (including those they can access as proxy)
     */
    public function actionIndex()
    {
        $facultyUser = $this->getFacultyUser();
        $request = Yii::$app->request;
        $sortBy = $request->get('sortBy', 'created_at');
        $sortOrder = strtolower($request->get('sortOrder', 'desc')) === 'asc' ? SORT_ASC : SORT_DESC;
        $allowedSort = ['created_at', 'updated_at', 'submitted_at'];
        if (!in_array($sortBy, $allowedSort, true)) {
            $sortBy = 'created_at';
        }

        $ownership = new SubmissionOwnershipPolicy();
        $dataProvider = new ActiveDataProvider([
            'query' => $ownership->accessibleSubmissionsQuery($facultyUser)
                ->orderBy([$sortBy => $sortOrder, 'submission_id' => $sortOrder]),
            // Let per-page and page be controlled by query params (defaults handled by Yii)
        ]);
        $models = $dataProvider->getModels();
        $accessDetails = array_map(function ($submission) use ($ownership, $facultyUser) {
            return $ownership->accessDetails($submission, $facultyUser);
        }, $models);
        $items = (new \app\services\FacultySubmissionResponseBuilder())->index($models, $accessDetails);

        $pagination = $dataProvider->getPagination();
        return \app\services\FacultySubmissionPresenter::submissionIndexResponse([
            'items' => $items,
            'meta' => [
                'totalCount' => $dataProvider->getTotalCount(),
                'count' => $dataProvider->getCount(),
                'page' => $pagination ? ($pagination->getPage() + 1) : 1,
                'perPage' => $pagination ? $pagination->getPageSize() : count($items),
                'sortBy' => $sortBy,
                'sortOrder' => $sortOrder === SORT_ASC ? 'asc' : 'desc',
            ],
        ]);
    }

    /**
     * Return faculty user claims populated by BaseRestController::beforeAction()
     * via the HttpBearerAuth identity.
     *
     * @return array Faculty user data from the JWT identity
     * @throws ForbiddenHttpException if faculty user not authenticated
     */
    protected function getFacultyUser()
    {
        if (!isset(Yii::$app->params['facultyUser'])) {
            throw new ForbiddenHttpException('Faculty user not authenticated');
        }
        
        $facultyUser = Yii::$app->params['facultyUser'];
        $facultyUser['internal_id'] = Yii::$app->user->identity->internalId ?? null;
        return $facultyUser;
    }

    /**
     * Get a specific submission with complete details
     * Includes items, folders, metadata, and processing status
     */
    public function actionView($id)
    {
        $facultyUser = $this->getFacultyUser();
        $submission = (new SubmissionOwnershipPolicy())->findSubmissionWithAccess(
            $id,
            $facultyUser,
            false,
            ['metadata']
        );

        return \app\services\FacultySubmissionPresenter::submissionResponse(
            (new \app\services\FacultySubmissionResponseBuilder())->view($submission)
        );
    }

    /**
     * Get submission status summary (lightweight for polling)
     * Returns just the status counts and progress without full item details
     */
    public function actionStatus($id)
    {
        $facultyUser = $this->getFacultyUser();
        
        $submission = $this->findSubmission($id, $facultyUser);

        // Count items by status
        $reuseStatuses = \app\models\SubmissionReuseResource::find()
            ->select(['item_status', 'COUNT(*) as count'])
            ->where(['submission_id' => $submission->submission_id])
            ->groupBy(['item_status'])
            ->asArray()
            ->all();
        
        $newStatuses = \app\models\SubmissionNewResource::find()
            ->select(['item_status', 'COUNT(*) as count'])
            ->where(['submission_id' => $submission->submission_id])
            ->groupBy(['item_status'])
            ->asArray()
            ->all();
        
        $statusCounts = [
            'pending' => 0,
            'in_progress' => 0,
            'complete' => 0,
            'unavailable' => 0,
        ];
        
        foreach ($reuseStatuses as $stat) {
            $status = $stat['item_status'] ?? 'pending';
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + $stat['count'];
        }
        
        foreach ($newStatuses as $stat) {
            $status = $stat['item_status'] ?? 'pending';
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + $stat['count'];
        }
        
        $totalItems = array_sum($statusCounts);
        
        return \app\services\FacultySubmissionPresenter::statusResponse([
            'submission_id' => $submission->submission_id,
            'course_code' => $submission->course_code,
            'course_title' => $submission->course_title,
            'term_code' => $submission->term_code,
            'overall_status' => $submission->status,
            'submitted_at' => $submission->submitted_at,
            'last_updated' => $submission->updated_at,
            'assignee' => $submission->assignee_staff_user_id,
            'status_summary' => [
                'total_items' => $totalItems,
                'by_status' => $statusCounts,
                'completion_percentage' => $totalItems > 0 
                    ? round(($statusCounts['complete'] / $totalItems) * 100, 1)
                    : 0,
            ],
        ]);
    }

    /**
     * Create new submission (legacy endpoint - kept for backwards compatibility)
     */
    public function actionCreate()
    {
        $facultyUser = $this->getFacultyUser();
        $data = Yii::$app->request->getBodyParams();

        // Validate required fields
        if (empty($data['term_code']) || empty($data['course_code']) || empty($data['course_title'])) {
            throw new BadRequestHttpException('Missing required fields: term_code, course_code, course_title');
        }

        $ownership = (new SubmissionOwnershipPolicy())->resolveOwner(
            $facultyUser,
            $data['acting_for_faculty_id'] ?? null,
            $data['folio_course_listing_id'] ?? null,
            $data
        );
        $facultyId = $ownership['owner_id'];
        $isProxySubmission = $ownership['is_proxy'];
        $permission = $ownership['permission'];

        // Check for existing submission (unique constraint on faculty_id + term_code + course_code + section)
        $existingSubmission = FacultySubmission::find()
            ->where([
                'shibboleth_user_id' => $facultyId,
                'term_code' => $data['term_code'],
                'course_code' => $data['course_code'],
                'section' => $data['section'] ?? ''
            ])
            ->one();

        if ($existingSubmission) {
            throw new BadRequestHttpException('Submission already exists for this course and section');
        }

        $submission = new FacultySubmission();
        $submission->shibboleth_user_id = $facultyId;
        $submission->faculty_display_name = $data['faculty_display_name'] ??
            ($permission ? $permission->faculty_display_name : $facultyUser['display_name']);
        $submission->term_code = $data['term_code'];
        $submission->course_code = $data['course_code'];
        $submission->section = $data['section'] ?? '';
        $submission->course_title = $data['course_title'];
        $submission->folio_course_listing_id = $data['folio_course_listing_id'] ?? null;
        $submission->needed_by_date = $data['needed_by_date'] ?? null;
        $submission->status = FacultySubmission::STATUS_DRAFT;
        
        // Handle proxy submission
        if ($isProxySubmission) {
            $submission->proxy_shibboleth_user_id = $facultyUser['user_id'];
            $submission->proxy_display_name = $facultyUser['display_name'];
        }

        if (!empty($data['submission_notes'])) {
            $submission->submission_notes = $data['submission_notes'];
        }

        if ($submission->save()) {
            return \app\services\FacultySubmissionPresenter::submissionResponse($submission);
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $submission->errors];
        }
    }

    /**
     * Create complete submission from frontend payload
     * Handles the full payload structure with course info, resources, folders, metadata
     */
    public function actionSubmitComplete()
    {
        return (new \app\services\FacultyDraftService())->submitComplete(
            $this->getFacultyUser(),
            Yii::$app->request->getBodyParams()
        );
    }

    protected function validateCompleteSubmissionPayload(array $courseInfo, array $resources): void
    {
        (new \app\services\SubmissionPayloadService())->validate($courseInfo, $resources);
    }

    /** Update a submitted faculty request through the shared locked item writer. */
    public function actionUpdate($id)
    {
        $facultyUser = $this->getFacultyUser();
        $submission = $this->findSubmission($id, $facultyUser, true);

        if ($submission->status === FacultySubmission::STATUS_DRAFT) {
            return (new \app\services\FacultyDraftService())->updateDraft(
                $submission,
                $facultyUser,
                Yii::$app->request->getBodyParams()
            );
        }
        if ($submission->isLocked()) {
            Yii::$app->response->statusCode = 423;
            return [
                'success' => false,
                'error' => 'This submission is locked for processing and cannot be edited',
                'locked_at' => $submission->locked_at,
                'locked_by' => $submission->locked_by_staff_id,
                'lock_reason' => $submission->lock_reason,
            ];
        }
        if (!$submission->canEdit()) {
            throw new BadRequestHttpException('Submission cannot be modified in current status: ' . $submission->status);
        }

        $data = (new SubmittedSubmissionUpdateValidator())->validate(
            $submission, Yii::$app->request->getBodyParams()
        );
        $result = (new \app\services\SubmittedSubmissionUpdateService())->update(
            $submission->submission_id, $data
        );
        if (isset($result['status_code'])) {
            Yii::$app->response->statusCode = $result['status_code'];
            return $result['body'];
        }
        return \app\services\FacultySubmissionPresenter::submissionResponse(
            (new \app\services\FacultySubmissionResponseBuilder())->saved($result['submission'])
        );
    }

    /**
     * Submit the course reserve request
     */
    public function actionSubmit($id)
    {
        $facultyUser = $this->getFacultyUser();
        $submission = $this->findSubmission($id, $facultyUser, true);

        if ($submission->status === FacultySubmission::STATUS_DRAFT) {
            return (new \app\services\FacultyDraftService())->submitDraft($submission, $facultyUser);
        }

        if (!$submission->isEditable()) {
            throw new BadRequestHttpException('Submission cannot be modified in current status');
        }

        // Validate submission has items
        $totalItems = $submission->getReuseResources()->count() + $submission->getNewResources()->count();
        if ($totalItems === 0) {
            throw new BadRequestHttpException('Cannot submit empty course reserve request');
        }

        $submission->status = FacultySubmission::STATUS_SUBMITTED;
        $submission->submitted_at = date('Y-m-d H:i:s');

        if ($submission->save()) {
            // TODO: Send notification to staff
            return ['success' => true, 'message' => 'Submission completed successfully'];
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $submission->errors];
        }
    }

    /**
     * Add reuse resource to submission
     */
    public function actionAddReuseResource($id)
    {
        $facultyUser = $this->getFacultyUser();
        $submission = $this->findSubmission($id, $facultyUser, true);

        if (!$submission->isEditable()) {
            throw new BadRequestHttpException('Submission cannot be modified');
        }

        $data = Yii::$app->request->getBodyParams();
        
        if (empty($data['source_resource_id'])) {
            throw new BadRequestHttpException('source_resource_id is required');
        }

        $reuseResource = new SubmissionReuseResource();
        $reuseResource->submission_id = $submission->submission_id;
        $reuseResource->source_resource_id = $data['source_resource_id'];
        $reuseResource->display_order = $data['display_order'] ?? 999;
        $reuseResource->folder_name = $data['folder_name'] ?? null;
        $reuseResource->faculty_notes = $data['faculty_notes'] ?? null;
        $reuseResource->assigned_pages = $data['assignedPages'] ?? $data['assigned_pages'] ?? null;

        if ($reuseResource->save()) {
            return \app\services\FacultySubmissionPresenter::resourceResponse($reuseResource);
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $reuseResource->errors];
        }
    }

    /**
     * Add new resource to submission
     */
    public function actionAddNewResource($id)
    {
        $facultyUser = $this->getFacultyUser();
        $submission = $this->findSubmission($id, $facultyUser, true);

        if (!$submission->isEditable()) {
            throw new BadRequestHttpException('Submission cannot be modified');
        }

        $data = Yii::$app->request->getBodyParams();
        
        if (empty($data['material_type_id']) || empty($data['resource_data'])) {
            throw new BadRequestHttpException('material_type_id and resource_data are required');
        }

        $newResource = new SubmissionNewResource();
        $newResource->submission_id = $submission->submission_id;
        $newResource->material_type_id = $data['material_type_id'];
        $newResource->resource_data = json_encode($data['resource_data']);
        $newResource->display_order = $data['display_order'] ?? 999;
        $newResource->folder_name = $data['folder_name'] ?? null;
        $newResource->faculty_notes = $data['faculty_notes'] ?? null;
        $newResource->assigned_pages = $data['assignedPages'] ?? $data['assigned_pages'] ?? null;
        $newResource->priority = $data['priority'] ?? SubmissionNewResource::PRIORITY_MEDIUM;

        if ($newResource->save()) {
            return \app\services\FacultySubmissionPresenter::resourceResponse($newResource);
        } else {
            Yii::$app->response->statusCode = 422;
            return ['errors' => $newResource->errors];
        }
    }

    /**
     * Get faculty's course history for FOLIO course lookup
     */
    public function actionCourseHistory()
    {
        $facultyUser = $this->getFacultyUser();
        
        // TODO: Implement FOLIO API integration here
        // For now, return placeholder data
        
        return [
            'faculty_name' => $facultyUser['display_name'],
            'courses' => [
                // This would come from FOLIO API
                [
                    'folio_course_listing_id' => 'ABC123',
                    'course_title' => 'Introduction to Psychology PSYC 101',
                    'term_code' => 'SP25',
                    'course_code' => 'PSYC101',
                    'section' => '01',
                    'term_name' => 'Spring 2025',
                    'has_existing_resources' => false
                ]
            ]
        ];
    }

    /**
     * Get material types for form building
     */
    public function actionMaterialTypes()
    {
        return MaterialTypes::find()
            ->with('materialTypeFields')
            ->orderBy(['name' => SORT_ASC])
            ->all();
    }

    /**
     * Get faculty-visible communications for a submission.
     */
    public function actionCommunications($id)
    {
        $facultyUser = $this->getFacultyUser();
        $service = $this->communicationService();
        $submission = $service->findFacultySubmission($id);
        if (!(new SubmissionOwnershipPolicy())->canAccess($submission, $facultyUser)) {
            throw new ForbiddenHttpException('Access denied to this submission');
        }
        return \app\services\FacultySubmissionPresenter::facultyCommunicationsResponse(['messages' => $service->threads($submission->submission_id, true)]);
    }

    public function actionCreateCommunication($id)
    {
        $facultyUser = $this->getFacultyUser();
        $service = $this->communicationService();
        $submission = $service->findFacultySubmission($id);
        if (!(new SubmissionOwnershipPolicy())->canAccess($submission, $facultyUser, true)) {
            throw new ForbiddenHttpException('Access denied to this submission');
        }
        $result = $service->create($submission, Yii::$app->request->post(), [
            'id' => $facultyUser['user_id'],
            'name' => $facultyUser['display_name'],
            'email' => $facultyUser['email'],
        ], true);
        if (!$result['saved']) {
            return ['success' => false, 'errors' => $result['communication']->getErrors()];
        }
        return [
            'success' => true,
            'message_id' => $result['communication']->id,
            'message' => 'Message sent successfully',
        ];
    }

    public function actionUpdateCommunication($id, $messageId)
    {
        $facultyUser = $this->getFacultyUser();
        $service = $this->communicationService();
        $submission = $service->findFacultySubmission($id);
        if (!(new SubmissionOwnershipPolicy())->canAccess($submission, $facultyUser, true)) {
            throw new ForbiddenHttpException('Access denied to this submission');
        }
        $communication = $service->findMessage($messageId, $submission->submission_id, true);
        if ($communication->sender_id !== $facultyUser['user_id']) {
            throw new ForbiddenHttpException('You can only edit your own messages');
        }
        if (!$service->update($communication, Yii::$app->request->post(), [
            'id' => $facultyUser['user_id'],
        ], true)) {
            return ['success' => false, 'errors' => $communication->getErrors()];
        }
        return [
            'success' => true,
            'message_id' => $communication->id,
            'message' => 'Message updated successfully',
        ];
    }

    public function actionDeleteCommunication($id, $messageId)
    {
        $facultyUser = $this->getFacultyUser();
        $service = $this->communicationService();
        $submission = $service->findFacultySubmission($id);
        if (!(new SubmissionOwnershipPolicy())->canAccess($submission, $facultyUser, true)) {
            throw new ForbiddenHttpException('Access denied to this submission');
        }
        $communication = $service->findMessage($messageId, $submission->submission_id, true);
        if ($communication->sender_id !== $facultyUser['user_id']) {
            throw new ForbiddenHttpException('You can only delete your own messages');
        }
        if (!$service->archiveFacultyMessage($communication, ['id' => $facultyUser['user_id']])) {
            return ['success' => false, 'message' => 'Cannot delete message with replies'];
        }
        return ['success' => true, 'message' => 'Message deleted successfully'];
    }

    public function actionMarkCommunicationRead($id, $messageId)
    {
        $facultyUser = $this->getFacultyUser();
        $service = $this->communicationService();
        $submission = $service->findFacultySubmission($id);
        if (!(new SubmissionOwnershipPolicy())->canAccess($submission, $facultyUser, true)) {
            throw new ForbiddenHttpException('Access denied to this submission');
        }
        $communication = $service->findMessage($messageId, $submission->submission_id, true);
        $service->markAsRead($communication, $facultyUser['user_id'], 'faculty');
        return ['success' => true, 'message' => 'Message marked as read'];
    }

    protected function communicationService()
    {
        return new \app\services\SubmissionCommunicationService();
    }

    /**
     * Lock a submission for processing (Staff only)
     * POST /faculty-submission/{id}/lock
     */
    public function actionLock($id)
    {
        $userCtx = $this->getStaffLockContext(
            Yii::$app->params['staffUser'] ?? Yii::$app->params['facultyUser'] ?? null
        );

        $data = Yii::$app->request->getBodyParams();
        $staffId = $userCtx['user_id'];
        $reason = $data['reason'] ?? $data['lock_reason'] ?? 'Locked for processing';

        $submission = FacultySubmission::find()
            ->where(['submission_id' => $id])
            ->orWhere(['submission_uuid' => $id])
            ->one();

        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }

        $this->assertSubmissionCanBeLocked($submission);

        if ($submission->lock($staffId, $reason)) {
            return [
                'success' => true,
                'message' => 'Submission locked successfully',
                'lock_status' => $submission->getLockStatus(),
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return [
                'success' => false,
                'message' => 'Failed to lock submission',
                'errors' => $submission->errors,
            ];
        }
    }

    /**
     * Unlock a submission (Staff only)
     * POST /faculty-submission/{id}/unlock
     */
    public function actionUnlock($id)
    {
        $this->getStaffLockContext(
            Yii::$app->params['staffUser'] ?? Yii::$app->params['facultyUser'] ?? null
        );

        $submission = FacultySubmission::find()
            ->where(['submission_id' => $id])
            ->orWhere(['submission_uuid' => $id])
            ->one();

        if (!$submission) {
            throw new NotFoundHttpException('Submission not found');
        }

        $this->assertSubmissionCanBeUnlocked($submission);

        if ($submission->unlock()) {
            return [
                'success' => true,
                'message' => 'Submission unlocked successfully',
                'lock_status' => $submission->getLockStatus(),
            ];
        } else {
            Yii::$app->response->statusCode = 422;
            return [
                'success' => false,
                'message' => 'Failed to unlock submission',
                'errors' => $submission->errors,
            ];
        }
    }

    private function getStaffLockContext($userCtx): array
    {
        if (
            !is_array($userCtx)
            || !\app\components\Roles::isStaff($userCtx['role'] ?? '')
            || empty($userCtx['user_id'])
        ) {
            throw new ForbiddenHttpException('Staff authentication required to lock submissions');
        }

        return $userCtx;
    }

    private function assertSubmissionCanBeLocked($submission): void
    {
        if ($submission->isLocked()) {
            throw new ConflictHttpException('Submission is already locked');
        }
    }

    private function assertSubmissionCanBeUnlocked($submission): void
    {
        if (!$submission->isLocked()) {
            throw new ConflictHttpException('Submission is not locked');
        }
    }

    /**
     * Helper method to find submission with ownership check
     */
    /**
     * Helper method to find submission with ownership check
     * Supports both numeric ID and UUID
     */
    protected function findSubmission($id, array $facultyUser, $requireEdit = false)
    {
        return (new SubmissionOwnershipPolicy())->findSubmissionWithAccess($id, $facultyUser, $requireEdit);
    }

}
