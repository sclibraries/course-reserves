<?php

use app\services\FolioService;
use Firebase\JWT\JWT;

class FacultySubmissionFieldsCest extends BaseFunctionalCest
{
    private $ownerId = 'test-api077-faculty';
    private $proxyId = 'test-api077-proxy';
    private $coInstructorId = 'test-api077-co-instructor';
    private $ownerInternalId = '999007707';
    private $coInstructorInternalId = '999007708';
    private $submissionUuid = '77000000-0000-4000-8000-000000000077';
    private $courseCode = 'TST 077';
    private $listingId = 'test-api077-course-listing';
    private $submissionId;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        \Yii::$container->set(FolioService::class, new TestApi077FolioService());
        $this->insertRosterAssignment($this->ownerInternalId, 'TST-077-77-209909');
        $this->insertRosterAssignment($this->ownerInternalId, 'TST-078-78-209909');
        $this->insertRosterAssignment($this->ownerInternalId, 'TST-079-79-209909');
        $this->insertRosterAssignment($this->coInstructorInternalId, 'TST-077-77-209909');

        \Yii::$app->db->createCommand()->insert('faculty_submissions', [
            'submission_uuid' => $this->submissionUuid,
            'shibboleth_user_id' => $this->ownerId,
            'term_code' => 'Fall 2099',
            'course_code' => $this->courseCode,
            'section' => '77',
            'course_title' => 'Synthetic API-077 privacy course',
            'folio_course_listing_id' => $this->listingId,
            'faculty_display_name' => 'Test API077 Faculty',
            'status' => 'draft',
        ])->execute();
        $this->submissionId = (int) \Yii::$app->db->getLastInsertID();

