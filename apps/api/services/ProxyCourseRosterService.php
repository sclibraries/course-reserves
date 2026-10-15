<?php

namespace app\services;

use Yii;
use yii\web\BadRequestHttpException;

/**
 * Resolves selected FOLIO listings and proves they belong to the faculty roster.
 */
class ProxyCourseRosterService
{
    private $folioService;
    private $rosterService;

    public function __construct($folioService = null, $rosterService = null)
    {
        $this->folioService = $folioService;
        $this->rosterService = $rosterService;
    }

    public function validatedCourses(array $actor, $requestedCourses)
    {
        if (empty($requestedCourses) || !is_array($requestedCourses)) {
            throw new BadRequestHttpException('course_permissions must include at least one course');
        }
        if (empty($actor['internal_id'])) {
            throw new BadRequestHttpException('Faculty roster identity is missing from the bearer token');
        }

        $validated = [];
        $seen = [];
        foreach ($requestedCourses as $requested) {
            $listingId = is_array($requested) ? trim((string)($requested['folio_course_listing_id'] ?? '')) : '';
            if ($listingId === '' || isset($seen[$listingId])) {
                throw new BadRequestHttpException('Each course must have a unique FOLIO course listing ID');
            }
            $seen[$listingId] = true;
            $course = $this->findFolioCourse($listingId);
            $courseListing = $course['courseListingObject'] ?? [];
            $termId = $courseListing['termId'] ?? $course['termId'] ?? null;
            $termName = $this->termName($termId);
            $courseCode = $course['courseNumber'] ?? null;
            $section = $course['sectionName'] ?? null;
            if (!$termName || !$courseCode || !$section || !$this->getRosterService()->isInstructorRostered(
                $actor['internal_id'],
                $termName,
                $courseCode,
                $section
            )) {
                throw new BadRequestHttpException('A selected course is not on your instructor roster');
            }
            $validated[] = [
                'folio_course_listing_id' => $listingId,
                'course_title' => $course['name'] ?? $courseCode,
                'term_id' => $termId,
            ];
        }

        return $validated;
    }

    private function findFolioCourse($listingId)
    {
        if (!preg_match('/^[A-Za-z0-9._:-]{1,255}$/', $listingId)) {
            throw new BadRequestHttpException('Invalid FOLIO course listing ID');
        }
        $result = $this->getFolioService()->searchCourses('(courseListingId=="' . $listingId . '")');
        if (isset($result['courseListingId']) && $result['courseListingId'] === $listingId) {
            return $result;
        }
        if (is_array($result)) {
            foreach ($result as $course) {
                if (isset($course['courseListingId']) && $course['courseListingId'] === $listingId) {
                    return $course;
                }
            }
        }
        throw new BadRequestHttpException('Selected FOLIO course listing was not found');
    }

    private function termName($termId)
    {
        foreach ($this->getRosterService()->getFolioTerms() as $term) {
            if (isset($term['id'], $term['name']) && $term['id'] === $termId) {
                return $term['name'];
            }
        }
        return null;
    }

    private function getFolioService()
    {
        if ($this->folioService === null) {
            $this->folioService = Yii::$container->get(FolioService::class);
        }
        return $this->folioService;
    }

    private function getRosterService()
    {
        if ($this->rosterService === null) {
            $this->rosterService = new CourseRosterService($this->getFolioService());
        }
        return $this->rosterService;
    }
}
