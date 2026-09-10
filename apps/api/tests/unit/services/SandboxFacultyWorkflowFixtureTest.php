<?php

namespace tests\unit\services;

use app\services\SandboxFacultyWorkflowFixture;

class SandboxFacultyWorkflowFixtureTest extends \Codeception\Test\Unit
{
    public function testFolioCourseUsesExpectedSandboxShape()
    {
        $fixture = new SandboxFacultyWorkflowFixture();

        $course = $fixture->getFolioCourse();

        $this->assertSame(SandboxFacultyWorkflowFixture::FOLIO_COURSE_LISTING_ID, $course['id']);
        $this->assertSame(SandboxFacultyWorkflowFixture::FOLIO_COURSE_LISTING_ID, $course['courseListingId']);
        $this->assertSame(SandboxFacultyWorkflowFixture::COURSE_NUMBER, $course['courseNumber']);
        $this->assertSame(SandboxFacultyWorkflowFixture::COURSE_TITLE, $course['name']);
        $this->assertSame(SandboxFacultyWorkflowFixture::FOLIO_TERM_ID, $course['courseListingObject']['termId']);
        $this->assertSame(SandboxFacultyWorkflowFixture::TERM_NAME, $course['courseListingObject']['termObject']['name']);
    }

    public function testSandboxIdentifierPredicateOnlyMatchesFixtureValues()
    {
        $fixture = new SandboxFacultyWorkflowFixture();

        $this->assertTrue($fixture->isSandboxIdentifier(SandboxFacultyWorkflowFixture::FACULTY_USER_ID));
        $this->assertTrue($fixture->isSandboxIdentifier(SandboxFacultyWorkflowFixture::FOLIO_COURSE_LISTING_ID));
        $this->assertTrue($fixture->isSandboxIdentifier(SandboxFacultyWorkflowFixture::COURSE_NUMBER));

        $this->assertFalse($fixture->isSandboxIdentifier('BIO 101'));
        $this->assertFalse($fixture->isSandboxIdentifier('faculty@example.edu'));
        $this->assertFalse($fixture->isSandboxIdentifier('test'));
        $this->assertFalse($fixture->isSandboxIdentifier(''));
    }

    public function testSearchCoursesResponseUsesMiddlewareEnvelope()
    {
        $fixture = new SandboxFacultyWorkflowFixture();

        $response = $fixture->getSearchCoursesResponse('(courseListingId=sandbox-folio-course-001)');

        $this->assertSame('success', $response['message']);
        $this->assertSame(200, $response['code']);
        $this->assertSame(1, $response['data']['totalRecords']);
        $this->assertSame(SandboxFacultyWorkflowFixture::FOLIO_COURSE_LISTING_ID, $response['data']['courses'][0]['courseListingId']);
    }

    public function testCourseAssignmentUsesFacultyInternalIdAndParseableCourseId()
    {
        $fixture = new SandboxFacultyWorkflowFixture();

        $assignment = $fixture->getCourseAssignment();

        $this->assertSame(SandboxFacultyWorkflowFixture::FACULTY_INTERNAL_ID, $assignment['smith_id']);
        $this->assertSame('Instructor', $assignment['role']);
        $this->assertSame('TST-101-01-202603', $assignment['course_id']);
        $this->assertSame(SandboxFacultyWorkflowFixture::COURSE_TITLE, $assignment['course_title']);
    }
}
