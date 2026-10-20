<?php

namespace app\services;

/** Projects submission linkage fields for staff responses. */
class SubmissionLinkPresenter
{
    public function present($submission)
    {
        return [
            'submission_id' => (int)$submission->submission_id,
            'submission_uuid' => $submission->submission_uuid,
            'link_state' => $submission->link_state,
            'link_flag' => $submission->link_flag,
            'linked_at' => $submission->linked_at,
            'linked_by' => $submission->linked_by,
            'offering_id' => $submission->offering_id ? (int)$submission->offering_id : null,
            'folio_course_listing_id' => $submission->folio_course_listing_id,
            'its_course_id' => $submission->its_course_id,
            'academic_period' => $submission->academic_period,
            'roster_term_id' => $submission->roster_term_id,
            'term_code' => $submission->term_code,
            'course_code' => $submission->course_code,
            'section' => $submission->section,
            'course_title' => $submission->course_title,
        ];
    }
}
