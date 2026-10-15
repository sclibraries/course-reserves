<?php

namespace app\controllers;

use Yii;
use yii\rest\ActiveController;
use yii\filters\Cors;
use yii\web\ServerErrorHttpException;
use app\components\Roles;
use app\filters\RoleAccessFilter;
use app\models\CourseAssignments;
use app\models\FacultyProxyPermission;
use app\services\CourseRosterService;
use app\services\FolioService;
use app\services\InstructorCourseListService;
use yii\web\ForbiddenHttpException;

class CourseAssignmentsController extends ActiveController
{
    public $modelClass = 'app\models\CourseAssignments';
    private $courseRosterService;
    private $folioService;
    private $instructorCourseListService;

    public function init()
    {
        parent::init();
        \Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
    }

    /**
     * {@inheritdoc}
     */
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // Require a Bearer token for every endpoint except CORS preflight.
        $behaviors['authenticator'] = [
            'class' => \yii\filters\auth\HttpBearerAuth::class,
            'except' => ['options'],
        ];

        $behaviors['roleAccessFilter'] = [
            'class' => RoleAccessFilter::class,
            'rules' => [
                'index' => Roles::STAFF, 'by-period' => Roles::STAFF,
                'by-smith-id' => Roles::STAFF, 'check-enrollment' => Roles::STAFF,
                'instructor-courses' => Roles::SIGNED_IN,
            ],
            'devOnlyActions' => ['test-instructor-courses'],
        ];

        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:5173',
                    'http://localhost:5174',
                    'http://127.0.0.1:5173',
                    'http://127.0.0.1:5174',
                    'http://localhost:8080',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
                'Access-Control-Expose-Headers' => [],
            ],
        ];

        return $behaviors;
    }

    public function actions()
    {
        $actions = parent::actions();
        
        // Disable default actions, we'll handle them ourselves
        unset($actions['index'], $actions['create'], $actions['update'], $actions['delete'], $actions['view']);
        
        return $actions;
    }

    public function actionOptions() {
        Yii::info('OPTIONS request received');
        Yii::$app->response->headers->set('Allow', 'GET, OPTIONS');
    }

    /**
     * Get all course assignments with mapped FOLIO term information
     * GET /course-assignments/index
     * 
     * Optional query parameters:
     * - academic_period: filter by specific academic period (e.g., AP_202601)
     * - smith_id: filter by specific smith_id
     * - course_id: filter by specific course_id
     * - role: filter by specific role
     */
    public function actionIndex()
    {
        $query = CourseAssignments::find();

        // Apply filters from query parameters
        if ($academicPeriod = Yii::$app->request->get('academic_period')) {
            $query->andWhere(['academic_period' => $academicPeriod]);
        }
        if ($smithId = Yii::$app->request->get('smith_id')) {
            $query->andWhere(['smith_id' => $smithId]);
        }
        if ($courseId = Yii::$app->request->get('course_id')) {
            $query->andWhere(['course_id' => $courseId]);
        }
        if ($role = Yii::$app->request->get('role')) {
            $query->andWhere(['role' => $role]);
        }

        $assignments = $query->asArray()->all();

        // Fetch FOLIO terms
        $terms = $this->getCourseRosterService()->getFolioTerms();

        // Map academic periods to FOLIO terms and parse course codes
        foreach ($assignments as &$assignment) {
            $assignment['folio_term'] = $this->getCourseRosterService()->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);
            $assignment['parsed_course'] = $this->getCourseRosterService()->parseCourseId($assignment['course_id']);
        }

        return [
            'success' => true,
            'count' => count($assignments),
            'data' => $assignments
        ];
    }

    /**
     * Get course assignments grouped by academic period
     * GET /course-assignments/by-period
     */
    public function actionByPeriod()
    {
        $assignments = CourseAssignments::find()->asArray()->all();
        $terms = $this->getCourseRosterService()->getFolioTerms();

        $grouped = [];
        foreach ($assignments as $assignment) {
            $period = $assignment['academic_period'];
            if (!isset($grouped[$period])) {
                $grouped[$period] = [
                    'academic_period' => $period,
                    'folio_term' => $this->getCourseRosterService()->mapAcademicPeriodToTerm($period, $terms),
                    'assignments' => []
                ];
            }
            $assignment['parsed_course'] = $this->getCourseRosterService()->parseCourseId($assignment['course_id']);
            $grouped[$period]['assignments'][] = $assignment;
        }

        return [
            'success' => true,
            'count' => count($grouped),
            'data' => array_values($grouped)
        ];
    }

    /**
     * Get course assignments for a specific smith_id
     * GET /course-assignments/by-smith-id?smith_id=12345
     */
    public function actionBySmithId()
    {
        $smithId = Yii::$app->request->get('smith_id');
        
        if (!$smithId) {
            throw new \yii\web\BadRequestHttpException('smith_id parameter is required');
        }

        $assignments = CourseAssignments::find()
            ->where(['smith_id' => $smithId])
            ->asArray()
            ->all();

        $terms = $this->getCourseRosterService()->getFolioTerms();

        foreach ($assignments as &$assignment) {
            $assignment['folio_term'] = $this->getCourseRosterService()->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);
            $assignment['parsed_course'] = $this->getCourseRosterService()->parseCourseId($assignment['course_id']);
        }

        return [
            'success' => true,
            'smith_id' => $smithId,
            'count' => count($assignments),
            'data' => $assignments
        ];
    }

    /**
     * Check if a person is enrolled in a specific course
     * GET /course-assignments/check-enrollment?smith_id=999999999&course_number=AFR 170&section_name=01
     * 
     * Parameters:
     * - smith_id (required): The Smith ID to check
     * - course_number (required): Course number in format "AFR 170"
     * - section_name (optional): Section name, defaults to "01" if not provided
     * - academic_period (optional): Filter by specific term, e.g., "AP_202601"
     * 
     * Returns:
     * {
     *   "enrolled": true|false,
     *   "assignment": {...} // if enrolled
     * }
     */
    public function actionCheckEnrollment()
    {
        $smithId = Yii::$app->request->get('smith_id');
        $courseNumber = Yii::$app->request->get('course_number');
        $sectionName = Yii::$app->request->get('section_name', '01'); // Default to "01"
        $academicPeriod = Yii::$app->request->get('academic_period'); // Optional

        if (!$smithId) {
            throw new \yii\web\BadRequestHttpException('smith_id parameter is required');
        }
        if (!$courseNumber) {
            throw new \yii\web\BadRequestHttpException('course_number parameter is required');
        }

        // Normalize course number (remove extra spaces)
        $courseNumber = preg_replace('/\s+/', ' ', trim($courseNumber));

        // Find all assignments for this smith_id
        $query = CourseAssignments::find()->where(['smith_id' => $smithId]);
        
        // Optionally filter by academic period
        if ($academicPeriod) {
            $query->andWhere(['academic_period' => $academicPeriod]);
        }
        
        $assignments = $query->asArray()->all();

        // Check each assignment to see if the parsed course matches
        foreach ($assignments as $assignment) {
            $parsedCourse = $this->getCourseRosterService()->parseCourseId($assignment['course_id']);
            
            // Match course number and section name
            if ($parsedCourse['courseNumber'] === $courseNumber && 
                $parsedCourse['sectionName'] === $sectionName) {
                
                // Found a match - fetch term info and return
                $terms = $this->getCourseRosterService()->getFolioTerms();
                $assignment['folio_term'] = $this->getCourseRosterService()->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);
                $assignment['parsed_course'] = $parsedCourse;
                
                return [
                    'enrolled' => true,
                    'assignment' => $assignment
                ];
            }
        }

        // No match found
        return [
            'enrolled' => false,
            'assignment' => null
        ];
    }

    /**
     * Development-only lookup by supplied instructor identity.
     * GET /course-assignments/test-instructor-courses?full_name=...&internal_id=...
     */
    public function actionTestInstructorCourses()
    {
        $fullName = Yii::$app->request->get('full_name');
        $internalId = Yii::$app->request->get('internal_id');

        if (!$fullName) {
            throw new \yii\web\BadRequestHttpException('full_name parameter is required');
        }
        if (!$internalId) {
            throw new \yii\web\BadRequestHttpException('internal_id parameter is required');
        }

        return $this->getInstructorCourses($fullName, $internalId, true);
    }

    /**
     * Return course assignments for the authenticated identity.
     * GET /course-assignments/instructor-courses
     */
    public function actionInstructorCourses()
    {
        $identity = Yii::$app->user->identity;
        
        if (!$identity) {
            throw new \yii\web\UnauthorizedHttpException('Authentication required');
        }

        $actingForFacultyId = Yii::$app->request->get('acting_for_faculty_id');
        if ($actingForFacultyId !== null) {
            return $this->instructorCoursesForDesignee($actingForFacultyId, $identity);
        }

        // Extract user info from JWT token
        $fullName = $identity->fullName;
        $internalId = $identity->internalId;

        if (!$fullName || !$internalId) {
            throw new \yii\web\BadRequestHttpException('Missing required user information in token');
        }

        return $this->getInstructorCourses($fullName, $internalId, false);
    }

    /**
     * Return course assignments for an instructor, optionally including debug data.
     */
    protected function getInstructorCourses($fullName, $internalId, $debug = false)
    {
        return $this->getInstructorCourseListService()->getInstructorCourses($fullName, $internalId, $debug);
    }

    private function instructorCoursesForDesignee($facultyId, $identity)
    {
        if (Roles::isStaff($identity->role ?? null)) {
            throw new ForbiddenHttpException('Staff acting-for course lookup is not supported');
        }
        if (!is_string($facultyId) || $facultyId === '') {
            throw new ForbiddenHttpException('No active proxy permission for this faculty member');
        }

        $permission = FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $facultyId,
                'proxy_shibboleth_id' => $identity->username ?? null,
                'status' => FacultyProxyPermission::STATUS_ACTIVE,
            ])
            ->one();
        if (!$permission || !$permission->isActive(false)) {
            throw new ForbiddenHttpException('No active proxy permission for this faculty member');
        }

        $courseList = $this->getInstructorCourseListService();
        if (empty($permission->faculty_internal_id)) {
            if ($permission->permission_type !== FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES) {
                Yii::$app->response->statusCode = 409;
                return [
                    'error_code' => 'proxy_roster_unavailable',
                    'message' => 'Ask the faculty member to re-invite you so their course roster can be loaded.',
                ];
            }
            $response = $courseList->coursesFromSpecificGrant($permission);
        } else {
            $response = $courseList->getInstructorCourses(
                $permission->faculty_display_name,
                $permission->faculty_internal_id
            );
            if ($permission->permission_type === FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES) {
                $response = $courseList->filterToGrantCourses($response, $permission);
            }
        }

        $response['can_edit'] = $permission->canEdit(false);
        return $response;
    }

    private function getFolioService()
    {
        if ($this->folioService === null) {
            $this->folioService = Yii::$container->get(FolioService::class);
        }

        return $this->folioService;
    }

    private function getCourseRosterService()
    {
        if ($this->courseRosterService === null) {
            $this->courseRosterService = new CourseRosterService($this->getFolioService());
        }

        return $this->courseRosterService;
    }

    private function getInstructorCourseListService()
    {
        if ($this->instructorCourseListService === null) {
            $this->instructorCourseListService = new InstructorCourseListService(
                $this->getFolioService(),
                $this->getCourseRosterService()
            );
        }

        return $this->instructorCourseListService;
    }
}
