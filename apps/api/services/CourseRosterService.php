<?php

namespace app\services;

use app\models\CourseAssignments;
use Yii;

/**
 * Shares ITS assignment parsing and FOLIO term mapping across roster consumers.
 */
class CourseRosterService
{
    private $folioService;
    private $folioTerms;
    private $instructorSubmissionCourses = [];

    public function __construct($folioService = null)
    {
        $this->folioService = $folioService;
    }

    public function getFolioTerms()
    {
        if ($this->folioTerms === null) {
            if ($this->folioService === null) {
                $this->folioService = Yii::$container->get(FolioService::class);
            }
            $this->folioTerms = $this->folioService->searchTerms();
        }

        return $this->folioTerms;
    }

    /**
     * Map an ITS academic period such as AP_202603 to the FOLIO term covering it.
     */
    public function mapAcademicPeriodToTerm($academicPeriod, $terms = null)
    {
        $terms = $terms === null ? $this->getFolioTerms() : $terms;
        if (empty($terms) || !preg_match('/^AP_(\d{4})(\d{2})$/', (string)$academicPeriod, $matches)) {
            return null;
        }

        $year = (int)$matches[1];
        $month = (int)$matches[2];
        if ($month < 1 || $month > 12) {
            return null;
        }

        $academicDate = new \DateTime(sprintf('%04d-%02d-01', $year, $month));
        foreach ($terms as $term) {
            if (!isset($term['startDate'], $term['endDate'])) {
                continue;
            }

            $startDate = new \DateTime($term['startDate']);
            $endDate = new \DateTime($term['endDate']);
            if ($academicDate >= $startDate && $academicDate <= $endDate) {
                return $term;
            }
        }

        return null;
    }

    /**
     * Parse course_id into the same course number and section returned by instructor-courses.
     */
    public function parseCourseId($courseId)
    {
        if (empty($courseId)) {
            return [
                'courseNumber' => null,
                'sectionName' => null,
                'raw' => $courseId,
            ];
        }

        $parts = explode('-', $courseId);
        if (count($parts) >= 3) {
            return [
                'courseNumber' => $parts[0] . ' ' . $parts[1],
                'sectionName' => $parts[2],
                'raw' => $courseId,
            ];
        }

        return [
            'courseNumber' => null,
            'sectionName' => null,
            'raw' => $courseId,
        ];
    }

    /**
     * Find an exact Instructor roster row and map the fields stored on a submission.
     */
    public function findInstructorCourse($smithId, $academicPeriod, $courseId)
    {
        if (empty($academicPeriod) || empty($courseId)) {
            return null;
        }

        $query = CourseAssignments::find()
            ->where(['academic_period' => $academicPeriod, 'course_id' => $courseId]);
        if ($smithId !== null) {
            $query->andWhere(['smith_id' => $smithId]);
        }

        $terms = $this->getFolioTerms();
        foreach ($query->orderBy(['smith_id' => SORT_ASC])->asArray()->all() as $assignment) {
            if (strcasecmp((string)($assignment['role'] ?? ''), 'Instructor') !== 0) {
                continue;
            }

            $term = $this->mapAcademicPeriodToTerm($assignment['academic_period'], $terms);
            $course = $this->parseCourseId($assignment['course_id']);
            if ($course['courseNumber'] === null) {
                continue;
            }

            if ($term === null || empty($term['id']) || empty($term['name'])) {
                Yii::warning(
                    'No FOLIO term maps to roster academic period ' . $assignment['academic_period']
                    . '; storing the roster period as term_code.',
                    __METHOD__
                );
                $termId = null;
                $termName = $assignment['academic_period'];
            } else {
                $termId = $term['id'];
                $termName = $term['name'];
            }

            return [
                'its_course_id' => $assignment['course_id'],
                'academic_period' => $assignment['academic_period'],
                'roster_term_id' => $termId,
                'term_code' => $termName,
                'course_code' => $course['courseNumber'],
                'section' => $course['sectionName'],
                'course_title' => $assignment['course_title'],
            ];
        }

        return null;
    }

    /**
     * Match one ITS row to the values the faculty form stores for a submission.
     */
    public function isAssignmentForCourse(array $assignment, $termCode, $courseCode, $section, $terms = null)
    {
        $rosteredCourse = $this->submissionCourseValues($assignment, $terms);

        return $rosteredCourse !== null && $rosteredCourse['term_code'] === $termCode &&
            $rosteredCourse['course_code'] === $this->normalizeCourseCode($courseCode) &&
            $rosteredCourse['section'] === $this->normalizeSection($section);
    }

    /**
     * Return normalized submission course identity tuples for an instructor's ITS roster.
     */
    public function getInstructorSubmissionCourses($smithId)
    {
        if (empty($smithId)) {
            return [];
        }
        if (array_key_exists($smithId, $this->instructorSubmissionCourses)) {
            return $this->instructorSubmissionCourses[$smithId];
        }

        $assignments = CourseAssignments::find()
            ->where(['smith_id' => $smithId])
            ->asArray()
            ->all();
        $terms = $this->getFolioTerms();
        $courses = [];

        foreach ($assignments as $assignment) {
            if (strcasecmp((string)($assignment['role'] ?? ''), 'Instructor') !== 0) {
                continue;
            }

            $course = $this->submissionCourseValues($assignment, $terms);
            if ($course !== null) {
                $courses[] = $course;
            }
        }

        $this->instructorSubmissionCourses[$smithId] = $courses;
        return $courses;
    }

    /**
     * Check the actor's Instructor rows using the shared course and term mapping.
     */
    public function isInstructorRostered($smithId, $termCode, $courseCode, $section)
    {
        foreach ($this->getInstructorSubmissionCourses($smithId) as $course) {
            if ($course['term_code'] === $termCode &&
                $course['course_code'] === $this->normalizeCourseCode($courseCode) &&
                $course['section'] === $this->normalizeSection($section)) {
                return true;
            }
        }

        return false;
    }

    private function submissionCourseValues(array $assignment, $terms)
    {
        $term = $this->mapAcademicPeriodToTerm($assignment['academic_period'] ?? null, $terms);
        $course = $this->parseCourseId($assignment['course_id'] ?? null);
        if ($term === null || !isset($term['name']) || $course['courseNumber'] === null) {
            return null;
        }

        return [
            'term_code' => $term['name'],
            'course_code' => $this->normalizeCourseCode($course['courseNumber']),
            'section' => $this->normalizeSection($course['sectionName']),
        ];
    }

    private function normalizeCourseCode($courseCode)
    {
        return preg_replace('/\s+/', ' ', trim((string)$courseCode));
    }

    private function normalizeSection($section)
    {
        return trim((string)$section);
    }
}
