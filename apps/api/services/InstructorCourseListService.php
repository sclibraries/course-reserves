<?php

namespace app\services;

use app\models\CourseAssignments;
use app\models\FacultyProxyPermission;
use Yii;

/**
 * Builds the instructor course response shared by own and proxy lookups.
 */
class InstructorCourseListService
{
    private $folioService;
    private $courseRosterService;

    public function __construct($folioService = null, $courseRosterService = null)
    {
        $this->folioService = $folioService ?: Yii::$container->get(FolioService::class);
        $this->courseRosterService = $courseRosterService ?: new CourseRosterService($this->folioService);
    }

    public function getInstructorCourses($fullName, $internalId, $debug = false)
    {
        $assignments = CourseAssignments::find()
            ->where(['smith_id' => $internalId])
            ->asArray()
            ->all();

        if (empty($assignments)) {
            return [
                'success' => true,
                'instructor' => ['full_name' => $fullName, 'internal_id' => $internalId],
                'courses' => [],
                'count' => 0,
            ];
        }

        $terms = $this->courseRosterService->getFolioTerms();
        $courses = [];
        $debugInfo = [];
        foreach ($assignments as $assignment) {
            $parsedCourse = $this->courseRosterService->parseCourseId($assignment['course_id']);
            $folioTerm = $this->courseRosterService->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);
            $courseData = [
                'assignment' => $assignment,
                'parsed_course' => $parsedCourse,
                'folio_term' => $folioTerm,
                'folio_course' => null,
            ];

            if ($folioTerm && $parsedCourse['courseNumber']) {
                $termId = $folioTerm['id'];
                $courseNumber = $parsedCourse['courseNumber'];
                $query = '(department.name=="SC*" and courseNumber=="' . $courseNumber
                    . '" and courseListing.termId=="' . $termId . '") sortby name';
                $folioResult = $this->folioService->searchCourses($query);

                if ($debug) {
                    $debugInfo[] = [
                        'course_id' => $assignment['course_id'],
                        'courseNumber' => $courseNumber,
                        'termId' => $termId,
                        'folioSearchUrl' => rtrim(Yii::$app->params['folio']['searchBaseUrl'], '/')
                            . '/search-courses?query=' . $query,
                        'folioResult' => $folioResult,
                    ];
                }

                if (empty($folioResult)) {
                    $courseData['folio_course'] = [
                        'courseNumber' => $parsedCourse['courseNumber'],
                        'name' => $assignment['course_title'],
                        'sectionName' => $parsedCourse['sectionName'],
                        'source' => 'backend',
                        'message' => 'Course not yet created in FOLIO',
                    ];
                } else {
                    $courseData['folio_course'] = $folioResult;
                }
            }

            $courses[] = $courseData;
        }

        $response = [
            'success' => true,
            'instructor' => ['full_name' => $fullName, 'internal_id' => $internalId],
            'courses' => $courses,
            'count' => count($courses),
        ];
        if ($debug) {
            $response['debug'] = $debugInfo;
        }

        return $response;
    }

    public function filterToGrantCourses(array $response, FacultyProxyPermission $permission)
    {
        $allowedIds = [];
        foreach ($permission->getCoursePermissions()->all() as $coursePermission) {
            $allowedIds[$coursePermission->folio_course_listing_id] = true;
        }

        $filtered = [];
        foreach ($response['courses'] as $course) {
            $folioCourse = $course['folio_course'] ?? null;
            if (!is_array($folioCourse)) {
                continue;
            }

            if (isset($folioCourse['courseListingId'])) {
                if (isset($allowedIds[$folioCourse['courseListingId']])) {
                    $filtered[] = $course;
                }
                continue;
            }

            $matchingCourses = [];
            foreach ($folioCourse as $folioResult) {
                if (is_array($folioResult) && isset($folioResult['courseListingId']) &&
                    isset($allowedIds[$folioResult['courseListingId']])) {
                    $matchingCourses[] = $folioResult;
                }
            }
            if (!empty($matchingCourses)) {
                $course['folio_course'] = $matchingCourses;
                $filtered[] = $course;
            }
        }

        $response['courses'] = $filtered;
        $response['count'] = count($filtered);
        return $response;
    }

    /**
     * Use stored grant rows when older invitations have no faculty roster identity.
     */
    public function coursesFromSpecificGrant(FacultyProxyPermission $permission)
    {
        $courses = [];
        foreach ($permission->getCoursePermissions()->orderBy(['id' => SORT_ASC])->all() as $coursePermission) {
            $courses[] = [
                'assignment' => [
                    'course_title' => $coursePermission->course_title,
                    'folio_course_listing_id' => $coursePermission->folio_course_listing_id,
                ],
                'parsed_course' => ['courseNumber' => null, 'sectionName' => null, 'raw' => null],
                'folio_term' => $coursePermission->term_id ? ['id' => $coursePermission->term_id] : null,
                'folio_course' => [
                    'courseListingId' => $coursePermission->folio_course_listing_id,
                    'name' => $coursePermission->course_title,
                    'source' => 'proxy_permission',
                ],
            ];
        }

        return [
            'success' => true,
            'instructor' => [
                'full_name' => $permission->faculty_display_name,
                'internal_id' => null,
            ],
            'courses' => $courses,
            'count' => count($courses),
        ];
    }
}
