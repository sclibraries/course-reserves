<?php

use Firebase\JWT\JWT;

/**
 * Verifies the access boundary and client-controlled fields for API-076.
 */
class Api076ControllerAccessCest extends BaseFunctionalCest
{
    private $staffUsername = 'test-api076-staff';
    private $spoofUsername = 'test-api076-spoofed-user';
    private $staffId;
    private $tokens = [];
    private $materialTypeId;
    private $materialTypeFieldId;
    private $trackingEventId;
    private $instructorId;
    private $submissionUuid = '07607607-6076-4076-8076-076076076076';
    private $unlinkedSubmissionUuid = '07607607-6076-4076-8076-076076076077';
    private $submissionItemId;
    private $unlinkedSubmissionItemId;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanupFixtures();
        $this->staffId = $this->insertUser($this->staffUsername, 'staff');
        $this->insertUser($this->spoofUsername, 'staff');
        $this->tokens = [
            'faculty' => $this->token('test-api076-faculty', 'faculty'),
            'employee' => $this->token('test-api076-employee', 'employee'),
            'staff' => $this->token($this->staffUsername, 'staff', $this->staffId),
        ];

        \Yii::$app->db->createCommand()->insert('material_types', [
            'name' => 'test-api076-material-type',
            'description' => 'Synthetic API-076 fixture',
        ])->execute();
        $this->materialTypeId = (int)\Yii::$app->db->getLastInsertID();
        \Yii::$app->db->createCommand()->insert('material_type_fields', [
            'material_type_id' => $this->materialTypeId,
            'field_name' => 'test-api076-field',
            'label' => 'Test API-076 field',
            'field_type' => 'text',
        ])->execute();
        $this->materialTypeFieldId = (int)\Yii::$app->db->getLastInsertID();

        \Yii::$app->db->createCommand()->insert('tracking_events', [
            'college' => 'SM',
            'event_type' => 'course_access',
            'course_id' => 'test-api076-course',
            'term' => 'test-api076-term',
            'course_name' => 'test-api076-course-name',
            'course_code' => 'test-api076-code',
            'instructor' => json_encode([['name' => 'test-api076-instructor']]),
        ])->execute();
        $this->trackingEventId = (int)\Yii::$app->db->getLastInsertID();

        \Yii::$app->db->createCommand()->insert('instructors', [
            'name' => 'test-api076-instructor',
        ])->execute();
        $this->instructorId = (int)\Yii::$app->db->getLastInsertID();

