<?php

namespace tests\unit\services;

use app\services\FacultySubmissionPresenter;

class FacultySubmissionPresenterTest extends \Codeception\Test\Unit
{
    public function testSubmissionAllowlistFiltersNestedResourcesMetadataOfferingAndCommunications()
    {
        $response = FacultySubmissionPresenter::submissionResponse([
            'submission_uuid' => '77000000-0000-4000-8000-000000000077',
            'submission_id' => 93,
            'shibboleth_user_id' => 'test-api077-faculty',
            'course_code' => 'TST 077',
            'status' => 'draft',
            'submission_notes' => 'Faculty note',
            'newResources' => [[
                'id' => 19,
                'submission_id' => 93,
                'resource_data' => '{"title":"Synthetic item"}',
                'faculty_notes' => 'Item note',
                'staff_notes' => 'test-internal-item-note',
                'claimed_by_staff_id' => 'test-api077-staff',
                'materialized_resource_id' => 82,
                'future_staff_flag' => true,
            ]],
            'workflowAssignment' => ['staff_notes' => 'test-internal-assignment-note'],
            'metadata' => [
                'total_items' => 1,
                'submitted_by_email' => 'private@example.test',
                'raw_payload' => 'private payload',
            ],
            'courseOffering' => [
                'offering_id' => 7,
                'course_id' => 19,
                'term_name' => 'Fall 2099',
            ],
            'communications' => [[
                'id' => 10,
                'message' => 'Faculty-visible message',
                'sender_email' => 'private@example.test',
                'visibility' => 'staff_only',
            ]],
            'future_submission_field' => 'hidden',
        ]);

        $this->assertSame([
            'submission_uuid' => '77000000-0000-4000-8000-000000000077',
            'course_code' => 'TST 077',
            'status' => 'draft',
            'submission_notes' => 'Faculty note',
            'newResources' => [[
                'id' => 19,
                'resource_data' => '{"title":"Synthetic item"}',
                'faculty_notes' => 'Item note',
            ]],
            'metadata' => ['total_items' => 1],
            'courseOffering' => ['offering_id' => 7, 'term_name' => 'Fall 2099'],
            'communications' => [[
                'id' => 10,
                'message' => 'Faculty-visible message',
            ]],
        ], $response);
    }

    public function testWorkflowLinkingFieldsAndEventsNeverReachFaculty()
    {
        $response = FacultySubmissionPresenter::submissionResponse([
            'submission_uuid' => '77000000-0000-4000-8000-000000000080',
            'course_code' => 'TST 080',
            'link_state' => 'linked',
            'link_flag' => 'mismatch_override',
            'linked_at' => '2026-10-16 12:00:00',
            'linked_by' => 'test-api080-staff',
            'workflow_events' => [[
                'event_type' => 'link_override',
                'actor_username' => 'test-api080-staff',
            ]],
        ]);

        $this->assertSame([
            'submission_uuid' => '77000000-0000-4000-8000-000000000080',
            'course_code' => 'TST 080',
        ], $response);
        $this->assertArrayNotHasKey('link_flag', $response);
        $this->assertArrayNotHasKey('linked_by', $response);
        $this->assertArrayNotHasKey('workflow_events', $response);
    }

    public function testIndexStatusAndSubmitCompleteKeepOnlyAllowlistedResponseFields()
    {
        $index = FacultySubmissionPresenter::submissionIndexResponse([
            'items' => [[
                'submission_uuid' => 'synthetic-uuid',
                'course_code' => 'TST 077',
                'submission_id' => 93,
                'staff_only_future_field' => 'hidden',
            ]],
            'meta' => ['totalCount' => 1, 'count' => 1, 'internal' => 'hidden'],
            'internal' => 'hidden',
        ]);
        $this->assertSame([
            'items' => [[
                'submission_uuid' => 'synthetic-uuid',
                'course_code' => 'TST 077',
            ]],
            'meta' => ['totalCount' => 1, 'count' => 1],
        ], $index);

        $status = FacultySubmissionPresenter::statusResponse([
            'submission_id' => 93,
            'course_code' => 'TST 077',
            'overall_status' => 'submitted',
            'assignee' => 'test-api077-staff',
            'status_summary' => [
                'total_items' => 2,
                'by_status' => ['pending' => 2],
                'internal' => 'hidden',
            ],
        ]);
        $this->assertSame([
            'course_code' => 'TST 077',
            'overall_status' => 'submitted',
            'status_summary' => ['total_items' => 2, 'by_status' => ['pending' => 2]],
        ], $status);

        $complete = FacultySubmissionPresenter::submitCompleteResponse([
            'success' => true,
            'message' => 'Submitted',
            'submission' => [
                'submission_uuid' => 'synthetic-uuid',
                'email_confirmation_status' => 'requested',
                'email_confirmation_sent' => 0,
                'email_confirmation_requested_at' => '2026-10-16 09:00:00',
                'email_confirmation_sent_at' => null,
                'email_confirmation_error' => 'private',
                'submission_id' => 93,
            ],
            'stats' => ['resources_processed' => 2, 'private' => 'hidden'],
            'private' => 'hidden',
        ]);
        $this->assertSame([
            'success' => true,
            'message' => 'Submitted',
            'submission' => [
                'submission_uuid' => 'synthetic-uuid',
                'email_confirmation_status' => 'requested',
                'email_confirmation_sent' => 0,
                'email_confirmation_requested_at' => '2026-10-16 09:00:00',
                'email_confirmation_sent_at' => null,
            ],
            'stats' => ['resources_processed' => 2],
        ], $complete);
    }

    public function testFacultyCommunicationsResponsePreservesVisibleThreadsOnly()
    {
        $response = FacultySubmissionPresenter::facultyCommunicationsResponse([
            'messages' => [[
                'id' => 10,
                'message' => 'Visible root',
                'sender_email' => 'private@example.test',
                'replies' => [[
                    'id' => 11,
                    'message' => 'Visible reply',
                    'sender_id' => 'private-staff-id',
                ]],
            ]],
            'internal' => 'hidden',
        ]);

        $this->assertSame([
            'messages' => [[
                'id' => 10,
                'message' => 'Visible root',
                'replies' => [[
                    'id' => 11,
                    'message' => 'Visible reply',
                ]],
            ]],
        ], $response);
    }
}
