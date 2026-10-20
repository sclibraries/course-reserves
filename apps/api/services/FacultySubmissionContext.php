<?php

namespace app\services;

use app\components\Roles;
use app\models\FacultySubmission;
use yii\web\BadRequestHttpException;

/** Resolves roster ownership and canonical course fields for submissions. */
class FacultySubmissionContext
{
    private $ownership;

    public function __construct(?SubmissionOwnershipPolicy $ownership = null)
    {
        $this->ownership = $ownership ?: new SubmissionOwnershipPolicy();
    }

    public function resolve(array $actor, array $data)
    {
        $course = $data['courseInfo'] ?? [];
        if (!$course) {
            throw new BadRequestHttpException('Missing courseInfo');
        }
        $isStaff = Roles::isStaff($actor['role'] ?? null);
        $courseId = $data['its_course_id'] ?? null;
        $period = $data['academic_period'] ?? null;
        $hasCourseId = is_string($courseId) && trim($courseId) !== '';
        $hasPeriod = is_string($period) && trim($period) !== '';
        if ($hasCourseId !== $hasPeriod || (!$isStaff && !$hasCourseId)) {
            return ['status_code' => 422, 'error_code' => 'roster_course_required'];
        }
        $folioId = $data['folio_course_listing_id'] ?? null;
        $ownership = $this->ownership->resolveOwner(
            $actor,
            $data['acting_for_faculty_id'] ?? null,
            $folioId,
            $course,
            $hasCourseId ? $courseId : null,
            $hasPeriod ? $period : null
        );
        if (isset($ownership['error_code'])) {
            return $ownership;
        }
        $roster = $ownership['roster_course'] ?? null;
        return [
            'owner_id' => $ownership['owner_id'],
            'is_proxy' => $ownership['is_proxy'],
            'roster_course' => $roster,
            'course_info' => $course,
            'submitted_by' => ($data['metadata'] ?? [])['submittedBy'] ?? [],
            'folio_course_listing_id' => $folioId,
            'actor_id' => $actor['user_id'],
            'actor_name' => $actor['display_name'] ?? null,
            'display_name' => $actor['display_name'] ?? null,
            'term_code' => $roster['term_code'] ?? $course['term'],
            'course_code' => $roster['course_code'] ?? $course['courseCode'],
            'section' => $roster['section'] ?? $course['section'] ?? '',
            'course_title' => $roster['course_title'] ?? $course['courseTitle'],
        ];
    }

    public function findForCourse(array $context)
    {
        $roster = $context['roster_course'];
        $criteria = $roster
            ? ['its_course_id' => $roster['its_course_id'], 'academic_period' => $roster['academic_period']]
            : [
                'term_code' => $context['term_code'],
                'course_code' => $context['course_code'],
                'section' => $context['section'],
            ];
        return FacultySubmission::find()->where(['shibboleth_user_id' => $context['owner_id']])
            ->andWhere($criteria)->one();
    }

    public function newSubmission(array $context, $status)
    {
        $submission = new FacultySubmission();
        $this->apply($submission, $context);
        $submission->status = $status;
        $submission->submitted_at = $status === FacultySubmission::STATUS_SUBMITTED ? date('Y-m-d H:i:s') : null;
        return $submission;
    }

    public function apply($submission, array $context)
    {
        $course = $context['course_info'];
        $submittedBy = $context['submitted_by'];
        $submission->shibboleth_user_id = $context['owner_id'];
        $submission->faculty_display_name = $course['instructors'] ?? $submittedBy['fullName'] ?? $context['display_name'];
        $submission->term_code = $context['term_code'];
        $submission->course_code = $context['course_code'];
        $submission->section = $context['section'];
        $submission->course_title = $context['course_title'];
        $roster = $context['roster_course'];
        $submission->its_course_id = $roster['its_course_id'] ?? null;
        $submission->academic_period = $roster['academic_period'] ?? null;
        $submission->roster_term_id = $roster['roster_term_id'] ?? null;
        $submission->folio_course_listing_id = $context['folio_course_listing_id'];
        if ($context['is_proxy']) {
            $submission->proxy_shibboleth_user_id = $context['actor_id'];
            $submission->proxy_display_name = $context['actor_name'];
        }
    }
}
