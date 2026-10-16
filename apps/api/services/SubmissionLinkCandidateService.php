<?php

namespace app\services;

/** Produces FOLIO candidates using the shared roster-term resolver and match rule. */
class SubmissionLinkCandidateService
{
    private $folioService;
    private $matchRule;
    private $termResolver;

    public function __construct($folioService = null, ?SubmissionLinkMatchRule $matchRule = null, $strictFolio = false)
    {
        $this->folioService = $folioService ?: \Yii::$container->get(FolioService::class);
        $this->matchRule = $matchRule ?: new SubmissionLinkMatchRule();
        $this->termResolver = new SubmissionRosterTermResolver($this->folioService, $strictFolio);
    }

    public function candidates($submission, $manualQuery = null)
    {
        $attributes = $this->termResolver->attributesForMatch($submission->attributes);
        $search = trim((string)($manualQuery ?: $submission->course_code));
        $results = $this->search($this->query($search, $attributes), false);

        return [
            'items' => $this->formatResults($results, $attributes),
            'checked_at' => date('c'),
        ];
    }

    /** Fetch exact-term and course-number-only hits for a persistent suggestion check. */
    public function suggestions($submission)
    {
        $attributes = $this->termResolver->attributesForMatch($submission->attributes);
        $courseNumber = trim((string)$submission->course_code);
        if ($courseNumber === '') {
            throw new \RuntimeException('SUBMISSION_MISSING_COURSE_NUMBER');
        }

        $queries = [];
        if (!empty($attributes['roster_term_id'])) {
            $queries[] = $this->query($courseNumber, $attributes);
        }
        $queries[] = $this->query($courseNumber, []);

        $listings = [];
        foreach ($queries as $query) {
            foreach ($this->normalizeResults($this->search($query, true)) as $listing) {
                $id = $this->listingId($listing);
                if ($id !== null) {
                    $listings[(string)$id] = $listing;
                }
            }
        }

        return $this->formatResults(array_values($listings), $attributes);
    }

    private function search($query, $strict)
    {
        if ($strict && method_exists($this->folioService, 'searchCoursesStrict')) {
            return $this->folioService->searchCoursesStrict($query);
        }
        return $this->folioService->searchCourses($query);
    }

    private function query($search, array $attributes)
    {
        $query = '(courseNumber=="' . $this->escapeQuery($search) . '")';
        if (!empty($attributes['roster_term_id'])) {
            $query = '(' . substr($query, 1, -1) . ' and termId=="' .
                $this->escapeQuery($attributes['roster_term_id']) . '")';
        }
        return $query;
    }

    private function formatResults($results, array $attributes)
    {
        $items = [];
        foreach ($this->normalizeResults($results) as $listing) {
            if (!is_array($listing)) {
                continue;
            }
            $match = $this->matchRule->evaluate($attributes, $listing);
            $listingObject = $listing['courseListingObject'] ?? [];
            $term = $listingObject['termObject'] ?? $listing['term'] ?? [];
            $items[] = [
                'folio_course_listing_id' => $this->listingId($listing),
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
        return $items;
    }

    private function normalizeResults($results)
    {
        if (is_array($results) && (isset($results['courseListingId']) || isset($results['courseNumber']) || isset($results['id']))) {
            return [$results];
        }
        return is_array($results) ? $results : [];
    }

    private function listingId(array $listing)
    {
        return $listing['courseListingId'] ?? $listing['courseListingObject']['id'] ?? $listing['id'] ?? null;
    }

    private function courseSummary(array $listing)
    {
        $courses = $listing['courses'] ?? $listing['courseListingObject']['courses'] ?? null;
        if (!is_array($courses) || !$courses) {
            $courses = [$listing];
        }
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
