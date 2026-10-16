<?php

namespace app\services;

use Yii;
use app\models\CourseOfferings;
use app\models\Courses;
use yii\db\IntegrityException;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;
use yii\web\ServerErrorHttpException;

/** Shared FOLIO course and offering lookup/create behavior for all linking paths. */
class CourseOfferingLinkService
{
    private $folioService;

    public function __construct($folioService = null)
    {
        $this->folioService = $folioService ?: Yii::$container->get(FolioService::class);
    }

    public function fetchListing($listingId)
    {
        try {
            return $this->folioService->fetchCourseById($listingId);
        } catch (\RuntimeException $exception) {
            throw new NotFoundHttpException('FOLIO course listing not found.');
        }
    }

    public function findOrCreateFromListing(array $listing)
    {
        $listingObject = $listing['courseListingObject'] ?? [];
        $term = $listingObject['termObject'] ?? [];
        $listingId = $listing['courseListingId'] ?? $listingObject['id'] ?? $listing['id'] ?? null;
        if (empty($listing['courseNumber']) || empty($listing['name']) || empty($listing['departmentId']) ||
            empty($listingId) || empty($listingObject['termId']) || empty($term['name'])) {
            throw new BadRequestHttpException('FOLIO listing is missing required course or term data.');
        }

        return $this->findOrCreate(
            [
                'course_number' => $listing['courseNumber'],
                'course_name' => $listing['name'],
                'department_id' => $listing['departmentId'],
                'department_name' => $listing['departmentObject']['name'] ?? null,
                'location_id' => $listingObject['locationId'] ?? null,
                'location_name' => $listingObject['locationObject']['name'] ?? null,
            ],
            [
                'folio_course_id' => $listingId,
                'term_id' => $listingObject['termId'],
                'term_name' => $term['name'],
                'section_name' => $listing['sectionName'] ?? $listingObject['sectionName'] ?? '',
                'start_date' => $term['startDate'] ?? null,
                'end_date' => $term['endDate'] ?? null,
            ]
        );
    }

    public function findOrCreate(array $courseData, array $offeringData)
    {
        $this->validateData($courseData, $offeringData);
        $courseNumber = trim((string)$courseData['course_number']);
        $courseName = trim((string)$courseData['course_name']);
        $departmentId = (string)$courseData['department_id'];
        $locationId = isset($courseData['location_id']) ? (string)$courseData['location_id'] : null;
        $locationName = $courseData['location_name'] ?? null;
        $departmentName = $courseData['department_name'] ?? null;
        $folioId = trim((string)$offeringData['folio_course_id']);
        $termId = (string)$offeringData['term_id'];
        $termName = (string)$offeringData['term_name'];
        $section = isset($offeringData['section_name']) ? (string)$offeringData['section_name'] : '';
        $startDate = $this->isoToMysql($offeringData['start_date'] ?? null);
        $endDate = $this->isoToMysql($offeringData['end_date'] ?? null);

        $courseLookup = ['course_number' => $courseNumber];
        if ($locationId !== null && $locationId !== '') {
            $courseLookup['location_id'] = $locationId;
        }
        $course = Courses::findOne($courseLookup);
        if (!$course) {
            $course = new Courses();
            $course->course_number = $courseNumber;
            if ($locationId !== null && $locationId !== '') {
                $course->location_id = $locationId;
            }
        }
        $course->course_name = $courseName;
        $course->department_id = $departmentId;
        if ($departmentName !== null) $course->department_name = (string)$departmentName;
        if ($locationName !== null) $course->location_name = (string)$locationName;
        if (!$course->save()) {
            throw new ServerErrorHttpException('Course save failed: ' . json_encode($course->getErrors()));
        }

        $existingByFolio = CourseOfferings::findOne(['folio_course_id' => $folioId]);
        if ($existingByFolio && (int)$existingByFolio->course_id !== (int)$course->course_id) {
            throw new ConflictHttpException('FOLIO course is already linked to a different course.');
        }
        $pair = ['course_id' => $course->course_id, 'term_id' => $termId, 'section_name' => $section];
        $existingPair = CourseOfferings::findOne($pair);
        if ($existingPair && $existingPair->folio_course_id && $existingPair->folio_course_id !== $folioId) {
            throw new ConflictHttpException('This course already has an offering for this term and section.');
        }

        $offering = $existingByFolio ?: $existingPair;
        if (!$offering) {
            $offering = new CourseOfferings();
            $offering->course_id = $course->course_id;
            $offering->folio_course_id = $folioId;
            $offering->term_id = $termId;
            $offering->term_name = $termName;
            $offering->section_name = $section;
        } else {
            $offering->section_name = $section;
            if (empty($offering->folio_course_id)) $offering->folio_course_id = $folioId;
            if ($termName !== '') $offering->term_name = $termName;
        }
        if ($startDate !== null) $offering->start_date = $startDate;
        if ($endDate !== null) $offering->end_date = $endDate;
        $offering->status = $this->computeOfferingStatus($offering->start_date, $offering->end_date);

        try {
            $saved = $offering->save();
        } catch (IntegrityException $exception) {
            $saved = false;
        }
        if (!$saved) {
            $winner = CourseOfferings::findOne(['folio_course_id' => $folioId]) ?: CourseOfferings::findOne($pair);
            if (!$winner) {
                throw new ConflictHttpException('Course offering was created concurrently; retry the link.');
            }
            if ((int)$winner->course_id !== (int)$course->course_id ||
                ($winner->folio_course_id && $winner->folio_course_id !== $folioId)) {
                throw new ConflictHttpException('Course offering conflicts with another FOLIO listing.');
            }
            $offering = $winner;
        }

        return ['course' => $course, 'offering' => $offering];
    }

    private function validateData(array $course, array $offering)
    {
        foreach (['course_number', 'course_name', 'department_id'] as $field) {
            if (!isset($course[$field]) || $course[$field] === '') {
                throw new BadRequestHttpException('Missing course field: ' . $field);
            }
        }
        foreach (['folio_course_id', 'term_id', 'term_name'] as $field) {
            if (!isset($offering[$field]) || $offering[$field] === '') {
                throw new BadRequestHttpException('Missing offering field: ' . $field);
            }
        }
    }

    private function isoToMysql($value)
    {
        if (!$value) return null;
        $date = new \DateTimeImmutable($value);
        return $date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    private function computeOfferingStatus($start, $end)
    {
        if (!$start || !$end) return 'active';
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $startDate = new \DateTimeImmutable($start, new \DateTimeZone('UTC'));
        $endDate = new \DateTimeImmutable($end, new \DateTimeZone('UTC'));
        return ($now >= $startDate && $now <= $endDate) ? 'active' : 'inactive';
    }
}
