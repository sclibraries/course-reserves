<?php

namespace app\services;

/** Captures the stable submission fields written to workflow event history. */
class SubmissionLinkSnapshot
{
    public static function fromSubmission($submission)
    {
        return [
            'course_code' => $submission->course_code,
            'section' => $submission->section,
            'term_code' => $submission->term_code,
            'roster_term_id' => $submission->roster_term_id,
            'link_state' => $submission->link_state,
            'link_flag' => $submission->link_flag,
            'offering_id' => $submission->offering_id,
            'folio_course_listing_id' => $submission->folio_course_listing_id,
            'linked_at' => $submission->linked_at,
            'linked_by' => $submission->linked_by,
        ];
    }
}
