<?php

namespace app\controllers;

use Yii;
use yii\rest\ActiveController;
use yii\filters\Cors;
use yii\web\ServerErrorHttpException;
use app\models\CourseAssignments;
use yii\httpclient\Client;

class CourseAssignmentsController extends ActiveController
{
    public $modelClass = 'app\models\CourseAssignments';

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

        // Configure JWT authentication for specific endpoints
        $behaviors['authenticator'] = [
            'class' => \yii\filters\auth\HttpBearerAuth::class,
            'only' => ['instructor-courses'], // Only require auth for production endpoint
        ];

        // CORS
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
        $terms = $this->fetchFolioTerms();

        // Map academic periods to FOLIO terms and parse course codes
        foreach ($assignments as &$assignment) {
            $assignment['folio_term'] = $this->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);
            $assignment['parsed_course'] = $this->parseCourseId($assignment['course_id']);
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
        $terms = $this->fetchFolioTerms();

        $grouped = [];
        foreach ($assignments as $assignment) {
            $period = $assignment['academic_period'];
            if (!isset($grouped[$period])) {
                $grouped[$period] = [
                    'academic_period' => $period,
                    'folio_term' => $this->mapAcademicPeriodToTerm($period, $terms),
                    'assignments' => []
                ];
            }
            $assignment['parsed_course'] = $this->parseCourseId($assignment['course_id']);
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

        $terms = $this->fetchFolioTerms();

        foreach ($assignments as &$assignment) {
            $assignment['folio_term'] = $this->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);
            $assignment['parsed_course'] = $this->parseCourseId($assignment['course_id']);
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
            $parsedCourse = $this->parseCourseId($assignment['course_id']);
            
            // Match course number and section name
            if ($parsedCourse['courseNumber'] === $courseNumber && 
                $parsedCourse['sectionName'] === $sectionName) {
                
                // Found a match - fetch term info and return
                $terms = $this->fetchFolioTerms();
                $assignment['folio_term'] = $this->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);
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
     * Test/Debug endpoint to check instructor courses
     * GET /course-assignments/test-instructor-courses?full_name=John Doe&internal_id=999999999
     * 
     * Parameters:
     * - full_name (required): Instructor's full name
     * - internal_id (required): Smith ID (e.g., 999999999)
     * 
     * Returns instructor's course assignments with FOLIO course details
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
     * Production endpoint to get authenticated instructor's courses
     * GET /course-assignments/instructor-courses
     * 
     * Requires JWT authentication (Bearer token)
     * Extracts full_name and internal_id from JWT payload
     * 
     * Returns instructor's course assignments with FOLIO course details
     */
    public function actionInstructorCourses()
    {
        $identity = Yii::$app->user->identity;
        
        if (!$identity) {
            throw new \yii\web\UnauthorizedHttpException('Authentication required');
        }

        // Extract user info from JWT token
        $fullName = $identity->full_name ?? null;
        $internalId = $identity->interal_id ?? null; // Note: typo in original "interal_id"

        if (!$fullName || !$internalId) {
            throw new \yii\web\BadRequestHttpException('Missing required user information in token');
        }

        return $this->getInstructorCourses($fullName, $internalId, false);
    }

    /**
     * Core logic to fetch instructor courses with FOLIO enrichment
     * 
     * @param string $fullName Instructor's full name
     * @param string $internalId Smith ID
     * @param bool $debug Whether to include debug information
     * @return array
     */
    private function getInstructorCourses($fullName, $internalId, $debug = false)
    {
        // Fetch all course assignments for this instructor
        $assignments = CourseAssignments::find()
            ->where(['smith_id' => $internalId])
            ->asArray()
            ->all();

        if (empty($assignments)) {
            return [
                'success' => true,
                'instructor' => [
                    'full_name' => $fullName,
                    'internal_id' => $internalId
                ],
                'courses' => [],
                'count' => 0
            ];
        }

        // Fetch FOLIO terms once
        $terms = $this->fetchFolioTerms();

        $enrichedCourses = [];
        $debugInfo = [];

        foreach ($assignments as $assignment) {
            // Parse course information

            $parsedCourse = $this->parseCourseId($assignment['course_id']);

            $folioTerm = $this->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);

            $courseData = [
                'assignment' => $assignment,
                'parsed_course' => $parsedCourse,
                'folio_term' => $folioTerm,
                'folio_course' => null
            ];

            // If we have a valid term and parsed course, search FOLIO
            if ($folioTerm && $parsedCourse['courseNumber']) {
                $termId = $folioTerm['id'];
                $courseNumber = $parsedCourse['courseNumber'];
                
                // Search FOLIO courses
                $folioSearchResult = $this->searchFolioCourse($courseNumber, $termId);
                
                if ($debug) {
                    $debugInfo[] = [
                        'course_id' => $assignment['course_id'],
                        'courseNumber' => $courseNumber,
                        'termId' => $termId,
                        'folioSearchUrl' => "https://libtools2.smith.edu/folio/web/search/search-courses?query=(department.name==\"SC*\" and courseNumber==\"{$courseNumber}\" and courseListing.termId==\"{$termId}\") sortby name",
                        'folioResult' => $folioSearchResult
                    ];
                }

                // If FOLIO search returns empty, include backend course info
                if (empty($folioSearchResult)) {
                    $courseData['folio_course'] = [
                        'courseNumber' => $parsedCourse['courseNumber'],
                        'name' => $assignment['course_title'],
                        'sectionName' => $parsedCourse['sectionName'],
                        'source' => 'backend',
                        'message' => 'Course not yet created in FOLIO'
                    ];
                } else {
                    $courseData['folio_course'] = $folioSearchResult;
                }
            }

            $enrichedCourses[] = $courseData;
        }

        $response = [
            'success' => true,
            'instructor' => [
                'full_name' => $fullName,
                'internal_id' => $internalId
            ],
            'courses' => $enrichedCourses,
            'count' => count($enrichedCourses)
        ];

        if ($debug) {
            $response['debug'] = $debugInfo;
        }

        return $response;
    }

