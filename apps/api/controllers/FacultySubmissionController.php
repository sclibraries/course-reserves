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
use app\services\FacultyTokenClaims;
use app\services\SubmissionOwnershipPolicy;
use app\services\SubmissionMaterializationGuard;
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

        // Create access token (1 hour)
        $secretKey = getenv('JWT_SECRET_KEY');
        $issuedAt = time();
        $expire = $issuedAt + 3600; // 1 hour

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
            'message' => 'Mock login successful. This token is valid for 1 hour.',
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
                ->with(['reuseResources', 'newResources'])
                ->orderBy([$sortBy => $sortOrder]),
            // Let per-page and page be controlled by query params (defaults handled by Yii)
        ]);

        $models = $dataProvider->getModels();
        $items = array_map(function($m) use ($ownership, $facultyUser) {
            $item = $m->toArray();
            
            // Get all resources (unified table with is_reuse flag)
            $allResources = $m->getNewResources()->all();
            
            // Get folders with display order
            $folders = $m->getFolders()
                ->orderBy(['display_order' => SORT_ASC])
                ->all();
            
            // Count by type
            $reuseCount = 0;
            $newCount = 0;
            $totalComplete = 0;
            
            foreach ($allResources as $resource) {
                if ($resource->is_reuse) {
                    $reuseCount++;
                } else {
                    $newCount++;
                }
                
                if ($resource->item_status === 'complete') {
                    $totalComplete++;
                }
            }
            
            $totalItems = count($allResources);
            
            $item['item_counts'] = [
                'total' => $totalItems,
                'reuse' => $reuseCount,
                'new' => $newCount,
                'complete' => $totalComplete,
                'pending' => $totalItems - $totalComplete,
            ];
            
            $item['completion_percentage'] = $totalItems > 0 
                ? round(($totalComplete / $totalItems) * 100, 1)
                : 0;
            
            // Organize materials by folder
            $folderStructure = [];
            $unfolderedItems = [];
            
            // First, create folder structure with metadata
            foreach ($folders as $folder) {
                $folderStructure[$folder->folder_name] = [
                    'id' => $folder->folder_id,
                    'name' => $folder->folder_name,
                    'display_order' => $folder->display_order,
                    'items' => [],
                ];
            }
            
            // Then, assign materials to their folders
            foreach ($allResources as $resource) {
                $resourceData = json_decode($resource->resource_data, true) ?? [];
                $materialItem = [
                    'id' => $resource->id,
                    'title' => $resourceData['title'] ?? 'Untitled',
                    'authors' => $resourceData['authors'] ?? null,
                    'material_type' => $resourceData['materialType'] ?? 'book',
                    'is_reuse' => (bool)$resource->is_reuse,
                    'barcode' => $resource->is_reuse ? $resource->source_barcode : ($resourceData['barcode'] ?? null),
                    'call_number' => $resource->is_reuse ? $resource->source_call_number : ($resourceData['callNumber'] ?? null),
                    'status' => $resource->item_status,
                    'display_order' => $resource->display_order,
                    'folder_name' => $resource->folder_name,
                ];
                
                // Add to appropriate folder or unfoldered list
                if ($resource->folder_name && isset($folderStructure[$resource->folder_name])) {
                    $folderStructure[$resource->folder_name]['items'][] = $materialItem;
                } else {
                    $unfolderedItems[] = $materialItem;
                }
            }
            
            // Sort items within each folder by display_order
            foreach ($folderStructure as &$folder) {
                usort($folder['items'], function($a, $b) {
                    return $a['display_order'] - $b['display_order'];
                });
            }
            unset($folder);
            
            // Sort unfoldered items by display_order
            usort($unfolderedItems, function($a, $b) {
                return $a['display_order'] - $b['display_order'];
            });
            
            // Convert folder structure to array sorted by folder display_order
            $foldersArray = array_values($folderStructure);
            usort($foldersArray, function($a, $b) {
                return $a['display_order'] - $b['display_order'];
            });
            
            // Add count to each folder
            foreach ($foldersArray as &$folder) {
                $folder['item_count'] = count($folder['items']);
            }
            unset($folder);
            
            $item['folders'] = $foldersArray;
            $item['unfoldered_items'] = $unfolderedItems;
            
            // Add frontend-friendly fields
            $item['id'] = $m->submission_uuid; // UUID for frontend
            $item['instructors'] = $m->faculty_display_name ?? '';
            $item['term'] = $this->formatTermCode($m->term_code);
            $item['lastUpdated'] = $m->updated_at ? date('M j, Y', strtotime($m->updated_at)) : null;
            $item['isTestData'] = false; // Set based on your test data criteria
            
            // Add lock status information
            $item['is_locked'] = (bool)$m->is_locked;
            $item['locked_at'] = $m->locked_at;
            $item['locked_by'] = $m->locked_by_staff_id;
            $item['lock_reason'] = $m->lock_reason;
            $item['can_edit'] = $m->canEdit();

            $access = $ownership->accessDetails($m, $facultyUser);
            $item['access'] = $access['access'];
            if ($access['access'] === 'proxy') {
                $item['proxy_can_edit'] = $access['proxy_can_edit'];
            }
            
            return $item;
        }, $models);

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
     * Format term code (e.g., "202602" -> "2026 Winter" or return as-is if already formatted)
     * 
     * @param string $termCode Term code in format YYYYSS or already formatted like "2026 Winter"
     * @return string Formatted term like "2026 Winter"
     */
    protected function formatTermCode($termCode)
    {
        if (!$termCode) {
            return $termCode;
        }
        
        // If already formatted (contains space), return as-is
        if (strpos($termCode, ' ') !== false) {
            return $termCode;
        }
        
        // Otherwise parse as YYYYSS format
        if (strlen($termCode) < 6) {
            return $termCode;
        }
        
        $year = substr($termCode, 0, 4);
        $semester = substr($termCode, 4, 2);
        
        $semesterMap = [
            '01' => 'Spring',
            '02' => 'Winter',
            '05' => 'Summer',
            '09' => 'Fall',
        ];
        
        $semesterName = $semesterMap[$semester] ?? 'Term ' . $semester;
        
        return "$year $semesterName";
    }

    /**
     * Get a specific submission with complete details
     * Includes items, folders, metadata, and processing status
     */
    public function actionView($id)
    {
        $facultyUser = $this->getFacultyUser();
        
        $submission = (new SubmissionOwnershipPolicy())->findSubmissionWithAccess($id, $facultyUser, false, [
                'reuseResources' => function($query) {
                    $query->orderBy(['display_order' => SORT_ASC, 'position_in_folder' => SORT_ASC]);
                },
                'newResources' => function($query) {
                    $query->orderBy(['display_order' => SORT_ASC, 'position_in_folder' => SORT_ASC]);
                },
                'folders' => function($query) {
                    $query->orderBy(['display_order' => SORT_ASC]);
                },
                'metadata'
            ]);

        // Build structured response with folders and items
        $response = $submission->toArray();
        
        // Get all items (reuse + new)
        $allItems = [];
        foreach ($submission->reuseResources as $item) {
            $allItems[] = [
                'type' => 'reuse',
                'id' => $item->id,
                'display_order' => $item->display_order,
                'position_in_folder' => $item->position_in_folder,
                'folder_name' => $item->folder_name,
                'barcode' => $item->barcode,
                'call_number' => $item->call_number,
                'status' => $item->item_status,
                'notes' => $item->faculty_notes,
                'created_at' => $item->created_at,
            ];
        }
        
        foreach ($submission->newResources as $item) {
            $resourceData = json_decode($item->resource_data, true);
            $allItems[] = [
                'type' => 'new',
                'id' => $item->id,
                'display_order' => $item->display_order,
                'position_in_folder' => $item->position_in_folder,
                'folder_name' => $item->folder_name,
                'title' => $resourceData['title'] ?? '',
                'authors' => $resourceData['authors'] ?? '',
                'status' => $item->item_status,
                'priority' => $item->priority,
                'notes' => $item->faculty_notes,
                'created_at' => $item->created_at,
                'updated_at' => $item->updated_at,
            ];
        }
        
        // Get folders
        $folders = [];
        foreach ($submission->folders as $folder) {
            $folderItems = array_filter($allItems, function($item) use ($folder) {
                return $item['folder_name'] === $folder->folder_name;
            });
            
            // Sort folder items by position_in_folder
            usort($folderItems, function($a, $b) {
                return ($a['position_in_folder'] ?? 999) <=> ($b['position_in_folder'] ?? 999);
            });
            
            $folders[] = [
                'folder_id' => $folder->folder_id,
                'name' => $folder->folder_name,
                'display_order' => $folder->display_order,
                'item_count' => count($folderItems),
                'items' => array_values($folderItems),
            ];
        }
        
        // Get ungrouped items (not in folders)
        $ungroupedItems = array_filter($allItems, function($item) {
            return $item['folder_name'] === null;
        });
        
        // Calculate status summary
        $statusCounts = [
            'pending' => 0,
            'in_progress' => 0,
            'complete' => 0,
            'unavailable' => 0,
        ];
        
        foreach ($allItems as $item) {
            $status = $item['status'] ?? 'pending';
            if (isset($statusCounts[$status])) {
                $statusCounts[$status]++;
            } else {
                $statusCounts['pending']++;
            }
        }
        
        $response['folders'] = $folders;
        $response['ungrouped_items'] = array_values($ungroupedItems);
        $response['metadata'] = $submission->metadata ? $submission->metadata->toArray() : null;
        $response['status_summary'] = [
            'total_items' => count($allItems),
            'by_status' => $statusCounts,
            'completion_percentage' => count($allItems) > 0 
                ? round(($statusCounts['complete'] / count($allItems)) * 100, 1)
                : 0,
        ];
        
        return \app\services\FacultySubmissionPresenter::submissionResponse($response);
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
        $facultyUser = $this->getFacultyUser();
        $data = Yii::$app->request->getBodyParams();
        $isStaff = \app\components\Roles::isStaff($facultyUser['role'] ?? null);
        $itsCourseId = $data['its_course_id'] ?? null;
        $academicPeriod = $data['academic_period'] ?? null;
        $hasItsCourseId = is_string($itsCourseId) && trim($itsCourseId) !== '';
        $hasAcademicPeriod = is_string($academicPeriod) && trim($academicPeriod) !== '';
        if ($hasItsCourseId !== $hasAcademicPeriod || (!$isStaff && !$hasItsCourseId)) {
            Yii::$app->response->statusCode = 422;
            return ['error_code' => 'roster_course_required'];
        }

        if (empty($data['courseInfo'])) {
            throw new BadRequestHttpException('Missing courseInfo');
        }
        $courseInfo = $data['courseInfo'];
        $resources = $data['resources'] ?? [];
        $folders = $data['folders'] ?? [];
        $metadata = $data['metadata'] ?? [];
        $displayOrder = $data['displayOrder'] ?? [];
        $submittedBy = $metadata['submittedBy'] ?? [];
        $this->validateCompleteSubmissionPayload($courseInfo, $resources);
        $folioCourseListingId = $data['folio_course_listing_id'] ?? null;
        $ownership = (new SubmissionOwnershipPolicy())->resolveOwner(
            $facultyUser,
            $data['acting_for_faculty_id'] ?? null,
            $folioCourseListingId,
            $courseInfo,
            $hasItsCourseId ? $itsCourseId : null,
            $hasAcademicPeriod ? $academicPeriod : null
        );
        if (isset($ownership['error_code'])) {
            Yii::$app->response->statusCode = $ownership['status_code'];
            return ['error_code' => $ownership['error_code']];
        }
        $facultyId = $ownership['owner_id'];
        $isProxySubmission = $ownership['is_proxy'];
        $rosterCourse = $ownership['roster_course'] ?? null;
        $termCode = $rosterCourse['term_code'] ?? $courseInfo['term'];
        $courseCode = $rosterCourse['course_code'] ?? $courseInfo['courseCode'];
        $section = $rosterCourse['section'] ?? $courseInfo['section'] ?? '';
        $courseTitle = $rosterCourse['course_title'] ?? $courseInfo['courseTitle'];

        $duplicateCriteria = $rosterCourse !== null
            ? ['its_course_id' => $rosterCourse['its_course_id'], 'academic_period' => $rosterCourse['academic_period']]
            : ['term_code' => $termCode, 'course_code' => $courseCode, 'section' => $section];
        $existingSubmission = FacultySubmission::find()
            ->where(['shibboleth_user_id' => $facultyId])
            ->andWhere($duplicateCriteria)
            ->one();

        if ($existingSubmission) {
            throw new BadRequestHttpException('Submission already exists for this course and section');
        }
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $submission = new FacultySubmission();
            $submission->shibboleth_user_id = $facultyId;
            $submission->faculty_display_name = $courseInfo['instructors'] ?? $submittedBy['fullName'] ?? $facultyUser['display_name'];
            $submission->term_code = $termCode;
            $submission->course_code = $courseCode;
            $submission->section = $section;
            $submission->course_title = $courseTitle;
            $submission->its_course_id = $rosterCourse['its_course_id'] ?? null;
            $submission->academic_period = $rosterCourse['academic_period'] ?? null;
            $submission->roster_term_id = $rosterCourse['roster_term_id'] ?? null;
            $submission->folio_course_listing_id = $folioCourseListingId;
            $submission->status = FacultySubmission::STATUS_SUBMITTED;
            $submission->submitted_at = date('Y-m-d H:i:s');

            if (!empty($metadata['duplicatePreviousCourse'])) {
                $submission->is_duplicate_previous = 1;
                $submission->duplicate_note = $metadata['duplicateNote'] ?? null;
            }
            \app\services\SubmissionConfirmationState::request($submission, !empty($metadata['emailConfirmation']));

            if ($isProxySubmission) {
                $submission->proxy_shibboleth_user_id = $facultyUser['user_id'];
                $submission->proxy_display_name = $facultyUser['display_name'];
            }

            if (!$submission->save()) {
                throw new \Exception('Failed to save submission: ' . json_encode($submission->errors));
            }

            $folderIdMap = [];
            foreach ($folders as $folder) {
                $folderMapping = $this->createSubmissionFolder($submission->submission_id, $folder, $displayOrder);
                $folderIdMap = array_merge($folderIdMap, $folderMapping);
            }

            $processedResources = 0;
            foreach ($resources as $index => $resource) {
                $processedResources += $this->processSubmissionResource(
                    $submission->submission_id, 
                    $resource,
                    $folderIdMap,
                    $index
                );
            }

            $this->storeSubmissionMetadata($submission->submission_id, $metadata, $data, $facultyUser);

            $transaction->commit();

            return \app\services\FacultySubmissionPresenter::submitCompleteResponse([
                'success' => true,
                'message' => 'Submission completed successfully',
                'submission' => \app\services\SubmissionConfirmationState::projectResponse($submission),
                'stats' => [
                    'resources_processed' => $processedResources,
                    'folders_created' => count($folders),
                    'reuse_items' => $metadata['reuseItems'] ?? 0,
                    'new_items' => $metadata['newItems'] ?? 0,
                ]
            ]);
        } catch (\Exception $e) {
            $transaction->rollBack();
            Yii::error('Submission creation failed: ' . $e->getMessage(), __METHOD__);
            throw new BadRequestHttpException('Failed to create submission: ' . $e->getMessage());
        }
    }

    /**
     * Process individual submission resource using new unified structure
     * Resources come pre-structured from frontend with all necessary fields
     */
    protected function processSubmissionResource($submissionId, $resource, $folderIdMap = [], $resourceIndex = 0)
    {
        // Extract data from the resource structure
        $isReuse = $resource['is_reuse'] ?? false;
        $displayOrder = $resource['display_order'] ?? $resourceIndex;
        $folderName = $resource['folder_name'] ?? null;
        $positionInFolder = $resource['position_in_folder'] ?? null;
        $facultyNotes = $resource['faculty_notes'] ?? null;
        $priority = $resource['priority'] ?? 'medium';
        $resourceData = $resource['resource_data'] ?? [];
        
        // Get material type from resource_data
        $materialTypeName = $resourceData['materialType'] ?? 'book';
        $materialTypeId = $this->getMaterialTypeIdByName($materialTypeName);
        
        if (!$materialTypeId) {
            Yii::warning("Could not find material type for: $materialTypeName", __METHOD__);
            $materialTypeId = 1; // Default to book
        }
        
        // Create new resource using unified table
        $newResource = new SubmissionNewResource();
        $newResource->submission_id = $submissionId;
        $newResource->material_type_id = $materialTypeId;
        $newResource->resource_data = json_encode($resourceData);
        $newResource->is_reuse = $isReuse ? 1 : 0;
        $newResource->source_barcode = $isReuse ? ($resource['source_barcode'] ?? null) : null;
        $newResource->source_call_number = $isReuse ? ($resource['source_call_number'] ?? null) : null;
        $newResource->source_resource_id = $isReuse ? ($resource['source_resource_id'] ?? null) : null;
        $newResource->source_folio_instance_id = $isReuse ? ($resource['source_folio_instance_id'] ?? null) : null;
        $newResource->display_order = $displayOrder;
        $newResource->folder_name = $folderName;
        $newResource->position_in_folder = $positionInFolder;
        $newResource->faculty_notes = $facultyNotes;
        $newResource->priority = $priority;
        $newResource->item_status = 'pending';
        
        if (!$newResource->save()) {
            throw new \Exception('Failed to save resource: ' . json_encode($newResource->errors));
        }
        
        return 1;
    }

    private function validateCompleteSubmissionPayload(array $courseInfo, array $resources): void
    {
        $requiredCourseFields = [
            'courseCode' => 'courseCode',
            'courseTitle' => 'courseTitle',
            'term' => 'term',
        ];

        foreach ($requiredCourseFields as $field => $label) {
            if (!isset($courseInfo[$field]) || trim((string)$courseInfo[$field]) === '') {
                throw new BadRequestHttpException("Missing required course information: {$label}");
            }
        }

        foreach ($resources as $index => $resource) {
            $resourceData = $resource['resource_data'] ?? [];
            if (!is_array($resourceData)) {
                throw new BadRequestHttpException("Resource {$index} must include structured resource_data");
            }

            if (!isset($resourceData['title']) || trim((string)$resourceData['title']) === '') {
                throw new BadRequestHttpException("Resource {$index} is missing required title");
            }

            if (isset($resourceData['url']) && trim((string)$resourceData['url']) !== '') {
                $url = trim((string)$resourceData['url']);
                if (!filter_var($url, FILTER_VALIDATE_URL)) {
                    throw new BadRequestHttpException("Resource {$index} has an invalid URL");
                }
            }
        }
    }

    /**
     * Process individual submission item (DEPRECATED - use processSubmissionResource instead)
     * Kept for backward compatibility
     */
    protected function processSubmissionItem($submissionId, $item, $displayOrder = [], $folderIdMap = [], $itemIndex = 0, $positionInFolder = null)
    {
        // Extract barcode and call number from notes if present
        $barcode = null;
        $callNumber = null;
        if (!empty($item['notes'])) {
            // Parse: "Call Number: DC148 .D5313 1989 | Barcode: 310183606685598"
            if (preg_match('/Barcode:\s*([^\s|]+)/', $item['notes'], $matches)) {
                $barcode = trim($matches[1]);
            }
            if (preg_match('/Call Number:\s*([^|]+)/', $item['notes'], $matches)) {
                $callNumber = trim($matches[1]);
            }
        }

        // Find display order for this item
        $displayPos = 999;
        foreach ($displayOrder as $orderItem) {
            if ($orderItem['id'] === $item['id']) {
                $displayPos = $orderItem['displayPosition'] ?? 999;
                break;
            }
        }
        
        // If not found in displayOrder (likely in a folder), use the item's array index
        // This preserves the order items appear in the payload
        if ($displayPos === 999) {
            $displayPos = $itemIndex;
        }

        // Determine folder name if item belongs to a folder
        $folderName = null;
        if (!empty($item['folderId'])) {
            // Normalize folder ID (remove "folder-" prefix if present)
            $normalizedFolderId = str_replace('folder-', '', $item['folderId']);
            $folderName = $folderIdMap[$normalizedFolderId] ?? $folderIdMap[$item['folderId']] ?? null;
        }

        // If item has barcode, it's a reuse item
        if ($barcode) {
            $reuseResource = new SubmissionReuseResource();
            $reuseResource->submission_id = $submissionId;
            $reuseResource->source_resource_id = null; // Will be matched later by staff
            $reuseResource->barcode = $barcode;
            $reuseResource->call_number = $callNumber;
            $reuseResource->display_order = $displayPos;
            $reuseResource->folder_name = $folderName;
            $reuseResource->position_in_folder = $positionInFolder;
            $reuseResource->faculty_notes = $item['notes'] ?? null;
            
            if (!$reuseResource->save()) {
                throw new \Exception('Failed to save reuse resource: ' . json_encode($reuseResource->errors));
            }
            return 1;
        } else {
            // Otherwise treat as new resource request
            $newResource = new SubmissionNewResource();
            $newResource->submission_id = $submissionId;
            $newResource->material_type_id = $this->getMaterialTypeIdByName($item['materialType'] ?? 'book');
            $newResource->resource_data = json_encode([
                'title' => $item['title'] ?? '',
                'authors' => $item['authors'] ?? '',
                'publisher' => $item['publisher'] ?? '',
                'publicationYear' => $item['publicationYear'] ?? '',
                'materialType' => $item['materialType'] ?? 'book',
                'isbn' => $item['isbn'] ?? '',
                'notes' => $item['notes'] ?? '',
            ]);
            $newResource->display_order = $displayPos;
            $newResource->folder_name = $folderName;
            $newResource->position_in_folder = $positionInFolder;
            $newResource->faculty_notes = $item['notes'] ?? null;
            $newResource->priority = SubmissionNewResource::PRIORITY_MEDIUM;
            
            if (!$newResource->save()) {
                throw new \Exception('Failed to save new resource: ' . json_encode($newResource->errors));
            }
            return 1;
        }
    }

    /**
     * Create submission folder and return ID map
     */
    protected function createSubmissionFolder($submissionId, $folder, $displayOrder)
    {
        // Find display order for this folder
        $displayPos = 999;
        $folderId = $folder['id'];
        foreach ($displayOrder as $orderItem) {
            if ($orderItem['id'] === $folderId) {
                $displayPos = $orderItem['displayPosition'] ?? 999;
                break;
            }
        }

        // Insert folder record
        $sql = "INSERT INTO submission_folders 
                (submission_id, folder_name, display_order)
                VALUES 
                (:submission_id, :folder_name, :display_order)";
        
        Yii::$app->db->createCommand($sql, [
            ':submission_id' => $submissionId,
            ':folder_name' => $folder['title'] ?? 'Untitled Folder',
            ':display_order' => $displayPos,
        ])->execute();
        
        $dbFolderId = Yii::$app->db->getLastInsertID();
        
        // Return mapping of frontend folder ID to folder name
        // We'll use folder title as the folder_name in items
        $normalizedId = str_replace('folder-', '', $folderId);
        return [
            $folderId => $folder['title'] ?? 'Untitled Folder',
            $normalizedId => $folder['title'] ?? 'Untitled Folder',
        ];
    }

    /**
     * Store submission metadata
     */
    protected function storeSubmissionMetadata($submissionId, $metadata, $fullPayload, $facultyUser)
    {
        $sql = "INSERT INTO submission_metadata 
                (submission_id, total_items, total_folders, items_in_folders, ungrouped_items,
                 submitted_by_user_id, submitted_by_username, submitted_by_full_name, 
                 submitted_by_email, submitted_by_institution, raw_payload)
                VALUES 
                (:submission_id, :total_items, :total_folders, :items_in_folders, :ungrouped_items,
                 :user_id, :username, :full_name, :email, :institution, :raw_payload)";
        
        Yii::$app->db->createCommand($sql, [
            ':submission_id' => $submissionId,
            ':total_items' => $metadata['totalItems'] ?? 0,
            ':total_folders' => $metadata['totalFolders'] ?? 0,
            ':items_in_folders' => $metadata['itemsInFolders'] ?? 0,
            ':ungrouped_items' => $metadata['ungroupedItems'] ?? 0,
            ':user_id' => $facultyUser['user_id'],
            ':username' => $facultyUser['user_id'],
            ':full_name' => $facultyUser['display_name'] ?? null,
            ':email' => $facultyUser['email'] ?? null,
            ':institution' => $facultyUser['institution'] ?? null,
            ':raw_payload' => json_encode($fullPayload),
        ])->execute();
        
        return true;
    }

    /**
     * Get material type ID by name (with caching)
     */
    protected function getMaterialTypeIdByName($typeName)
    {
        static $typeCache = [];
        
        if (isset($typeCache[$typeName])) {
            return $typeCache[$typeName];
        }
        
        $materialType = MaterialTypes::find()
            ->where(['name' => $typeName])
            ->one();
        
        if ($materialType) {
            $typeCache[$typeName] = $materialType->material_type_id;
            return $materialType->material_type_id;
        }
        
        // Default to book type or return null
        $bookType = MaterialTypes::find()
            ->where(['name' => 'book'])
            ->one();
        
        return $bookType ? $bookType->material_type_id : null;
    }

    /**
     * Update submission
     */
    public function actionUpdate($id)
    {
        $facultyUser = $this->getFacultyUser();
        $submission = $this->findSubmission($id, $facultyUser, true);

        // Check if submission is locked
        if ($submission->isLocked()) {
            Yii::$app->response->statusCode = 423; // 423 Locked
            return [
                'success' => false,
                'error' => 'This submission is locked for processing and cannot be edited',
                'locked_at' => $submission->locked_at,
                'locked_by' => $submission->locked_by_staff_id,
                'lock_reason' => $submission->lock_reason,
            ];
        }

        // Check if submission can be edited (not complete/canceled)
        if (!$submission->canEdit()) {
            throw new BadRequestHttpException('Submission cannot be modified in current status: ' . $submission->status);
        }

        $data = Yii::$app->request->getBodyParams();
        (new SubmissionOwnershipPolicy())->assertUpdateDoesNotChangeOwnership($data);

        if (isset($data['items']) || isset($data['folders'])) {
            $existingItems = SubmissionNewResource::find()
                ->where(['submission_id' => $submission->submission_id])
                ->orderBy(['id' => SORT_ASC])
                ->asArray()
                ->all();
            $foldersData = isset($data['folders']) && is_array($data['folders']) ? $data['folders'] : [];
            $folderUuidToNameMap = SubmissionMaterializationGuard::folderUuidToNameMap($foldersData);
            $guard = new SubmissionMaterializationGuard();
            $incomingItems = isset($data['items']) && is_array($data['items']) ? $data['items'] : [];

            if (!isset($data['items']) && isset($data['folders'])) {
                $incomingItems = $guard->incomingItemsAfterFolderUpdate($existingItems, $foldersData);
            }

            $changedMaterializedItemIds = $guard->changedMaterializedItemIds(
                $existingItems,
                $incomingItems,
                $folderUuidToNameMap
            );
            if ($changedMaterializedItemIds) {
                Yii::$app->response->statusCode = 409;
                return [
                    'success' => false,
                    'error_code' => 'materialized_item_correction_required',
                    'message' => 'Processed course-reserve items must be corrected by library staff.',
                    'submission_uuid' => $submission->submission_uuid,
                    'item_ids' => $changedMaterializedItemIds,
                ];
            }
        }

        $transaction = Yii::$app->db->beginTransaction();
        
        try {
            // Update basic submission fields
            if (isset($data['submission_notes'])) {
                $submission->submission_notes = $data['submission_notes'];
            }
            if (isset($data['needed_by_date'])) {
                $submission->needed_by_date = $data['needed_by_date'];
            }
            if (isset($data['course_title'])) {
                $submission->course_title = $data['course_title'];
            }
            if (isset($data['section'])) {
                $submission->section = $data['section'];
            }

            if (!$submission->save()) {
                throw new \Exception('Failed to update submission: ' . json_encode($submission->errors));
            }

            // Handle folders update
            if (isset($data['folders'])) {
                $folderUuidMap = $this->updateFolders($submission, $data['folders']);
            } else {
                $folderUuidMap = [];
            }

            // Handle items update (reuse and new resources)
            if (isset($data['items'])) {
                $this->updateItems($submission, $data['items'], $folderUuidMap);
            }

            $transaction->commit();
            
            // Return updated submission with full structure
            return $this->formatSubmissionResponse($submission);
            
        } catch (\Exception $e) {
            $transaction->rollBack();
            Yii::$app->response->statusCode = 422;
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Update folders for a submission
     * Returns a map of folder_uuid to folder_name for items to reference
     */
    private function updateFolders($submission, $foldersData)
    {
        $folderUuidToNameMap = SubmissionMaterializationGuard::folderUuidToNameMap($foldersData);
        
        // First pass: get existing folders indexed by folder_name (not ID)
        $existingFolders = SubmissionFolder::find()
            ->where(['submission_id' => $submission->submission_id])
            ->indexBy('folder_name')
            ->all();

        $processedFolderNames = [];

        foreach ($foldersData as $folderData) {
            $folderName = $folderData['folder_name'] ?? $folderData['name'] ?? null;
            
            if (!$folderName) {
                Yii::warning('Skipping folder without name: ' . json_encode($folderData), __METHOD__);
                continue;
            }
            
            if (isset($existingFolders[$folderName])) {
                // Update existing folder
                $folder = $existingFolders[$folderName];
                if (isset($folderData['display_order'])) {
                    $folder->display_order = $folderData['display_order'];
                }
                $folder->save();
                $processedFolderNames[] = $folderName;
            } else {
                // Create new folder
                $folder = new SubmissionFolder();
                $folder->submission_id = $submission->submission_id;
                $folder->folder_name = $folderName;
                $folder->display_order = $folderData['display_order'] ?? 999;
                $folder->save();
                $processedFolderNames[] = $folderName;
            }
        }

        // Delete folders that weren't in the update
        foreach ($existingFolders as $folderName => $folder) {
            if (!in_array($folderName, $processedFolderNames)) {
                // Delete folder and update items to be unfoldered
                SubmissionNewResource::updateAll(
                    ['folder_name' => null, 'position_in_folder' => null],
                    ['submission_id' => $submission->submission_id, 'folder_name' => $folderName]
                );
                $folder->delete();
            }
        }
        
        return $folderUuidToNameMap;
    }

    /**
     * Update items for a submission
     */
    private function updateItems($submission, $itemsData, $folderUuidToNameMap = [])
    {
        // Get all existing items for this submission
        $existingItems = SubmissionNewResource::find()
            ->where(['submission_id' => $submission->submission_id])
            ->indexBy('id')
            ->all();
        
        $processedItemIds = [];
        
        foreach ($itemsData as $itemData) {
            // Get the database ID from item_uuid field
            $itemId = $itemData['item_uuid'] ?? $itemData['id'] ?? null;
            
            // Determine folder_name from folder_uuid
            $folderUuid = $itemData['folder_uuid'] ?? null;
            $folderName = null;
            if ($folderUuid && isset($folderUuidToNameMap[$folderUuid])) {
                $folderName = $folderUuidToNameMap[$folderUuid];
            }
            
            // Check if item exists (update) or is new
            if ($itemId && isset($existingItems[$itemId])) {
                // Update existing item
                $item = $existingItems[$itemId];
                
                // Update display order
                if (isset($itemData['display_order'])) {
                    $item->display_order = $itemData['display_order'];
                }
                
                // Update folder assignment
                $item->folder_name = $folderName;
                $item->position_in_folder = $itemData['position_in_folder'] ?? null;
                
                // Update faculty notes if provided
                if (isset($itemData['faculty_notes'])) {
                    $item->faculty_notes = $itemData['faculty_notes'];
                }
                
                // Update resource_data with new information while preserving existing metadata.
                $currentData = json_decode($item->resource_data, true) ?? [];
                $item->resource_data = json_encode($this->buildUpdatedResourceData($currentData, $itemData));
                
                // Update barcode and call number if provided (for reuse items)
                if (isset($itemData['barcode'])) {
                    $item->source_barcode = $itemData['barcode'];
                    $item->is_reuse = 1;
                }
                if (isset($itemData['call_number'])) {
                    $item->source_call_number = $itemData['call_number'];
                }
                
                $item->save();
                $processedItemIds[] = $itemId;
                
            } else {
                // Create new item
                $item = new SubmissionNewResource();
                $item->submission_id = $submission->submission_id;
                
                // Determine if reuse or new based on barcode
                $hasBarcode = !empty($itemData['barcode']);
                $item->is_reuse = $hasBarcode ? 1 : 0;
                
                if ($hasBarcode) {
                    $item->source_barcode = $itemData['barcode'];
                    $item->source_call_number = $itemData['call_number'] ?? null;
                }
                
                $resourceData = $this->buildNewResourceData($itemData);
                $materialTypeName = $resourceData['materialType'] ?? 'book';
                $item->material_type_id = $this->getMaterialTypeIdByName($materialTypeName);
                
                $item->resource_data = json_encode($resourceData);
                
                $item->display_order = $itemData['display_order'] ?? 999;
                $item->folder_name = $folderName;
                $item->position_in_folder = $itemData['position_in_folder'] ?? null;
                $item->faculty_notes = $itemData['faculty_notes'] ?? null;
                $item->priority = $itemData['priority'] ?? 'medium';
                $item->item_status = 'pending';
                
                $item->save();
                $processedItemIds[] = $item->id;
            }
        }
        
        // Delete items that weren't in the update (removed by faculty)
        foreach ($existingItems as $itemId => $item) {
            if (!in_array($itemId, $processedItemIds)) {
                $item->delete();
            }
        }
    }

    private function buildUpdatedResourceData(array $currentData, array $itemData): array
    {
        return SubmissionMaterializationGuard::buildUpdatedResourceData($currentData, $itemData);
    }

    private function buildNewResourceData(array $itemData): array
    {
        return $this->buildUpdatedResourceData([], $itemData);
    }

    /**
     * Format submission response with full structure
     */
    private function formatSubmissionResponse($submission)
    {
        $submission->refresh();
        
        $response = $submission->toArray();
        
        // Get all resources
        $allResources = $submission->getNewResources()->all();
        
        // Get folders
        $folders = $submission->getFolders()->all();
        
        // Organize by folder
        $folderStructure = [];
        $unfolderedItems = [];
        
        foreach ($folders as $folder) {
            $folderStructure[$folder->folder_name] = [
                'id' => $folder->folder_id,
                'name' => $folder->folder_name,
                'display_order' => $folder->display_order,
                'items' => [],
            ];
        }
        
        foreach ($allResources as $resource) {
            $resourceData = json_decode($resource->resource_data, true) ?? [];
            $materialItem = [
                'id' => $resource->id,
                'title' => $resourceData['title'] ?? 'Untitled',
                'authors' => $resourceData['authors'] ?? null,
                'is_reuse' => (bool)$resource->is_reuse,
                'display_order' => $resource->display_order,
                'folder_name' => $resource->folder_name,
                'faculty_notes' => $resource->faculty_notes,
                'status' => $resource->item_status,
            ];
            
            if ($resource->folder_name && isset($folderStructure[$resource->folder_name])) {
                $folderStructure[$resource->folder_name]['items'][] = $materialItem;
            } else {
                $unfolderedItems[] = $materialItem;
            }
        }
        
        // Sort items within folders
        foreach ($folderStructure as &$folder) {
            usort($folder['items'], function($a, $b) {
                return $a['display_order'] - $b['display_order'];
            });
        }
        unset($folder);
        
        usort($unfolderedItems, function($a, $b) {
            return $a['display_order'] - $b['display_order'];
        });
        
        $foldersArray = array_values($folderStructure);
        usort($foldersArray, function($a, $b) {
            return $a['display_order'] - $b['display_order'];
        });
        
        foreach ($foldersArray as &$folder) {
            $folder['item_count'] = count($folder['items']);
        }
        unset($folder);
        
        $response['folders'] = $foldersArray;
        $response['unfoldered_items'] = $unfolderedItems;
        $response['lock_status'] = $submission->getLockStatus();
        
        return \app\services\FacultySubmissionPresenter::submissionResponse($response);
    }

    /**
     * Submit the course reserve request
     */
    public function actionSubmit($id)
    {
        $facultyUser = $this->getFacultyUser();
        $submission = $this->findSubmission($id, $facultyUser, true);

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
