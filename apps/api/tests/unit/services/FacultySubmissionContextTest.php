<?php

namespace tests\unit\services;

use app\services\FacultySubmissionContext;

class FacultySubmissionContextTest extends \Codeception\Test\Unit
{
    public function testForOwnerBuildsContextFromActorAndCourse()
    {
        $actor = $this->actor();
        $course = $this->course();
        $context = (new FacultySubmissionContext())->forOwner(
            $actor,
            'test-api098-instructor',
            $course,
            'test-api098-listing'
        );

        $this->assertSame('test-api098-instructor', $context['owner_id']);
        $this->assertFalse($context['is_proxy']);
        $this->assertNull($context['roster_course']);
        $this->assertSame($course, $context['course_info']);
        $this->assertSame([], $context['submitted_by']);
        $this->assertSame('test-api098-listing', $context['folio_course_listing_id']);
        $this->assertSame('test-api098-staff', $context['actor_id']);
        $this->assertSame('Synthetic API098 Staff', $context['actor_name']);
        $this->assertSame('Synthetic API098 Instructor', $context['display_name']);
        $this->assertSame('Fall 2027', $context['term_code']);
        $this->assertSame('API098-context', $context['course_code']);
        $this->assertSame('01', $context['section']);
        $this->assertSame('Synthetic API098 Course', $context['course_title']);
    }

    public function testResolveBuildsTheExistingFacultyContextShape()
    {
        $actor = $this->actor();
        $course = $this->course();
        $context = (new FacultySubmissionContext())->resolve($actor, [
            'folio_course_listing_id' => 'test-api098-listing',
            'courseInfo' => $course,
            'metadata' => ['submittedBy' => ['fullName' => 'Synthetic API098 Faculty']],
        ]);

        $this->assertSame([
            'owner_id' => 'test-api098-staff',
            'is_proxy' => false,
            'roster_course' => null,
            'course_info' => $course,
            'submitted_by' => ['fullName' => 'Synthetic API098 Faculty'],
            'folio_course_listing_id' => 'test-api098-listing',
            'actor_id' => 'test-api098-staff',
            'actor_name' => 'Synthetic API098 Staff',
            'display_name' => 'Synthetic API098 Staff',
            'term_code' => 'Fall 2027',
            'course_code' => 'API098-context',
            'section' => '01',
            'course_title' => 'Synthetic API098 Course',
        ], $context);
    }

    private function actor()
    {
        return [
            'user_id' => 'test-api098-staff',
            'display_name' => 'Synthetic API098 Staff',
            'role' => 'staff',
        ];
    }

    private function course()
    {
        return [
            'courseCode' => 'API098-context',
            'courseTitle' => 'Synthetic API098 Course',
            'term' => 'Fall 2027',
            'section' => '01',
            'instructors' => 'Synthetic API098 Instructor',
        ];
    }
}