    /**
     * Search for a course in FOLIO by course number and term
     * 
     * @param string $courseNumber Course number (e.g., "FRN 101")
     * @param string $termId FOLIO term ID
     * @return array|null FOLIO course data or null if not found
     */
    private function searchFolioCourse($courseNumber, $termId)
    {
        try {
            $client = new Client();
            
            // Build FOLIO query
            $query = '(department.name=="SC*" and courseNumber=="' . $courseNumber . '" and courseListing.termId=="' . $termId . '") sortby name';
            
            $response = $client->createRequest()
                ->setMethod('GET')
                ->setUrl('https://libtools2.smith.edu/folio/web/search/search-courses')
                ->setData(['query' => $query])
                ->send();

            if ($response->isOk && isset($response->data['data']['courses'])) {
                $courses = $response->data['data']['courses'];
                // Return null if no courses found (empty array)
                if (empty($courses)) {
                    return null;
                }
                // Return the first matching course, or all if multiple
                return count($courses) === 1 ? $courses[0] : $courses;
            }

            Yii::warning('Failed to fetch FOLIO course: ' . $response->content);
            return null;
        } catch (\Exception $e) {
            Yii::error('Error fetching FOLIO course: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Fetch FOLIO terms from external API
     * @return array
     */
    private function fetchFolioTerms()
    {
        try {
            $client = new Client();
            $response = $client->createRequest()
                ->setMethod('GET')
                ->setUrl('https://libtools2.smith.edu/folio/web/search/search-terms')
                ->send();

            if ($response->isOk && isset($response->data['data']['terms'])) {
                return $response->data['data']['terms'];
            }

            Yii::warning('Failed to fetch FOLIO terms: ' . $response->content);
            return [];
        } catch (\Exception $e) {
            Yii::error('Error fetching FOLIO terms: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Map academic period (e.g., AP_202601) to FOLIO term
     * 
     * @param string $academicPeriod Format: AP_YYYYMM
     * @param array $terms FOLIO terms array
     * @return array|null Matched term or null
     */
    private function mapAcademicPeriodToTerm($academicPeriod, $terms)
    {
        if (empty($terms) || empty($academicPeriod)) {
            return null;
        }

        // Parse academic period: AP_202603 -> year: 2026, month: 03
        if (preg_match('/^AP_(\d{4})(\d{2})$/', $academicPeriod, $matches)) {
            $year = (int)$matches[1];
            $month = (int)$matches[2];
            
            // Create a DateTime object for the academic period (first day of that month)
            $academicDate = new \DateTime(sprintf('%04d-%02d-01', $year, $month));

            // Find term where the academic period falls within the term's date range
            foreach ($terms as $term) {
                if (isset($term['startDate']) && isset($term['endDate'])) {
                    $startDate = new \DateTime($term['startDate']);
                    $endDate = new \DateTime($term['endDate']);

                    // Check if academic period falls within this term's date range
                    if ($academicDate >= $startDate && $academicDate <= $endDate) {
                        return $term;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Parse course_id into FOLIO-compatible format
     * 
     * @param string $courseId Format: AMS-120-01-202601
     * @return array Parsed course information
     */
    private function parseCourseId($courseId)
    {
        if (empty($courseId)) {
            return [
                'courseNumber' => null,
                'sectionName' => null,
                'raw' => $courseId
            ];
        }

        // Split by hyphen: AMS-120-01-202601
        $parts = explode('-', $courseId);

        if (count($parts) >= 3) {
            $departmentCode = $parts[0]; // AMS
            $courseNum = $parts[1];      // 120
            $section = $parts[2];        // 01
            // parts[3] would be the date (202601) which we ignore

            return [
                'courseNumber' => $departmentCode . ' ' . $courseNum, // "AMS 120"
                'sectionName' => $section,                            // "01"
                'raw' => $courseId
            ];
        }

        // If format doesn't match, return raw value
        return [
            'courseNumber' => null,
            'sectionName' => null,
            'raw' => $courseId
        ];
    }
}
