<?php

namespace app\services;

/** Compares an ITS roster identity with an authoritative FOLIO course listing. */
class SubmissionLinkMatchRule
{
    public function evaluate(array $submission, array $listing)
    {
        $courseNumberMatches = $this->matchesCourseNumber($submission['course_code'] ?? '', $listing);
        $sectionMatches = $this->normalizeSection($submission['section'] ?? '') ===
            $this->normalizeSection($this->listingSection($listing));

        $rosterTermId = $submission['roster_term_id'] ?? null;
        $termVerified = !empty($rosterTermId);
        if ($termVerified) {
            $termMatches = (string)$rosterTermId === (string)$this->listingTermId($listing);
        } else {
            $termMatches = $this->normalizeTerm($submission['term_code'] ?? '') ===
                $this->normalizeTerm($this->listingTermName($listing));
        }

        $fields = [
            'course_number' => $courseNumberMatches,
            'section' => $sectionMatches,
            'term' => $termMatches,
        ];
        $exact = $courseNumberMatches && $sectionMatches && $termMatches;
        $possible = $courseNumberMatches && ($sectionMatches xor $termMatches);

        return [
            'match' => $exact ? 'exact' : ($possible ? 'possible' : 'none'),
            'fields' => $fields,
            'term_verified' => $termVerified,
        ];
    }

    public function matchesCourseNumber($courseCode, array $listing)
    {
        $wanted = $this->normalizeCourseNumber($courseCode);
        foreach ($this->listingCourses($listing) as $course) {
            if ($wanted !== '' && $wanted === $this->normalizeCourseNumber($course['courseNumber'] ?? '')) {
                return true;
            }
        }
        return false;
    }

    private function listingCourses(array $listing)
    {
        if (!empty($listing['courses']) && is_array($listing['courses'])) {
            return $listing['courses'];
        }
        if (!empty($listing['courseListingObject']['courses']) && is_array($listing['courseListingObject']['courses'])) {
            return $listing['courseListingObject']['courses'];
        }
        return [$listing];
    }

    private function listingSection(array $listing)
    {
        return $listing['sectionName'] ?? $listing['courseListingObject']['sectionName'] ?? '';
    }

    private function listingTermId(array $listing)
    {
        return $listing['courseListingObject']['termId'] ?? $listing['term']['id'] ?? null;
    }

    private function listingTermName(array $listing)
    {
        return $listing['courseListingObject']['termObject']['name'] ?? $listing['term']['name'] ?? '';
    }

    private function normalizeCourseNumber($value)
    {
        return strtolower(preg_replace('/\s+/u', '', trim((string)$value)));
    }

    private function normalizeSection($value)
    {
        $section = strtolower(preg_replace('/\s+/u', '', trim((string)$value)));
        if (preg_match('/^\d+$/', $section)) {
            $section = ltrim($section, '0');
            return $section === '' ? '0' : $section;
        }
        return $section;
    }

    private function normalizeTerm($value)
    {
        return strtolower(preg_replace('/\s+/u', ' ', trim((string)$value)));
    }
}
