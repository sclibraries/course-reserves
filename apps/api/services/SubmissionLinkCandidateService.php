<?php

namespace app\services;

/** Produces transient FOLIO candidates for the initial staff linking screen. */
class SubmissionLinkCandidateService
{
    private $folioService;
    private $matchRule;

    public function __construct($folioService = null, ?SubmissionLinkMatchRule $matchRule = null)
    {
        $this->folioService = $folioService ?: \Yii::$container->get(FolioService::class);
        $this->matchRule = $matchRule ?: new SubmissionLinkMatchRule();
    }

    public function candidates($submission, $manualQuery = null)
    {
        $search = trim((string)($manualQuery ?: $submission->course_code));
        $query = '(courseNumber=="' . $this->escapeQuery($search) . '")';
        if (!empty($submission->roster_term_id)) {
            $query = '(' . substr($query, 1, -1) . ' and termId=="' .
                $this->escapeQuery($submission->roster_term_id) . '")';
        }
        $results = $this->folioService->searchCourses($query);
        if (is_array($results) && (isset($results['courseListingId']) || isset($results['courseNumber']))) {
            $results = [$results];
        }
        $items = [];
        foreach (is_array($results) ? $results : [] as $listing) {
            if (!is_array($listing)) continue;
            $match = $this->matchRule->evaluate($submission->attributes, $listing);
            $listingObject = $listing['courseListingObject'] ?? [];
            $term = $listingObject['termObject'] ?? $listing['term'] ?? [];
            $items[] = [
                'folio_course_listing_id' => $listing['courseListingId'] ?? $listingObject['id'] ?? $listing['id'] ?? null,
                'courses' => $this->courseSummary($listing),
                'term' => [
                    'id' => $listingObject['termId'] ?? $term['id'] ?? null,
                    'name' => $term['name'] ?? null,
                ],
                'match' => $match['match'],
                'fields' => $match['fields'],
                'term_verified' => $match['term_verified'],
            ];
        }
        return ['items' => $items, 'checked_at' => date('c')];
    }

    private function courseSummary(array $listing)
    {
        $courses = $listing['courses'] ?? $listing['courseListingObject']['courses'] ?? null;
        if (!is_array($courses) || !$courses) $courses = [$listing];
        $summary = [];
        foreach ($courses as $course) {
            $summary[] = [
                'courseNumber' => $course['courseNumber'] ?? null,
                'sectionName' => $course['sectionName'] ?? $listing['sectionName'] ?? null,
                'name' => $course['name'] ?? $listing['name'] ?? null,
            ];
        }
        return $summary;
    }

    private function escapeQuery($value)
    {
        return str_replace(['\\', '"'], ['\\\\', '\\"'], (string)$value);
    }
}
