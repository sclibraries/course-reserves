<?php

namespace tests\unit\controllers;

use app\controllers\SubmissionWorkflowController;
use app\models\FacultySubmission;
use app\models\SubmissionWorkflowAssignment;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;
use yii\web\ForbiddenHttpException;

class SubmissionWorkflowControllerTest extends \Codeception\Test\Unit
{
    public function testStaffWorkflowAccessRejectsFacultyIdentity()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);

        $this->expectException(ForbiddenHttpException::class);
        $this->invokeMethod($controller, 'assertStaffWorkflowAccess', [
            (object) ['role' => 'faculty'],
        ]);
    }

    public function testStaffWorkflowAccessAllowsStaffAndAdminIdentities()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);

        $this->assertNull($this->invokeMethod($controller, 'assertStaffWorkflowAccess', [
            (object) ['role' => 'staff'],
        ]));
        $this->assertNull($this->invokeMethod($controller, 'assertStaffWorkflowAccess', [
            (object) ['role' => 'admin'],
        ]));
    }

    public function testFormatSubmissionDetailResponseIncludesProcessingContext()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);
        $submission = $this->buildSubmission();
        $item = $this->buildNewResource($submission['submission_id']);

        $submission['newResources'] = [$item];
        $submission['reuseResources'] = [];
        $submission['workflowAssignment'] = null;
        $submission['communications'] = [];

        $formatted = $this->invokeMethod($controller, 'formatSubmissionDetailResponse', [$submission]);

        $this->assertSame('folio-course-123', $formatted['folio_course_listing_id']);
        $this->assertSame(44, $formatted['offering_id']);
        $this->assertArrayHasKey('processing_context', $formatted['newResources'][0]);
        $this->assertSame(31, $formatted['newResources'][0]['processing_context']['submission_id']);
        $this->assertSame(88, $formatted['newResources'][0]['processing_context']['item_id']);
        $this->assertSame('folio-course-123', $formatted['newResources'][0]['processing_context']['folio_course_listing_id']);
        $this->assertSame(44, $formatted['newResources'][0]['processing_context']['offering_id']);
        $this->assertTrue($formatted['newResources'][0]['processing_context']['course_linked']);
        $this->assertTrue($formatted['newResources'][0]['processing_context']['can_open_processing']);
        $this->assertSame('/admin/submissions/31', $formatted['newResources'][0]['processing_context']['return_to']);
        $this->assertNull($formatted['newResources'][0]['processing_context']['blocking_reason']);
    }

    public function testFormatClaimedItemResponseIncludesSubmissionLinkageFields()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);
        $submission = $this->buildSubmission();
        $item = $this->buildNewResource($submission['submission_id']);

        $item['submission'] = [
            'submission_id' => $submission['submission_id'],
            'submission_uuid' => $submission['submission_uuid'],
            'course_code' => $submission['course_code'],
            'course_title' => $submission['course_title'],
            'term_code' => $submission['term_code'],
            'section' => $submission['section'],
            'faculty_display_name' => $submission['faculty_display_name'],
            'status' => $submission['status'],
            'folio_course_listing_id' => $submission['folio_course_listing_id'],
            'offering_id' => $submission['offering_id'],
        ];
        $item['materialType'] = ['material_type_id' => 3, 'name' => 'Book'];

        $formatted = $this->invokeMethod($controller, 'formatClaimedItemResponse', [$item]);

        $this->assertSame(31, $formatted['submission']['submission_id']);
        $this->assertSame('folio-course-123', $formatted['submission']['folio_course_listing_id']);
        $this->assertSame(44, $formatted['submission']['offering_id']);
        $this->assertArrayHasKey('processing_context', $formatted);
        $this->assertSame(31, $formatted['processing_context']['submission_id']);
        $this->assertSame(88, $formatted['processing_context']['item_id']);
        $this->assertSame('folio-course-123', $formatted['processing_context']['folio_course_listing_id']);
        $this->assertSame(44, $formatted['processing_context']['offering_id']);
        $this->assertSame('/admin/work-queue/88', $formatted['processing_context']['return_to']);
        $this->assertTrue($formatted['processing_context']['can_open_processing']);
    }

    public function testCompleteAssignmentMarksAssignmentAndSubmissionComplete()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);
        $submission = new class {
            public $status = 'in_review';
            public $saveCount = 0;

            public function save()
            {
                $this->saveCount++;
                return true;
            }
        };
        $assignment = new class($submission) {
            public $status = 'in_progress';
            public $submission;
            public $saveCount = 0;

            public function __construct($submission)
            {
                $this->submission = $submission;
            }

            public function save()
            {
                $this->saveCount++;
                return true;
            }
        };

        $result = $this->invokeMethod($controller, 'completeAssignment', [$assignment]);

        $this->assertSame('completed', $assignment->status);
        $this->assertSame('complete', $submission->status);
        $this->assertSame(1, $assignment->saveCount);
        $this->assertSame(1, $submission->saveCount);
        $this->assertSame([
            'success' => true,
            'message' => 'Submission marked as completed',
        ], $result);
    }

    public function testClaimActorRequiresStaffIdentityWithId()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);

        $this->expectException(ForbiddenHttpException::class);

        $this->invokeMethod($controller, 'assertClaimActor', [
            (object) ['role' => 'staff', 'id' => null],
        ]);
    }

    public function testClaimActorUsesTokenUsername()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);
        $actor = $this->invokeMethod($controller, 'claimActor', [
            (object) ['id' => 27, 'username' => 'test-api082-staff', 'role' => 'staff'],
        ]);

        $this->assertSame(['username' => 'test-api082-staff', 'role' => 'staff'], $actor);
    }

    public function testSubmissionAssignmentConflictRejectsAlreadyAssignedSubmission()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);
        $submission = (object) [
            'status' => FacultySubmission::STATUS_SUBMITTED,
        ];
        $existingAssignment = (object) [
            'assignment_id' => 123,
            'assigned_staff_user_id' => 42,
        ];

        $this->expectException(ConflictHttpException::class);

        $this->invokeMethod($controller, 'assertSubmissionCanBeAssigned', [
            $submission,
            $existingAssignment,
        ]);
    }

    public function testAssignmentStatusValidationRejectsUnknownStatus()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);

        $this->expectException(BadRequestHttpException::class);

        $this->invokeMethod($controller, 'assertAssignmentStatusIsValid', [
            'not_a_real_status',
        ]);
    }

    public function testAssignmentStatusValidationAllowsKnownStatus()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);

        $this->assertNull($this->invokeMethod($controller, 'assertAssignmentStatusIsValid', [
            SubmissionWorkflowAssignment::STATUS_ON_HOLD,
        ]));
    }

    public function testItemMutationRejectsItemClaimedByAnotherStaffMember()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);
        $item = (object) [
            'item_status' => 'in_progress',
            'claimed_by' => 'test-other-staff',
        ];

        $this->expectException(ConflictHttpException::class);

        $this->invokeMethod($controller, 'assertItemCanBeMutatedBy', [
            $item,
            (object) ['role' => 'staff', 'id' => 27, 'username' => 'test-current-staff'],
            'updated',
        ]);
    }

    public function testItemMutationAllowsUnclaimedItem()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);
        $item = (object) [
            'item_status' => 'pending',
            'claimed_by' => null,
        ];

        $this->assertNull($this->invokeMethod($controller, 'assertItemCanBeMutatedBy', [
            $item,
            (object) ['role' => 'staff', 'id' => 27, 'username' => 'test-current-staff'],
            'updated',
        ]));
    }

    public function testItemMutationAllowsClaimOwnerByUsername()
    {
        $controller = new SubmissionWorkflowController('submission-workflow', \Yii::$app);

        $this->assertNull($this->invokeMethod($controller, 'assertItemCanBeMutatedBy', [
            (object) ['claimed_by' => 'test-current-staff'],
            (object) ['role' => 'staff', 'id' => 27, 'username' => 'test-current-staff'],
            'updated',
        ]));
    }

    private function buildSubmission()
    {
        return [
            'submission_id' => 31,
            'submission_uuid' => 'workflow-submission-uuid',
            'shibboleth_user_id' => 'faculty1',
            'term_code' => '2026SP',
            'course_code' => 'ENG 101',
            'section' => '01',
            'course_title' => 'Intro to Literature',
            'folio_course_listing_id' => 'folio-course-123',
            'offering_id' => 44,
            'needed_by_date' => '2026-05-01',
            'status' => 'in_review',
            'faculty_display_name' => 'Prof. Example',
            'submitted_at' => '2026-04-14 10:00:00',
            'newResources' => [],
            'reuseResources' => [],
            'workflowAssignment' => null,
            'communications' => [],
        ];
    }

    private function buildNewResource($submissionId)
    {
        return [
            'id' => 88,
            'submission_id' => $submissionId,
            'material_type_id' => 3,
            'resource_data' => json_encode([
                'title' => 'Requested title',
                'authors' => 'Author Name',
                'url' => 'https://example.test/resource',
            ]),
            'item_status' => 'in_progress',
            'priority' => 'medium',
            'is_reuse' => 0,
            'source_resource_id' => null,
            'source_folio_instance_id' => 'instance-123',
            'source_barcode' => '123456',
            'source_call_number' => 'PN 101 .E9',
            'folder_name' => 'Week 1',
            'claimed_by_staff_id' => 27,
            'claimed_at' => '2026-04-14 11:00:00',
            'staff_notes' => 'Claimed by Dev Admin at 2026-04-14 11:00:00',
        ];
    }

    private function invokeMethod($object, $methodName, array $arguments = [])
    {
        $reflection = new \ReflectionMethod($object, $methodName);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($object, $arguments);
    }
}
