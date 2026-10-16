<?php

namespace tests\unit\services;

use app\services\SubmissionLinkMatchRule;

class SubmissionLinkMatchRuleTest extends \Codeception\Test\Unit
{
    public function testNormalizesCourseNumberAndSectionFormatting()
    {
        $result = (new SubmissionLinkMatchRule())->evaluate(
            ['course_code' => ' AFR155 ', 'section' => ' 1 ', 'roster_term_id' => 'term-1', 'term_code' => 'Fall 2027'],
            $this->listing('afr 155', '01', 'term-1', 'Fall 2027')
        );

        $this->assertSame('exact', $result['match']);
        $this->assertSame([
            'course_number' => true,
            'section' => true,
            'term' => true,
        ], $result['fields']);
        $this->assertTrue($result['term_verified']);
    }

    public function testCrossListedListingMatchesAnyCourseNumber()
    {
        $listing = $this->listing('OTHER 200', '01', 'term-1', 'Fall 2027');
        $listing['courses'][] = [
            'courseNumber' => 'AFR 155',
            'sectionName' => '01',
            'name' => 'Synthetic cross-listed course',
        ];

        $result = (new SubmissionLinkMatchRule())->evaluate(
            ['course_code' => 'AFR155', 'section' => '1', 'roster_term_id' => 'term-1', 'term_code' => 'Fall 2027'],
            $listing
        );

        $this->assertSame('exact', $result['match']);
        $this->assertTrue($result['fields']['course_number']);
    }

    public function testReportsEachMismatchAndPossibleMatch()
    {
        $result = (new SubmissionLinkMatchRule())->evaluate(
            ['course_code' => 'AFR 155', 'section' => '01', 'roster_term_id' => 'term-1', 'term_code' => 'Fall 2027'],
            $this->listing('AFR155', '02', 'term-1', 'Fall 2027')
        );

        $this->assertSame('possible', $result['match']);
        $this->assertSame([
            'course_number' => true,
            'section' => false,
            'term' => true,
        ], $result['fields']);
    }

    public function testSameCourseWithDifferentSectionAndTermIsNotPossible()
    {
        $result = (new SubmissionLinkMatchRule())->evaluate(
            ['course_code' => 'AFR 155', 'section' => '01', 'roster_term_id' => 'term-1', 'term_code' => 'Fall 2027'],
            $this->listing('AFR155', '02', 'term-2', 'Spring 2028')
        );

        $this->assertSame('none', $result['match']);
        $this->assertSame([
            'course_number' => true,
            'section' => false,
            'term' => false,
        ], $result['fields']);
    }

    public function testSameCourseAndSectionWithDifferentTermIsPossible()
    {
        $result = (new SubmissionLinkMatchRule())->evaluate(
            ['course_code' => 'AFR 155', 'section' => '01', 'roster_term_id' => 'term-1', 'term_code' => 'Fall 2027'],
            $this->listing('AFR155', '01', 'term-2', 'Spring 2028')
        );

        $this->assertSame('possible', $result['match']);
    }

    public function testNullRosterTermComparesNameAndMarksItUnverified()
    {
        $result = (new SubmissionLinkMatchRule())->evaluate(
            ['course_code' => 'AFR155', 'section' => '01', 'roster_term_id' => null, 'term_code' => 'Synthetic Period'],
            $this->listing('AFR 155', '1', 'folio-term-1', 'Synthetic Period')
        );

        $this->assertSame('exact', $result['match']);
        $this->assertTrue($result['fields']['term']);
        $this->assertFalse($result['term_verified']);
    }

    public function testDifferentCourseNumberIsNotAMatch()
    {
        $result = (new SubmissionLinkMatchRule())->evaluate(
            ['course_code' => 'AFR155', 'section' => '01', 'roster_term_id' => 'term-1', 'term_code' => 'Fall 2027'],
            $this->listing('AFR 156', '01', 'term-1', 'Fall 2027')
        );

        $this->assertSame('none', $result['match']);
        $this->assertFalse($result['fields']['course_number']);
    }

    private function listing($courseNumber, $section, $termId, $termName)
    {
        return [
            'courseNumber' => $courseNumber,
            'sectionName' => $section,
            'courseListingObject' => [
                'termId' => $termId,
                'termObject' => ['name' => $termName],
            ],
        ];
    }
}