        \Yii::$app->db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $this->submissionId,
            'resource_data' => json_encode(['title' => 'Synthetic API-077 item', 'materialType' => 'book']),
            'staff_notes' => 'test-internal-item-note',
            'claimed_by_staff_id' => 'test-api077-staff',
            'claimed_at' => date('Y-m-d H:i:s'),
            'item_status' => 'pending',
        ])->execute();

        \Yii::$app->db->createCommand()->insert('submission_workflow_assignments', [
            'submission_id' => $this->submissionId,
            'assigned_staff_user_id' => 'test-api077-staff',
            'assignment_type' => 'full_course',
            'staff_notes' => 'test-internal-assignment-note',
        ])->execute();

        \Yii::$app->db->createCommand()->insert('faculty_proxy_permissions', [
            'faculty_shibboleth_id' => $this->ownerId,
            'proxy_shibboleth_id' => $this->proxyId,
            'faculty_display_name' => 'Test API077 Faculty',
            'proxy_display_name' => 'Test API077 Proxy',
            'proxy_email' => $this->proxyId . '@example.test',
            'permission_type' => 'full_access',
            'status' => 'active',
        ])->execute();
    }

    public function _after(FunctionalTester $I)
    {
        \Yii::$app->db->createCommand()->delete('faculty_submissions', [
            'shibboleth_user_id' => $this->ownerId,
        ])->execute();
        \Yii::$app->db->createCommand()->delete('faculty_proxy_permissions', [
            'faculty_shibboleth_id' => $this->ownerId,
        ])->execute();
        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => [$this->ownerInternalId, $this->coInstructorInternalId],
        ])->execute();
        \Yii::$container->clear(FolioService::class);
    }

    public function everyFacultySubmissionDataEndpointUsesTheFacultyShape(FunctionalTester $I)
    {
        $responses = [];
        $indexUrl = \Yii::$app->urlManager->createUrl(['faculty-submission/index']);
        $responses['index'] = $this->request($I, $this->ownerToken(), 'GET', $indexUrl);
        $viewUrl = \Yii::$app->urlManager->createUrl([
            'faculty-submission/view',
            'id' => $this->submissionUuid,
        ]);
        $responses['view'] = $this->request($I, $this->ownerToken(), 'GET', $viewUrl);
        $responses['status'] = $this->request(
            $I,
            $this->ownerToken(),
            'GET',
            \Yii::$app->urlManager->createUrl(['faculty-submission/status', 'id' => $this->submissionUuid])
        );
        $responses['update'] = $this->request(
            $I,
            $this->ownerToken(),
            'PUT',
            \Yii::$app->urlManager->createUrl([
                'faculty-submission/update',
                'id' => $this->submissionUuid,
            ]),
            ['submission_notes' => 'Synthetic API-077 update', 'draft_version' => 0]
        );
        $responses['add-new-resource'] = $this->request(
            $I,
            $this->ownerToken(),
            'POST',
            \Yii::$app->urlManager->createUrl([
                'faculty-submission/add-new-resource',
                'id' => $this->submissionId,
            ]),
            [
                'material_type_id' => 1,
                'resource_data' => ['title' => 'Synthetic API-077 added item'],
            ]
        );
        $responses['add-reuse-resource'] = $this->request(
            $I,
            $this->ownerToken(),
            'POST',
            \Yii::$app->urlManager->createUrl([
                'faculty-submission/add-reuse-resource',
                'id' => $this->submissionId,
            ]),
            ['source_resource_id' => 1]
        );
        $responses['create'] = $this->request(
            $I,
            $this->ownerToken(),
            'POST',
            \Yii::$app->urlManager->createUrl(['faculty-submission/create']),
            [
            'term_code' => 'Fall 2099',
            'course_code' => 'TST 078',
            'course_title' => 'Synthetic API-077 create course',
            'section' => '78',
            ]
        );
        $responses['submit-complete'] = $this->request(
            $I,
            $this->ownerToken(),
            'POST',
            \Yii::$app->urlManager->createUrl(['faculty-submission/submit-complete']),
            [
                'its_course_id' => 'TST-079-79-209909',
                'academic_period' => 'AP_209909',
                'courseInfo' => [
                    'courseCode' => 'TST 079',
                    'courseTitle' => 'Synthetic API-077 submit course',
                    'term' => 'Fall 2099',
                    'section' => '79',
                    'instructors' => 'Test API077 Faculty',
                ],
                'resources' => [[
                    'resource_data' => ['title' => 'Synthetic API-077 submitted item', 'materialType' => 'book'],
                ]],
                'folders' => [],
                'metadata' => [],
            ]
        );

        $responses['proxy-index'] = $this->request($I, $this->proxyToken(), 'GET', $indexUrl);
        $responses['proxy-view'] = $this->request(
            $I,
            $this->proxyToken(),
            'GET',
            $viewUrl
        );
        $responses['co-instructor-index'] = $this->request($I, $this->coInstructorToken(), 'GET', $indexUrl);
        $responses['co-instructor-view'] = $this->request(
            $I,
            $this->coInstructorToken(),
            'GET',
            $viewUrl
        );

        $this->assertListIncludesSubmission($responses['index']);
        $this->assertListIncludesSubmission($responses['proxy-index']);
        $this->assertListIncludesSubmission($responses['co-instructor-index']);
        foreach (['view', 'proxy-view', 'co-instructor-view'] as $endpoint) {
            \PHPUnit\Framework\Assert::assertSame(
                $this->submissionUuid,
                $responses[$endpoint]['submission_uuid'] ?? null,
                $endpoint . ' did not return the seeded submission: ' . json_encode($responses[$endpoint])
            );
        }
        \PHPUnit\Framework\Assert::assertSame(1, $responses['update']['draft_version'] ?? null);
        \PHPUnit\Framework\Assert::assertTrue($responses['submit-complete']['success'] ?? false);

        $leaks = [];
        foreach ($responses as $endpoint => $response) {
            $fields = $this->internalFieldNames($response);
            $sentinels = $this->sentinelValues($response);
            if ($fields || $sentinels) {
                $leaks[$endpoint] = [
                    'internal_fields' => $fields,
                    'sentinel_values' => $sentinels,
                ];
            }
        }

        \PHPUnit\Framework\Assert::assertSame(
            [],
            $leaks,
            'Faculty responses exposed staff or internal fields: ' . json_encode($leaks)
        );
    }

    public function submittedEdsIdentitySurvivesFacultyAndStaffViews(FunctionalTester $I)
    {
        $edsFields = [
            'doi' => '10.1000/cx028',
            'issn' => '1234-5678',
            'journalTitle' => 'Synthetic Journal of Test Data',
            'volume' => '12',
            'issue' => '3',
            'eds' => [
                'dbId' => 'synthetic-database',
                'an' => 'synthetic-an',
                'plink' => 'https://search.ebscohost.com/record/synthetic-cx028',
            ],
        ];
        $resourceData = array_merge($edsFields, [
            'title' => 'Synthetic EDS article',
            'authors' => 'Test Author',
            'materialType' => 'article',
        ]);
        $this->request(
            $I,
            $this->ownerToken(),
            'POST',
            \Yii::$app->urlManager->createUrl(['faculty-submission/submit-complete']),
            [
                'its_course_id' => 'TST-079-79-209909',
                'academic_period' => 'AP_209909',
                'courseInfo' => [
                    'courseCode' => 'TST 079',
                    'courseTitle' => 'Synthetic EDS course',
                    'term' => 'Fall 2099',
                    'section' => '79',
                    'instructors' => 'Test API077 Faculty',
                ],
                'resources' => [[
                    'resource_data' => $resourceData,
                ]],
                'folders' => [],
                'metadata' => [],
            ]
        );

        $submission = \Yii::$app->db->createCommand(
            'SELECT submission_id, submission_uuid FROM faculty_submissions '
            . 'WHERE its_course_id = :course_id AND shibboleth_user_id = :owner_id',
            [':course_id' => 'TST-079-79-209909', ':owner_id' => $this->ownerId]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertIsArray($submission);

        $index = $this->request(
            $I,
            $this->ownerToken(),
            'GET',
            \Yii::$app->urlManager->createUrl(['faculty-submission/index'])
        );
        $indexedSubmission = null;
        foreach ($index['items'] as $item) {
            if ($item['submission_uuid'] === $submission['submission_uuid']) {
                $indexedSubmission = $item;
                break;
            }
        }
        \PHPUnit\Framework\Assert::assertIsArray($indexedSubmission);
        $this->assertEdsIdentity($edsFields, $indexedSubmission['unfoldered_items'][0]);

        $facultyView = $this->request(
            $I,
            $this->ownerToken(),
            'GET',
            \Yii::$app->urlManager->createUrl([
                'faculty-submission/view',
                'id' => $submission['submission_uuid'],
            ])
        );
        $this->assertEdsIdentity($edsFields, $facultyView['newResources'][0]);

        $staffView = $this->request(
            $I,
            $this->token('test-api077-staff', 'staff'),
            'GET',
            \Yii::$app->urlManager->createUrl([
                'submission-workflow/view-submission',
                'id' => $submission['submission_id'],
            ])
        );
        $this->assertEdsIdentity($edsFields, $staffView['newResources'][0]);
    }

    private function assertEdsIdentity(array $expected, array $resource)
    {
        $resourceData = $resource['resource_data'] ?? null;
        if (is_string($resourceData)) {
            $resourceData = json_decode($resourceData, true);
        }
        \PHPUnit\Framework\Assert::assertIsArray($resourceData);
        foreach ($expected as $key => $value) {
            \PHPUnit\Framework\Assert::assertSame($value, $resourceData[$key] ?? null, $key . ' changed in resource_data');
        }
    }

    private function request(FunctionalTester $I, $token, $method, $url, array $body = null)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        if ($body === null) {
            $I->sendAjaxRequest($method, $url);
        } else {
            $I->sendAjaxRequest($method, $url, $body);
        }
        $I->seeResponseCodeIs(200);
        $response = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertIsArray($response, 'Expected JSON array response from ' . $url);
        return $response;
    }

    private function assertListIncludesSubmission(array $response)
    {
        \PHPUnit\Framework\Assert::assertArrayHasKey('items', $response, 'Submission index response shape changed');
        $uuids = array_column($response['items'], 'submission_uuid');
        \PHPUnit\Framework\Assert::assertContains(
            $this->submissionUuid,
            $uuids,
            'Submission index did not return the seeded submission: ' . json_encode($response)
        );
    }

    private function internalFieldNames($value)
    {
        $internalFields = [
            'staff_notes', 'claimed_by_staff_id', 'claimed_at', 'workflowAssignment',
            'assignment_id', 'assignment_type', 'assigned_staff_user_id', 'assignee',
            'assignee_staff_user_id', 'materialized_resource_id', 'materialized_course_resource_id',
            'materialized_physical_reference_id', 'materialized_folder_id', 'materialized_at',
            'materialized_by_staff_id', 'submission_id', 'shibboleth_user_id',
            'proxy_shibboleth_user_id', 'internal_note', 'email_confirmation_error',
            'email_confirmation_error_at', 'email_confirmation_queued_at', 'email_confirmation_failed_at',
            'email_confirmation_legacy_sent', 'submitted_by_user_id', 'submitted_by_username',
            'submitted_by_full_name', 'submitted_by_email', 'submitted_by_institution', 'raw_payload',
        ];
        $fields = [];
        if (!is_array($value)) {
            return $fields;
        }
        foreach ($value as $key => $child) {
            if (in_array($key, $internalFields, true)) {
                $fields[] = $key;
            }
            $fields = array_merge($fields, $this->internalFieldNames($child));
        }
        return array_values(array_unique($fields));
    }

    private function sentinelValues($value)
    {
        $sentinelValues = [
            'test-internal-item-note',
            'test-internal-assignment-note',
            'test-api077-staff',
        ];
        $found = [];
        if (!is_array($value)) {
            return in_array($value, $sentinelValues, true) ? [$value] : $found;
        }
        foreach ($value as $child) {
            $found = array_merge($found, $this->sentinelValues($child));
        }
        return array_values(array_unique($found));
    }

    private function ownerToken()
    {
        return $this->token($this->ownerId, 'faculty', $this->ownerInternalId);
    }

    private function proxyToken()
    {
        return $this->token($this->proxyId, 'employee');
    }

    private function coInstructorToken()
    {
        return $this->token($this->coInstructorId, 'faculty', $this->coInstructorInternalId);
    }

    private function token($username, $role, $internalId = null)
    {
        $payload = [
            'iat' => time(),
            'exp' => time() + 3600,
            'username' => $username,
            'id' => $username,
            'role' => $role,
            'full_name' => 'Test API077 User',
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ];
        if ($internalId !== null) {
            $payload['internal_id'] = $internalId;
        }
        return JWT::encode($payload, getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertRosterAssignment($smithId, $courseId)
    {
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => 'AP_209909',
            'course_id' => $courseId,
            'course_title' => 'Synthetic API-077 roster course',
            'smith_id' => $smithId,
            'role' => 'Instructor',
        ])->execute();
    }
}

class TestApi077FolioService
{
    public function searchTerms()
    {
        return [[
            'id' => 'test-api077-term',
            'name' => 'Fall 2099',
            'startDate' => '2099-08-01',
            'endDate' => '2099-12-31',
        ]];
    }

    public function searchCourses($query)
    {
        return null;
    }
}