        TestSubmissionFixture::create($this->submissionUuid, 'test-api076-faculty', [
            'term_code' => 'test-api076-term',
            'course_code' => 'TST API076',
            'section' => '76',
            'course_title' => 'Synthetic API-076 checklist submission',
            'status' => 'submitted',
            'link_state' => 'linked',
        ]);
        $this->submissionItemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :submission_id ORDER BY id DESC LIMIT 1',
            [':submission_id' => $this->submissionId($this->submissionUuid)]
        )->queryScalar();
        TestSubmissionFixture::create($this->unlinkedSubmissionUuid, 'test-api076-unlinked-faculty', [
            'term_code' => 'test-api076-term',
            'course_code' => 'TST API076',
            'section' => '76',
            'course_title' => 'Synthetic API-076 unlinked checklist submission',
            'status' => 'submitted',
        ]);
        $this->unlinkedSubmissionItemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :submission_id ORDER BY id DESC LIMIT 1',
            [':submission_id' => $this->submissionId($this->unlinkedSubmissionUuid)]
        )->queryScalar();
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanupFixtures();
    }

    public function trackingAllowsPublicCreateButProtectsReadsWritesAndReports(FunctionalTester $I)
    {
        $validEvent = [
            'college' => 'SM',
            'event_type' => 'search',
            'course_id' => 'test-api076-public-course',
            'term' => 'test-api076-public-term',
            'course_name' => 'test-api076-public-name',
            'course_code' => 'test-api076-public-code',
            'instructor' => [['name' => 'Test Instructor']],
            'metadata' => ['query' => 'test-api076-search'],
        ];
        foreach (['anonymous', 'faculty', 'employee', 'staff'] as $role) {
            $status = $this->requestAs($I, $role, 'POST', 'tracking/create', $validEvent);
            \PHPUnit\Framework\Assert::assertSame(201, $status, 'Tracking create must remain public for ' . $role . '.');
        }

        $topCoursesStatus = $this->requestAs($I, 'anonymous', 'GET', 'tracking/top-courses');
        \PHPUnit\Framework\Assert::assertSame(200, $topCoursesStatus, 'Tracking top-courses should allow anonymous access.');
        $topCoursesResponse = $I->grabJsonResponse();
        \PHPUnit\Framework\Assert::assertSame(['topCourses'], array_keys($topCoursesResponse));
        \PHPUnit\Framework\Assert::assertCount(1, $topCoursesResponse['topCourses']);
        $topCourse = $topCoursesResponse['topCourses'][0];
        \PHPUnit\Framework\Assert::assertSame(
            ['name', 'count', 'college', 'term', 'course_id', 'instructors'],
            array_keys($topCourse),
            'Popular course rows should contain aggregate public fields only.'
        );
        \PHPUnit\Framework\Assert::assertSame(['test-api076-instructor'], $topCourse['instructors']);
        \PHPUnit\Framework\Assert::assertSame('test-api076-course', $topCourse['course_id']);
        foreach (['faculty', 'employee', 'staff'] as $role) {
            $status = $this->requestAs($I, $role, 'GET', 'tracking/top-courses');
            \PHPUnit\Framework\Assert::assertSame(200, $status, 'Tracking top-courses should allow ' . $role . '.');
        }

        $requests = [
            ['index', 'GET', 'tracking/index', [], [], 200],
            ['view', 'GET', 'tracking/view', [], ['id' => $this->trackingEventId], 200],
            ['analytics', 'GET', 'tracking/analytics', [], [], 200],
            ['course-detail', 'GET', 'tracking/course-detail', [], ['course-name' => 'test-api076-course-name'], 200],
            ['update', 'PUT', 'tracking/update', ['course_name' => 'test-api076-updated'], ['id' => $this->trackingEventId], 200],
            ['delete', 'DELETE', 'tracking/delete', [], ['id' => $this->trackingEventId], 204],
        ];
        foreach ($requests as $request) {
            list($name, $method, $route, $payload, $params, $successStatus) = $request;
            $this->assertStaffOnly($I, 'Tracking ' . $name, $method, $route, $payload, $params, $successStatus);
        }

        $I->deleteHeader('Authorization');
        $this->requestAs($I, 'anonymous', 'OPTIONS', 'tracking/options');
        $I->seeResponseCodeIs(200);
    }

    public function trackingRejectsUnknownEventsAndIgnoresClientOwnedFields(FunctionalTester $I)
    {
        $validEvent = [
            'college' => 'SM',
            'event_type' => 'course_access',
            'course_id' => 'test-api076-hardening-course',
            'term' => 'test-api076-hardening-term',
            'created_at' => '2000-01-01 00:00:00',
            'id' => 999076001,
            'user_id' => 'test-api076-forged-user',
            'timestamp' => '2000-01-01T00:00:00Z',
        ];
        $I->deleteHeader('Authorization');
        $I->sendJsonRequest('POST', 'tracking/create', $validEvent);
        $I->seeResponseCodeIs(201);
        $stored = \Yii::$app->db->createCommand(
            'SELECT * FROM tracking_events WHERE course_id = :course_id',
            [':course_id' => 'test-api076-hardening-course']
        )->queryOne();
        \PHPUnit\Framework\Assert::assertNotSame(999076001, (int)$stored['id']);
        \PHPUnit\Framework\Assert::assertNotSame('2000-01-01 00:00:00', $stored['created_at']);
        \PHPUnit\Framework\Assert::assertArrayNotHasKey('user_id', $stored);
        \PHPUnit\Framework\Assert::assertArrayNotHasKey('timestamp', $stored);

        $validEvent['course_id'] = 'test-api076-unknown-event';
        $validEvent['event_type'] = 'test-api076-forged-event';
        $I->sendJsonRequest('POST', 'tracking/create', $validEvent);
        $I->seeResponseCodeIs(422);
        \PHPUnit\Framework\Assert::assertSame(
            0,
            (int)\Yii::$app->db->createCommand(
                'SELECT COUNT(*) FROM tracking_events WHERE course_id = :course_id',
                [':course_id' => 'test-api076-unknown-event']
            )->queryScalar()
        );
    }

    public function materialTypeReadsRequireSignInAndWritesRequireStaff(FunctionalTester $I)
    {
        $reads = [
            ['index', 'GET', 'material-type/index', [], [], 200],
            ['view', 'GET', 'material-type/view', [], ['id' => $this->materialTypeId], 200],
            ['all', 'GET', 'material-type/all', [], [], 200],
            ['fields', 'GET', 'material-type/fields', [], ['material_type_id' => $this->materialTypeId], 200],
        ];
        foreach ($reads as $request) {
            list($name, $method, $route, $payload, $params, $successStatus) = $request;
            $this->assertSignedIn($I, 'MaterialType ' . $name, $method, $route, $payload, $params, $successStatus);
        }

        $this->assertStaffOnly(
            $I,
            'MaterialType create',
            'POST',
            'material-type/create',
            ['name' => 'test-api076-created-type', 'description' => 'Synthetic API-076 type'],
            [],
            201
        );
        $createdType = $I->grabJsonResponse();
        $createdTypeId = (int)$createdType['material_type_id'];
        $this->assertStaffOnly(
            $I,
            'MaterialType update',
            'PUT',
            'material-type/update',
            ['description' => 'Updated synthetic API-076 type'],
            ['id' => $createdTypeId],
            200
        );
        $this->assertStaffOnly(
            $I,
            'MaterialType delete',
            'DELETE',
            'material-type/delete',
            [],
            ['id' => $createdTypeId],
            204
        );

        $I->deleteHeader('Authorization');
        $this->requestAs($I, 'anonymous', 'OPTIONS', 'material-type/options');
        $I->seeResponseCodeIs(200);
    }

    public function unusedInstructorRestControllerIsStaffOnly(FunctionalTester $I)
    {
        $this->assertStaffOnly($I, 'Instructor index', 'GET', 'instructor/index', [], [], 200);
        $this->assertStaffOnly($I, 'Instructor view', 'GET', 'instructor/view', [], ['id' => $this->instructorId], 200);
        $this->assertStaffOnly(
            $I,
            'Instructor create',
            'POST',
            'instructor/create',
            ['name' => 'test-api076-created-instructor'],
            [],
            201
        );
        $createdInstructor = $I->grabJsonResponse();
        $createdInstructorId = (int)$createdInstructor['instructor_id'];
        $this->assertStaffOnly(
            $I,
            'Instructor update',
            'PUT',
            'instructor/update',
            ['name' => 'test-api076-updated-instructor'],
            ['id' => $createdInstructorId],
            200
        );
        $this->assertStaffOnly($I, 'Instructor delete', 'DELETE', 'instructor/delete', [], ['id' => $createdInstructorId], 204);
    }

    public function everyChecklistActionRequiresStaffAndActorFieldsUseTheToken(FunctionalTester $I)
    {
        $createPayload = [
            'name' => 'test-api076-checklist',
            'description' => 'Synthetic API-076 checklist',
            'format' => 'physical',
            'material_types' => [],
            'created_by' => $this->spoofUsername,
            'tasks' => [
                ['label' => 'test-api076-task', 'order' => 1, 'optional' => false],
            ],
        ];
        $this->assertStaffOnly($I, 'Checklist create-template', 'POST', 'checklist/create-template', $createPayload, [], 200);
        $createdTemplate = $I->grabJsonResponse();
        $templateId = (int)$createdTemplate['id'];
        \PHPUnit\Framework\Assert::assertSame((int)$this->staffId, (int)$createdTemplate['created_by']);

        $this->assertStaffOnly($I, 'Checklist list-templates', 'GET', 'checklist/list-templates', [], [], 200);
        $this->assertStaffOnly($I, 'Checklist get-template', 'GET', 'checklist/get-template', [], ['id' => $templateId], 200);
        $this->assertStaffOnly(
            $I,
            'Checklist update-template',
            'PUT',
            'checklist/update-template',
            [
                'name' => 'test-api076-checklist-updated',
                'format' => 'physical',
                'material_types' => [],
                'tasks' => [['label' => 'test-api076-task', 'order' => 1, 'optional' => false]],
            ],
            ['id' => $templateId],
            200
        );
        $this->assertStaffOnly($I, 'Checklist duplicate-template', 'POST', 'checklist/duplicate-template', [], ['id' => $templateId], 200);

        $unlinkedStatus = $this->requestAs(
            $I,
            'staff',
            'POST',
            'checklist/assign-checklist',
            ['template_id' => $templateId],
            ['itemId' => $this->unlinkedSubmissionItemId]
        );
        \PHPUnit\Framework\Assert::assertSame(409, $unlinkedStatus);
        \PHPUnit\Framework\Assert::assertSame('submission_not_linked', $I->grabJsonResponse()['error_code']);

        $this->assertStaffOnly(
            $I,
            'Checklist assign-checklist',
            'POST',
            'checklist/assign-checklist',
            ['template_id' => $templateId, 'assigned_by' => $this->spoofUsername],
            ['itemId' => $this->submissionItemId],
            200
        );
        $assignedChecklistId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM item_checklists WHERE submission_item_id = :item_id',
            [':item_id' => $this->submissionItemId]
        )->queryScalar();
        \PHPUnit\Framework\Assert::assertSame(
            (string)$this->staffId,
            (string)\Yii::$app->db->createCommand(
                'SELECT assigned_by FROM item_checklists WHERE id = :id',
                [':id' => $assignedChecklistId]
            )->queryScalar()
        );
        $taskId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM item_checklist_tasks WHERE item_checklist_id = :checklist_id',
            [':checklist_id' => $assignedChecklistId]
        )->queryScalar();

        $this->assertStaffOnly(
            $I,
            'Checklist get-item-checklist',
            'GET',
            'checklist/get-item-checklist',
            [],
            ['itemId' => $this->submissionItemId],
            200
        );
        $this->assertStaffOnly(
            $I,
            'Checklist update-task',
            'PATCH',
            'checklist/update-task',
            ['completed' => true, 'completed_by' => 'test-api076-forged-completer'],
            ['itemId' => $this->submissionItemId, 'taskId' => $taskId],
            200
        );
        \PHPUnit\Framework\Assert::assertSame(
            (string)$this->staffId,
            (string)\Yii::$app->db->createCommand(
                'SELECT completed_by FROM item_checklist_tasks WHERE id = :id',
                [':id' => $taskId]
            )->queryScalar()
        );
        \PHPUnit\Framework\Assert::assertSame(
            1,
            (int)\Yii::$app->db->createCommand(
                'SELECT completed FROM item_checklist_tasks WHERE id = :id',
                [':id' => $taskId]
            )->queryScalar()
        );
        $this->assertStaffOnly(
            $I,
            'Checklist complete-checklist',
            'POST',
            'checklist/complete-checklist',
            ['completed_by' => 'test-api076-forged-completer'],
            ['itemId' => $this->submissionItemId],
            200
        );
        \PHPUnit\Framework\Assert::assertSame(
            (string)$this->staffId,
            (string)\Yii::$app->db->createCommand(
                'SELECT completed_by FROM item_checklists WHERE id = :id',
                [':id' => $assignedChecklistId]
            )->queryScalar()
        );

        $this->assertStaffOnly(
            $I,
            'Checklist delete-template',
            'DELETE',
            'checklist/delete-template',
            [],
            ['id' => $templateId],
            200
        );
        $I->deleteHeader('Authorization');
        $this->requestAs($I, 'anonymous', 'OPTIONS', 'checklist/options');
        $I->seeResponseCodeIs(200);
    }

    private function assertStaffOnly(FunctionalTester $I, $name, $method, $route, array $payload, array $params, $staffStatus)
    {
        \PHPUnit\Framework\Assert::assertSame(401, $this->requestAs($I, 'anonymous', $method, $route, $payload, $params), $name . ' should reject anonymous access.');
        \PHPUnit\Framework\Assert::assertSame(403, $this->requestAs($I, 'faculty', $method, $route, $payload, $params), $name . ' should reject faculty.');
        \PHPUnit\Framework\Assert::assertSame(403, $this->requestAs($I, 'employee', $method, $route, $payload, $params), $name . ' should reject employees.');
        $staffResult = $this->requestAs($I, 'staff', $method, $route, $payload, $params);
        \PHPUnit\Framework\Assert::assertSame($staffStatus, $staffResult, $name . ' should allow staff. Response: ' . $I->grabPageSource());
    }

    private function assertSignedIn(FunctionalTester $I, $name, $method, $route, array $payload, array $params, $successStatus)
    {
        \PHPUnit\Framework\Assert::assertSame(401, $this->requestAs($I, 'anonymous', $method, $route, $payload, $params), $name . ' should reject anonymous access.');
        foreach (['faculty', 'employee', 'staff'] as $role) {
            \PHPUnit\Framework\Assert::assertSame($successStatus, $this->requestAs($I, $role, $method, $route, $payload, $params), $name . ' should allow ' . $role . '.');
        }
    }

    private function requestAs(FunctionalTester $I, $role, $method, $route, array $payload = [], array $params = [])
    {
        $I->deleteHeader('Authorization');
        if ($role !== 'anonymous') {
            $I->haveHttpHeader('Authorization', 'Bearer ' . $this->tokens[$role]);
        }
        return $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function token($username, $role, $id = null)
    {
        $issuedAt = time();
        return JWT::encode([
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $id === null ? $username : $id,
            'full_name' => 'Test API-076 ' . ucfirst($role),
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function submissionId($uuid)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryScalar();
    }

    private function insertUser($username, $role)
    {
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $username,
            'full_name' => 'Test API-076 ' . $role,
            'email' => $username . '@example.test',
            'role' => $role,
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function cleanupFixtures()
    {
        TestSubmissionFixture::delete($this->unlinkedSubmissionUuid);
        \Yii::$app->db->createCommand()->delete('faculty_submissions', ['submission_uuid' => $this->submissionUuid])->execute();
        \Yii::$app->db->createCommand()->delete('checklist_templates', ['like', 'name', 'test-api076-%', false])->execute();
        \Yii::$app->db->createCommand()->delete('tracking_events', ['like', 'course_id', 'test-api076-%', false])->execute();
        \Yii::$app->db->createCommand()->delete('material_types', ['like', 'name', 'test-api076-%', false])->execute();
        \Yii::$app->db->createCommand()->delete('instructors', ['like', 'name', 'test-api076-%', false])->execute();
        \Yii::$app->db->createCommand()->delete('users', ['username' => [$this->staffUsername, $this->spoofUsername]])->execute();
    }
}
