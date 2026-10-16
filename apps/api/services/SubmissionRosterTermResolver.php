<?php

namespace app\services;

/** Resolves a submission's roster term for link matching without persisting it. */
class SubmissionRosterTermResolver
{
    private $courseRosterService;

    public function __construct($folioService = null)
    {
        $this->courseRosterService = new CourseRosterService($folioService);
    }

    /**
     * Return matching attributes with an API-079 mapped term when the roster term is missing.
     * API-081 rechecks should use this same resolver before evaluating the shared match rule.
     */
    public function attributesForMatch(array $submissionAttributes)
    {
        if (!empty($submissionAttributes['roster_term_id']) || empty($submissionAttributes['academic_period'])) {
            return $submissionAttributes;
        }

        $term = $this->courseRosterService->mapAcademicPeriodToTerm($submissionAttributes['academic_period']);
        if ($term === null || empty($term['id']) || empty($term['name'])) {
            return $submissionAttributes;
        }

        $submissionAttributes['roster_term_id'] = $term['id'];
        $submissionAttributes['term_code'] = $term['name'];
        return $submissionAttributes;
    }
}
