<?php

use PHPUnit\Framework\Assert;
use app\services\FolioService;

/** Exercises the server-side faculty draft lifecycle. */
class Api086DraftsCest extends BaseFunctionalCest
{
    private $ownerId = 'test-api086-faculty';
    private $ownerSmithId = '999086001';
    private $coInstructorSmithId = '999086002';
    private $courseId = 'TST-086-01';
    private $academicPeriod = 'AP_209902';
    private $token;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        \Yii::$container->set(FolioService::class, new TestApi086FolioService());
        $this->cleanupFixtures();
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => $this->academicPeriod,
            'course_id' => $this->courseId,
            'course_title' => 'Synthetic API-086 roster course',
            'smith_id' => $this->ownerSmithId,
            'role' => 'Instructor',
        ])->execute();
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => $this->academicPeriod,
            'course_id' => $this->courseId,
            'course_title' => 'Synthetic API-086 roster course',
            'smith_id' => $this->coInstructorSmithId,
            'role' => 'Instructor',
        ])->execute();
        $this->token = $this->token($this->ownerId, 'faculty', $this->ownerSmithId);
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanupFixtures();
        \Yii::$container->clear(FolioService::class);
    }

    public function firstDraftSaveCreatesOneServerRowAndRepeatReturnsIt(FunctionalTester $I)
    {
        $payload = $this->draftPayload();
        $this->postDraft($I, $payload);

        $created = $this->response($I);
        Assert::assertArrayHasKey('submission_uuid', $created, json_encode($created));
        $I->seeResponseCodeIs(201);
        Assert::assertSame('draft', $created['status']);
        Assert::assertSame(1, $created['draft_version']);
        Assert::assertNotEmpty($created['submission_uuid']);

        $submission = \Yii::$app->db->createCommand(
            'SELECT submission_id, status, draft_version, email_confirmation_status, email_confirmation_requested_at '
            . 'FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $created['submission_uuid']]
        )->queryOne();
        Assert::assertSame('draft', $submission['status']);
        Assert::assertSame(1, (int)$submission['draft_version']);
        Assert::assertSame('not_requested', $submission['email_confirmation_status']);
        Assert::assertNull($submission['email_confirmation_requested_at']);
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM submission_new_resources WHERE submission_id = :id',
            [':id' => $submission['submission_id']]
        )->queryScalar());
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM submission_folders WHERE submission_id = :id',
            [':id' => $submission['submission_id']]
        )->queryScalar());
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :id',
            [':id' => $submission['submission_id']]
        )->queryScalar());
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM submission_communications WHERE submission_id = :id',
            [':id' => $submission['submission_id']]
        )->queryScalar());

        $this->postDraft($I, $payload);
        $I->seeResponseCodeIs(200);
        $existing = $this->response($I);
        Assert::assertTrue($existing['existing']);
        Assert::assertSame($created['submission_uuid'], $existing['submission_uuid']);
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM faculty_submissions WHERE shibboleth_user_id = :owner '
            . 'AND its_course_id = :course AND academic_period = :period',
            [':owner' => $this->ownerId, ':course' => $this->courseId, ':period' => $this->academicPeriod]
        )->queryScalar());
    }

    public function draftSaveUsesVersionAndRejectsStaleWrites(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $updated = $this->draftPayload();
        $updated['draft_version'] = 1;
        $updated['resources'][0]['resource_data']['title'] = 'Updated API-086 draft item';
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $updated, ['id' => $uuid]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(2, $this->response($I)['draft_version']);

        $updated['resources'][0]['resource_data']['title'] = 'Stale API-086 draft item';
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $updated, ['id' => $uuid]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('draft_conflict', $this->response($I)['error_code']);
        Assert::assertSame(2, $this->response($I)['draft_version']);
        $savedTitle = \Yii::$app->db->createCommand(
            'SELECT resource_data FROM submission_new_resources WHERE submission_id = '
            . '(SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid)',
            [':uuid' => $uuid]
        )->queryScalar();
        Assert::assertSame('Updated API-086 draft item', json_decode($savedTitle, true)['title']);
    }

    public function draftPutNormalizesLinksWithSpacesAndAccents(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $updated = $this->draftPayload();
        $updated['draft_version'] = 1;
        $updated['resources'][0]['resource_data']['url'] = 'https://example.org/a b';
        $updated['resources'][] = [
            'resource_data' => [
                'title' => 'Synthetic accented URL item',
                'url' => 'https://example.org/café',
                'materialType' => 'book',
            ],
            'display_order' => 1,
        ];

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $updated, ['id' => $uuid]);
        $I->seeResponseCodeIs(200);

        $resources = $this->storedResourceData($uuid);
        Assert::assertSame('https://example.org/a%20b', $resources[0]['url']);
        Assert::assertSame('https://example.org/caf%C3%A9', $resources[1]['url']);
    }

    public function draftPutPreservesInvalidUrlAndDoesNotRequireItemTitle(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $updated = $this->draftPayload();
        $updated['draft_version'] = 1;
        $updated['resources'][0]['resource_data'] = ['url' => 'not a url'];

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $updated, ['id' => $uuid]);
        $I->seeResponseCodeIs(200);

        Assert::assertSame('not a url', $this->storedResourceData($uuid)[0]['url']);
    }

    public function draftSaveRejectsMalformedResourceListsAndMissingCourseFields(FunctionalTester $I)
    {
        $malformed = $this->draftPayload();
        $malformed['resources'] = 'not an array';
        $this->postDraft($I, $malformed);
        $I->seeResponseCodeIs(400);

        $malformed['resources'] = null;
        $this->postDraft($I, $malformed);
        $I->seeResponseCodeIs(400);

        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $updated = $this->draftPayload();
        $updated['draft_version'] = 1;
        $updated['resources'] = 'not an array';
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $updated, ['id' => $uuid]);
        $I->seeResponseCodeIs(400);

        $updated['resources'] = null;
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $updated, ['id' => $uuid]);
        $I->seeResponseCodeIs(400);

        $updated = $this->draftPayload();
        $updated['draft_version'] = 1;
        $updated['courseInfo']['term'] = '';
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $updated, ['id' => $uuid]);
        $I->seeResponseCodeIs(400);
    }

    public function submitCompleteRejectsInvalidUrlAndNormalizesAcceptedUrl(FunctionalTester $I)
    {
        $invalid = $this->draftPayload();
        $invalid['resources'][0]['resource_data']['url'] = 'not a url';
        $this->postComplete($I, $invalid);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('Resource 0 has an invalid URL', $this->response($I)['message']);

        $valid = $this->draftPayload();
        $valid['resources'][0]['resource_data']['url'] = 'https://example.org/a b';
        $this->postComplete($I, $valid);
        $I->seeResponseCodeIs(200);
        $uuid = \Yii::$app->db->createCommand(
            'SELECT submission_uuid FROM faculty_submissions WHERE shibboleth_user_id = :owner '
            . 'AND its_course_id = :course AND academic_period = :period',
            [':owner' => $this->ownerId, ':course' => $this->courseId, ':period' => $this->academicPeriod]
        )->queryScalar();
        Assert::assertSame('https://example.org/a%20b', $this->storedResourceData($uuid)[0]['url']);
    }

    public function draftSubmitRejectsAnInvalidUrlSavedDuringDrafting(FunctionalTester $I)
    {
        $payload = $this->draftPayload();
        $payload['resources'][0]['resource_data']['url'] = 'not a url';
        $this->postDraft($I, $payload);
        $I->seeResponseCodeIs(201);
        $uuid = $this->response($I)['submission_uuid'];

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('POST', 'faculty-submission/submit', [], ['id' => $uuid]);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('Resource 0 has an invalid URL', $this->response($I)['message']);
    }

    public function submittedPutValidatesAndNormalizesResourceUrls(FunctionalTester $I)
    {
        $this->postComplete($I, $this->draftPayload());
        $uuid = \Yii::$app->db->createCommand(
            'SELECT submission_uuid FROM faculty_submissions WHERE shibboleth_user_id = :owner '
            . 'AND its_course_id = :course AND academic_period = :period',
            [':owner' => $this->ownerId, ':course' => $this->courseId, ':period' => $this->academicPeriod]
        )->queryScalar();
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = '
            . '(SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid)',
            [':uuid' => $uuid]
        )->queryScalar();
        $items = [[
            'id' => $itemId,
            'title' => 'Synthetic API-089 submitted item',
            'url' => 'not a url',
            'display_order' => 0,
        ]];

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', ['items' => $items], ['id' => $uuid]);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('Resource 0 has an invalid URL', $this->response($I)['message']);

        $items[0]['url'] = 'https://example.org/a b';
        $I->sendJsonRequest('PUT', 'faculty-submission/update', ['items' => $items], ['id' => $uuid]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('https://example.org/a%20b', $this->storedResourceData($uuid)[0]['url']);
    }

    public function submitPromotesDraftWithoutCreatingAnotherRow(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('POST', 'faculty-submission/submit', [], ['id' => $uuid]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('submitted', $this->response($I)['status']);
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM faculty_submissions WHERE submission_uuid = :uuid AND status = "submitted"',
            [':uuid' => $uuid]
        )->queryScalar());
    }

    public function submitCompletePromotesExistingDraft(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $this->postComplete($I, $this->draftPayload());
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM faculty_submissions WHERE shibboleth_user_id = :owner '
            . 'AND its_course_id = :course AND academic_period = :period',
            [':owner' => $this->ownerId, ':course' => $this->courseId, ':period' => $this->academicPeriod]
        )->queryScalar());
        Assert::assertSame('submitted', \Yii::$app->db->createCommand(
            'SELECT status FROM faculty_submissions WHERE submission_uuid = :uuid', [':uuid' => $uuid]
        )->queryScalar());
    }

    public function rosteredCoInstructorCanSubmitOwnersDraft(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $coInstructorToken = $this->token(
            'test-api086-co-instructor', 'faculty', $this->coInstructorSmithId
        );
        $I->haveHttpHeader('Authorization', 'Bearer ' . $coInstructorToken);
        $I->sendJsonRequest('POST', 'faculty-submission/submit', [], ['id' => $uuid]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('submitted', $this->response($I)['status']);
        Assert::assertSame($this->ownerId, \Yii::$app->db->createCommand(
            'SELECT shibboleth_user_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryScalar());
    }

    public function ownerCanDeleteOnlyDrafts(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('DELETE', 'faculty-draft/delete', [], ['id' => $uuid]);
        $I->seeResponseCodeIs(204);
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM faculty_submissions WHERE submission_uuid = :uuid', [':uuid' => $uuid]
        )->queryScalar());

        $this->postComplete($I, $this->draftPayload());
        $submittedUuid = \Yii::$app->db->createCommand(
            'SELECT submission_uuid FROM faculty_submissions WHERE shibboleth_user_id = :owner '
            . 'AND its_course_id = :course AND academic_period = :period',
            [':owner' => $this->ownerId, ':course' => $this->courseId, ':period' => $this->academicPeriod]
        )->queryScalar();
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('DELETE', 'faculty-draft/delete', [], ['id' => $submittedUuid]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('not_a_draft', $this->response($I)['error_code']);
    }

    public function facultyIndexListsDraftVersion(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('GET', 'faculty-submission/index');
        $I->seeResponseCodeIs(200);
        $items = $this->response($I)['items'];
        $draft = current(array_filter($items, function ($item) use ($uuid) {
            return $item['submission_uuid'] === $uuid;
        }));
        Assert::assertSame('draft', $draft['status']);
        Assert::assertSame(1, (int)$draft['draft_version']);
    }

    public function proxyCanEditDraftButStaffWorkflowTreatsItAsReadOnly(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $submissionId = (int)\Yii::$app->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid', [':uuid' => $uuid]
        )->queryScalar();
        \Yii::$app->db->createCommand()->insert('faculty_proxy_permissions', [
            'faculty_shibboleth_id' => $this->ownerId,
            'proxy_shibboleth_id' => 'test-api086-proxy',
            'permission_type' => \app\models\FacultyProxyPermission::PERMISSION_FULL_ACCESS,
            'status' => \app\models\FacultyProxyPermission::STATUS_ACTIVE,
        ])->execute();

        $proxyToken = $this->token('test-api086-proxy', 'faculty');
        $payload = $this->draftPayload();
        $payload['draft_version'] = 1;
        $payload['resources'][0]['resource_data']['title'] = 'Proxy updated API-086 item';
        $I->haveHttpHeader('Authorization', 'Bearer ' . $proxyToken);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $payload, ['id' => $uuid]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(2, $this->response($I)['draft_version']);

        $staffToken = $this->token('test-api086-staff', 'staff');
        $I->haveHttpHeader('Authorization', 'Bearer ' . $staffToken);
        $I->sendJsonRequest('GET', 'submission-workflow/pending-submissions');
        $I->seeResponseCodeIs(200);
        $staffList = $this->response($I);
        $listed = isset($staffList['items']) ? $staffList['items'] : $staffList;
        $listedDraft = current(array_filter($listed, function ($item) use ($uuid) {
            return ($item['submission_uuid'] ?? null) === $uuid;
        }));
        Assert::assertSame('draft', $listedDraft['status']);
        Assert::assertTrue($listedDraft['read_only']);
        Assert::assertSame('Draft - not submitted yet', $listedDraft['status_label']);

        $I->sendJsonRequest('POST', 'submission-workflow/assign-submission', [
            'submission_id' => $submissionId,
            'assigned_staff_user_id' => 1,
        ]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('submission_not_submitted', $this->response($I)['error_code']);
    }

    public function draftNeverAppearsInStaffQueuesAndClaimOrFlowIsRefused(FunctionalTester $I)
    {
        $this->postDraft($I, $this->draftPayload());
        $uuid = $this->response($I)['submission_uuid'];
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = '
            . '(SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid)',
            [':uuid' => $uuid]
        )->queryScalar();
        $staffToken = $this->token('test-api086-staff', 'staff');
        $I->haveHttpHeader('Authorization', 'Bearer ' . $staffToken);
        $I->sendJsonRequest('GET', 'workflow-link/needs-linking');
        $I->seeResponseCodeIs(200);
        Assert::assertSame(0, $this->response($I)['count']);

        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'link_state' => 'linked',
            'folio_course_listing_id' => 'synthetic-api086-listing',
        ], ['submission_uuid' => $uuid])->execute();
        $I->sendJsonRequest('GET', 'workflow-claim/queue');
        $I->seeResponseCodeIs(200);
        $queuedIds = array_column($this->response($I)['items'], 'id');
        Assert::assertNotContains($itemId, $queuedIds);

        $I->sendJsonRequest('POST', 'workflow-claim/claim', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('submission_not_submitted', $this->response($I)['error_code']);
        $I->sendJsonRequest('POST', 'workflow-link/link', [
            'folio_course_listing_id' => 'synthetic-api086-listing',
        ], ['uuid' => $uuid]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('submission_not_submitted', $this->response($I)['error_code']);
        $I->sendJsonRequest('GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('submission_not_submitted', $this->response($I)['error_code']);
    }

    public function postDraftRequiresLogin(FunctionalTester $I)
    {
        $I->sendJsonRequest('POST', 'faculty-draft/create', $this->draftPayload());
        $I->seeResponseCodeIs(401);
    }

    private function draftPayload()
    {
        return [
            'its_course_id' => $this->courseId,
            'academic_period' => $this->academicPeriod,
            'courseInfo' => [
                'courseCode' => 'TST 086',
                'courseTitle' => 'Synthetic API-086 draft course',
                'section' => '01',
                'term' => 'Fall 2099',
                'instructors' => 'Synthetic API-086 Faculty',
            ],
            'resources' => [[
                'resource_data' => ['title' => 'Synthetic API-086 draft item', 'materialType' => 'book'],
                'display_order' => 0,
                'folder_name' => 'Draft readings',
            ]],
            'folders' => [['id' => 'folder-api086', 'title' => 'Draft readings']],
            'displayOrder' => [['id' => 'folder-api086', 'displayPosition' => 0]],
            'metadata' => [
                'emailConfirmation' => true,
                'submittedBy' => ['fullName' => 'Synthetic API-086 Faculty'],
            ],
        ];
    }

    private function postDraft(FunctionalTester $I, array $payload)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('POST', 'faculty-draft/create', $payload);
    }

    private function postComplete(FunctionalTester $I, array $payload)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('POST', 'faculty-submission/submit-complete', $payload);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function storedResourceData($uuid)
    {
        $rows = \Yii::$app->db->createCommand(
            'SELECT resource_data FROM submission_new_resources WHERE submission_id = '
            . '(SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid) '
            . 'ORDER BY display_order ASC',
            [':uuid' => $uuid]
        )->queryColumn();
        return array_map(function ($resourceData) {
            return json_decode($resourceData, true);
        }, $rows);
    }

    private function token($username, $role, $internalId = null)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'full_name' => 'Synthetic API-086 User',
            'email' => $username . '@example.test',
            'institution' => 'SM',
            'internal_id' => $internalId,
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function cleanupFixtures()
    {
        $db = \Yii::$app->db;
        $submissionIds = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE shibboleth_user_id = :owner '
            . 'AND its_course_id = :course AND academic_period = :period',
            [':owner' => $this->ownerId, ':course' => $this->courseId, ':period' => $this->academicPeriod]
        )->queryColumn();
        foreach ([
            'submission_metadata',
            'submission_new_resources',
            'submission_reuse_resources',
            'submission_folders',
        ] as $table) {
            if ($submissionIds) {
                $db->createCommand()->delete($table, ['submission_id' => $submissionIds])->execute();
            }
        }
        if ($submissionIds) {
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        $db->createCommand()->delete('course_assignments', [
            'smith_id' => [$this->ownerSmithId, $this->coInstructorSmithId],
            'course_id' => $this->courseId,
        ])->execute();
        $db->createCommand()->delete('faculty_proxy_permissions', [
            'faculty_shibboleth_id' => $this->ownerId,
            'proxy_shibboleth_id' => 'test-api086-proxy',
        ])->execute();
    }
}

class TestApi086FolioService
{
    public function searchTerms()
    {
        return [[
            'id' => 'synthetic-api086-term',
            'name' => 'Synthetic API-086 term',
            'startDate' => '2099-01-01',
            'endDate' => '2099-12-31',
        ]];
    }

    public function searchCourses($query)
    {
        return null;
    }
}
