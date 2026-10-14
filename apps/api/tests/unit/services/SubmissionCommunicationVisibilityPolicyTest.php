<?php

namespace tests\unit\services;

use app\models\SubmissionCommunication;
use app\services\SubmissionCommunicationVisibilityPolicy;
use yii\web\BadRequestHttpException;

class SubmissionCommunicationVisibilityPolicyTest extends \Codeception\Test\Unit
{
    public function testFacultyConditionNamesOnlyFacultyVisibleMessages()
    {
        $policy = new SubmissionCommunicationVisibilityPolicy();

        $this->assertSame([
            'visibility' => SubmissionCommunication::VISIBILITY_FACULTY,
        ], $policy->facultyCondition());
    }

    public function testStaffMessageDefaultFailsClosed()
    {
        $policy = new SubmissionCommunicationVisibilityPolicy();

        $this->assertSame(
            SubmissionCommunication::VISIBILITY_STAFF_ONLY,
            $policy->staffDefaultVisibility()
        );
    }

    public function testFacultyVisibilityRejectsEveryStaffVisibility()
    {
        $policy = new SubmissionCommunicationVisibilityPolicy();

        $this->assertTrue($policy->isFacultyVisible(SubmissionCommunication::VISIBILITY_FACULTY));
        $this->assertFalse($policy->isFacultyVisible(SubmissionCommunication::VISIBILITY_ALL_STAFF));
        $this->assertFalse($policy->isFacultyVisible(SubmissionCommunication::VISIBILITY_STAFF_ONLY));
        $this->assertFalse($policy->isFacultyVisible(SubmissionCommunication::VISIBILITY_ASSIGNED));
    }

    public function testOmittedReplyVisibilityInheritsParentVisibility()
    {
        $policy = new SubmissionCommunicationVisibilityPolicy();
        $parent = (object) ['visibility' => SubmissionCommunication::VISIBILITY_ASSIGNED];

        $this->assertSame(
            SubmissionCommunication::VISIBILITY_ASSIGNED,
            $policy->resolveStaffVisibility($parent, null)
        );
    }

    public function testReplyMayUseMatchingParentVisibility()
    {
        $policy = new SubmissionCommunicationVisibilityPolicy();
        $parent = (object) ['visibility' => SubmissionCommunication::VISIBILITY_STAFF_ONLY];

        $this->assertSame(
            SubmissionCommunication::VISIBILITY_STAFF_ONLY,
            $policy->resolveStaffVisibility($parent, SubmissionCommunication::VISIBILITY_STAFF_ONLY)
        );
    }

    public function testReplyCannotBroadenParentVisibility()
    {
        $policy = new SubmissionCommunicationVisibilityPolicy();
        $parent = (object) ['visibility' => SubmissionCommunication::VISIBILITY_STAFF_ONLY];

        $this->expectException(BadRequestHttpException::class);
        $this->expectExceptionMessage('Reply visibility must match the parent thread.');

        $policy->resolveStaffVisibility($parent, SubmissionCommunication::VISIBILITY_FACULTY);
    }

    public function testModelDefaultAndFacultyVisibilityFollowPolicy()
    {
        $communication = new SubmissionCommunication();
        $visibilityDefault = null;
        foreach ($communication->rules() as $rule) {
            if ($rule[0] === ['visibility'] && $rule[1] === 'default') {
                $visibilityDefault = $rule['value'];
            }
        }

        $this->assertSame(SubmissionCommunication::VISIBILITY_STAFF_ONLY, $visibilityDefault);
        $communication->visibility = SubmissionCommunication::VISIBILITY_ALL_STAFF;
        $this->assertFalse($communication->isVisibleToFaculty());
        $communication->visibility = SubmissionCommunication::VISIBILITY_FACULTY;
        $this->assertTrue($communication->isVisibleToFaculty());
    }
}
