<?php

namespace tests\unit\services;

use app\services\SubmissionOwnershipPolicy;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;

class SubmissionOwnershipPolicyTest extends \Codeception\Test\Unit
{
    public function testOwnerDefaultsToTokenActorOnlyWhenRosteredForTheCourse()
    {
        $roster = new TestSubmissionOwnershipRosterService(true);
        $policy = new SubmissionOwnershipPolicy($roster);

        $owner = $policy->resolveOwner(
            $this->actor('test-ownership-owner-alpha', '999000101'),
            null,
            null,
            $this->course()
        );

        $this->assertSame('test-ownership-owner-alpha', $owner['owner_id']);
        $this->assertFalse($owner['is_proxy']);
        $this->assertNull($owner['permission']);
        $this->assertSame(['999000101', 'Fall 2099', 'TST 155', '01'], $roster->lastLookup);
    }

    public function testUnrosteredOwnerGetsTheRosterRejection()
    {
        $policy = new SubmissionOwnershipPolicy(new TestSubmissionOwnershipRosterService(false));

        try {
            $policy->resolveOwner(
                $this->actor('test-ownership-unrostered', '999000102'),
                null,
                null,
                $this->course()
            );
            $this->fail('An unrostered faculty member must not create a course submission.');
        } catch (ForbiddenHttpException $exception) {
            $this->assertSame(403, $exception->statusCode);
            $this->assertSame(
                'course not found on your teaching roster; contact library staff',
                $exception->getMessage()
            );
        }
    }

    public function testProxyOwnerRequiresPermission()
    {
        $policy = new SubmissionOwnershipPolicy(new TestSubmissionOwnershipRosterService(false));

        try {
            $policy->resolveOwner(
                $this->actor('test-ownership-proxy-no-permission', '999000103'),
                'test-ownership-owner-bravo',
                'test-ownership-listing-current',
                $this->course()
            );
            $this->fail('A proxy without a permission must not resolve an owner.');
        } catch (ForbiddenHttpException $exception) {
            $this->assertSame(403, $exception->statusCode);
        }
    }

    public function testStaffMayActForAnyFacultyWithoutRosterOrPermission()
    {
        $policy = new SubmissionOwnershipPolicy(new TestSubmissionOwnershipRosterService(false));

        $owner = $policy->resolveOwner(
            $this->actor('test-ownership-staff', null, 'staff'),
            'test-ownership-owner-bravo',
            null,
            $this->course()
        );

        $this->assertSame('test-ownership-owner-bravo', $owner['owner_id']);
        $this->assertTrue($owner['is_proxy']);
        $this->assertNull($owner['permission']);
    }

    public function testRosteredCoInstructorCanReadAndEditAnotherInstructorsSubmission()
    {
        $policy = new SubmissionOwnershipPolicy(new TestSubmissionOwnershipRosterService(true));
        $submission = $this->submission('test-ownership-owner-alpha');
        $coInstructor = $this->actor('test-ownership-co-instructor', '999000104');

        $this->assertTrue($policy->isRosteredCoInstructor($submission, $coInstructor));
        $this->assertTrue($policy->canAccess($submission, $coInstructor));
        $this->assertTrue($policy->canAccess($submission, $coInstructor, true));
    }

    public function testUnrosteredFacultyCannotAccessAnotherInstructorsSubmission()
    {
        $policy = new SubmissionOwnershipPolicy(new TestSubmissionOwnershipRosterService(false));

        $this->assertFalse(
            $policy->canAccess(
                $this->submission('test-ownership-owner-alpha'),
                $this->actor('test-ownership-not-rostered', '999000105')
            )
        );
    }

    public function testStaffCanReadAndEditAnySubmission()
    {
        $policy = new SubmissionOwnershipPolicy(new TestSubmissionOwnershipRosterService(false));
        $staff = $this->actor('test-ownership-staff', null, 'admin');
        $submission = $this->submission('test-ownership-owner-alpha');

        $this->assertTrue($policy->canAccess($submission, $staff));
        $this->assertTrue($policy->canAccess($submission, $staff, true));
    }

    public function testExistingOwnerCanAccessTheirSubmissionWithoutCurrentRosterRow()
    {
        $policy = new SubmissionOwnershipPolicy(new TestSubmissionOwnershipRosterService(false));
        $owner = $this->actor('test-ownership-owner-alpha', '999000106');

        $this->assertTrue($policy->canAccess($this->submission('test-ownership-owner-alpha'), $owner));
        $this->assertTrue($policy->canAccess($this->submission('test-ownership-owner-alpha'), $owner, true));
    }

    public function testUpdateRejectsOwnershipAndCourseIdentityFields()
    {
        $policy = new SubmissionOwnershipPolicy(new TestSubmissionOwnershipRosterService(false));
        $fields = [
            'shibboleth_user_id',
            'proxy_shibboleth_user_id',
            'proxy_display_name',
            'acting_for_faculty_id',
            'term_code',
            'course_code',
            'section',
            'folio_course_listing_id',
        ];

        foreach ($fields as $field) {
            try {
                $policy->assertUpdateDoesNotChangeOwnership([$field => 'test-forged-value']);
                $this->fail('Expected ownership update rejection for ' . $field);
            } catch (BadRequestHttpException $exception) {
                $this->assertSame(400, $exception->statusCode);
            }
        }

        $this->assertNull(
            $policy->assertUpdateDoesNotChangeOwnership(['submission_notes' => 'test-safe-note'])
        );
    }

    private function actor($userId, $internalId, $role = 'faculty')
    {
        return [
            'user_id' => $userId,
            'internal_id' => $internalId,
            'role' => $role,
        ];
    }

    private function course()
    {
        return [
            'term' => 'Fall 2099',
            'courseCode' => 'TST 155',
            'section' => '01',
        ];
    }

    private function submission($ownerId)
    {
        return (object) [
            'shibboleth_user_id' => $ownerId,
            'term_code' => 'Fall 2099',
            'course_code' => 'TST 155',
            'section' => '01',
            'folio_course_listing_id' => 'test-ownership-listing-current',
        ];
    }
}

class TestSubmissionOwnershipRosterService
{
    public $rostered;
    public $lastLookup;

    public function __construct($rostered)
    {
        $this->rostered = $rostered;
    }

    public function isInstructorRostered($smithId, $termCode, $courseCode, $section)
    {
        $this->lastLookup = [$smithId, $termCode, $courseCode, $section];
        return $this->rostered;
    }
}
