<?php

use PHPUnit\Framework\Assert;
use app\services\ItemClaimRepository;
use app\services\ItemClaimService;

/** Covers item-level claim routes, logging, expiry, privacy, and legacy admin compatibility. */
class Api082ItemClaimsCest extends BaseFunctionalCest
{
    private $prefix = 'test-api082-';
    private $staffToken;
    private $targetToken;
    private $adminToken;
    private $facultyToken;
    private $employeeToken;
    private $clockNow = '2026-10-19 12:00:00';
    private $notifications = [];
    private $materialTypeId;
    private $resourceId;
    private $submissions = [];
    private $courseIds = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->insertUser('staff', 'staff', 'Synthetic API-082 Staff');
        $this->insertUser('target', 'staff', 'Synthetic API-082 Target');
        $this->insertUser('admin', 'admin', 'Synthetic API-082 Admin');
        $this->insertUser('faculty', 'faculty', 'Synthetic API-082 Faculty');
        $this->insertUser('employee', 'employee', 'Synthetic API-082 Employee');
        $this->staffToken = $this->token('staff');
        $this->targetToken = $this->token('target');
        $this->adminToken = $this->token('admin');
        $this->facultyToken = $this->token('faculty');
        $this->employeeToken = $this->token('employee');
        $this->notifications = [];
        $this->clockNow = '2026-10-19 12:00:00';

        $db = \Yii::$app->db;
        $db->createCommand()->insert('material_types', [
            'name' => $this->prefix . 'book',
            'description' => 'Synthetic API-082 material type',
        ])->execute();
        $this->materialTypeId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('resources', [
            'name' => 'API-082 reused book',
            'material_type_id' => $this->materialTypeId,
        ])->execute();
        $this->resourceId = (int)$db->getLastInsertID();

        $case = $this;
        \Yii::$container->set(ItemClaimService::class, function ($container = null) use ($case) {
            return new ItemClaimService(
                null,
                null,
                function () use ($case) {
                    return $case->clockNow;
                },
                new Api082NotifierSpy(function ($event, $context) use ($case) {
                    $case->notifications[] = ['event' => $event, 'context' => $context];
                })
            );
        });
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        \Yii::$container->clear(ItemClaimService::class);
    }

    public function claimIsAtomicAndWorksForNewAndReuseItems(FunctionalTester $I)
    {
        $submission = $this->createSubmission('atomic');
        $reuseId = $this->createReuseItem($submission['submission_id'], 'API-082 reused book', 2);

        $this->request($I, 'POST', 'workflow-claim/claim', [], $this->staffToken, [
            'kind' => 'new', 'id' => $submission['new_item_id'],
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('test-api082-staff', $this->response($I)['item']['claimed_by']);
        Assert::assertSame('Synthetic API-082 Staff', $this->response($I)['item']['claimed_by_display']);

        $this->request($I, 'POST', 'workflow-claim/claim', [], $this->targetToken, [
            'kind' => 'new', 'id' => $submission['new_item_id'],
        ]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('already_claimed', $this->response($I)['error_code']);
        Assert::assertSame('Synthetic API-082 Staff', $this->response($I)['claimed_by_display']);
        Assert::assertSame('test-api082-staff', $this->claimRow('new', $submission['new_item_id'])['claimed_by']);
        Assert::assertSame(0, (new ItemClaimRepository())->claimIfUnclaimed(
            'new', $submission['new_item_id'], 'test-api082-target', $this->clockNow
        ));
        Assert::assertSame('test-api082-staff', $this->claimRow('new', $submission['new_item_id'])['claimed_by']);

        $this->request($I, 'POST', 'workflow-claim/claim', [], $this->targetToken, [
            'kind' => 'reuse', 'id' => $reuseId,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('reuse', $this->response($I)['item']['kind']);

        $events = \Yii::$app->db->createCommand(
            'SELECT item_kind, event_type FROM workflow_events WHERE submission_id = :submission_id ORDER BY id',
            [':submission_id' => $submission['submission_id']]
        )->queryAll();
        Assert::assertSame([
            ['item_kind' => 'new', 'event_type' => 'claimed'],
            ['item_kind' => 'reuse', 'event_type' => 'claimed'],
        ], $events);

        $this->request($I, 'GET', 'workflow-claim/timeline', [], $this->staffToken, [
            'kind' => 'new', 'id' => $submission['new_item_id'],
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('claimed', $this->response($I)['items'][0]['event_type']);
        Assert::assertSame('test-api082-staff', $this->response($I)['items'][0]['actor']);
    }

    public function releaseHandoffAndTakeoverApplyToBothItemKinds(FunctionalTester $I)
    {
        $submission = $this->createSubmission('transitions');
        $items = [
            ['kind' => 'new', 'id' => $submission['new_item_id']],
            ['kind' => 'reuse', 'id' => $this->createReuseItem($submission['submission_id'], 'API-082 reused book', 2)],
        ];

        foreach ($items as $item) {
            $this->claim($I, $item['kind'], $item['id'], $this->staffToken);

            $this->request($I, 'POST', 'workflow-claim/release', [], $this->targetToken, $item);
            $I->seeResponseCodeIs(409);
            Assert::assertSame('not_claimed_by_you', $this->response($I)['error_code']);

            $this->request($I, 'POST', 'workflow-claim/release', ['reason' => 'Synthetic release'], $this->staffToken, $item);
            $I->seeResponseCodeIs(200);
            Assert::assertNull($this->response($I)['item']['claimed_by']);

            $this->claim($I, $item['kind'], $item['id'], $this->staffToken);
            $this->request($I, 'POST', 'workflow-claim/handoff', [
                'to_username' => 'test-api082-target',
            ], $this->staffToken, $item);
            $I->seeResponseCodeIs(200);
            Assert::assertSame('test-api082-target', $this->response($I)['item']['claimed_by']);

            $this->request($I, 'POST', 'workflow-claim/takeover', [], $this->staffToken, $item);
            $I->seeResponseCodeIs(400);
            Assert::assertSame('reason_required', $this->response($I)['error_code']);

            $this->request($I, 'POST', 'workflow-claim/takeover', [
                'reason' => 'Synthetic workload balancing',
            ], $this->staffToken, $item);
            $I->seeResponseCodeIs(200);
            Assert::assertSame('test-api082-staff', $this->response($I)['item']['claimed_by']);
        }

        $this->request($I, 'POST', 'workflow-claim/handoff', [
            'to_username' => 'test-api082-missing',
        ], $this->staffToken, ['kind' => 'new', 'id' => $submission['new_item_id']]);
        $I->seeResponseCodeIs(404);
        Assert::assertSame('unknown_staff', $this->response($I)['error_code']);

        Assert::assertCount(4, array_filter($this->notifications, function ($notification) {
            return in_array($notification['event'], ['claim_handed_off', 'claim_taken_over'], true);
        }));
    }

    public function claimAllClaimsEachAvailableItemAndReportsAlreadyClaimedItems(FunctionalTester $I)
    {
        $submission = $this->createSubmission('claim-all');
        $secondNewId = $this->createNewItem($submission['submission_id'], 'API-082 second new item', 2);
        $reuseId = $this->createReuseItem($submission['submission_id'], 'API-082 reused book', 3);
        $this->claim($I, 'reuse', $reuseId, $this->targetToken);

        $this->request($I, 'POST', 'workflow-claim/claim-all', [], $this->staffToken, [
            'uuid' => $submission['uuid'],
        ]);

        $I->seeResponseCodeIs(200);
        Assert::assertSame([
            ['kind' => 'new', 'id' => $submission['new_item_id']],
            ['kind' => 'new', 'id' => $secondNewId],
        ], $this->response($I)['claimed']);
        Assert::assertSame('Synthetic API-082 Target', $this->response($I)['skipped'][0]['claimed_by_display']);
        Assert::assertSame('reuse', $this->response($I)['skipped'][0]['kind']);
    }

    public function queueAndMyItemsReturnTheSharedItemSummary(FunctionalTester $I)
    {
        $submission = $this->createSubmission('summary');
        $reuseId = $this->createReuseItem($submission['submission_id'], 'API-082 reused book', 2);

        $this->request($I, 'GET', 'workflow-claim/queue', [], $this->staffToken, [
            'term' => 'Fall 2027', 'type' => $this->prefix . 'book', 'page' => 1,
        ]);
        $I->seeResponseCodeIs(200);
        $queue = $this->response($I);
        Assert::assertSame(2, $queue['count']);
        Assert::assertSame('new', $queue['items'][0]['kind']);
        Assert::assertSame((int)$submission['new_item_id'], $queue['items'][0]['id']);
        Assert::assertSame('TST 082-' . substr(str_replace('-', '', $submission['uuid']), 0, 8), $queue['items'][0]['course_code']);
        Assert::assertSame('API-082 new material', $queue['items'][0]['title']);
        Assert::assertSame($this->prefix . 'book', $queue['items'][0]['material_type']);
        Assert::assertSame(1, $queue['items'][0]['position']);
        Assert::assertNull($queue['items'][0]['claimed_by']);
        Assert::assertNull($queue['items'][0]['expires_at']);
        Assert::assertNull($queue['items'][0]['assigned_group']);
        Assert::assertSame('reuse', $queue['items'][1]['kind']);
        Assert::assertSame($reuseId, $queue['items'][1]['id']);

        $this->claim($I, 'new', $submission['new_item_id'], $this->staffToken);
        $this->request($I, 'GET', 'workflow-claim/my-items', [], $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('new', $this->response($I)['items'][0]['kind']);
        Assert::assertSame('2026-10-22 12:00:00', $this->response($I)['items'][0]['expires_at']);

        $this->request($I, 'GET', 'workflow-claim/staff', [], $this->staffToken, ['q' => 'API-082 Target']);
        $I->seeResponseCodeIs(200);
        Assert::assertSame([
            ['username' => 'test-api082-target', 'display_name' => 'Synthetic API-082 Target'],
        ], $this->response($I)['items']);
    }

    public function expiredClaimsAreReleasedLazilyAndByTheConsoleCommand(FunctionalTester $I)
    {
        $submission = $this->createSubmission('expiry');
        $this->claim($I, 'new', $submission['new_item_id'], $this->staffToken);
        $this->clockNow = '2026-10-22 12:00:01';

        $this->request($I, 'GET', 'workflow-claim/my-items', [], $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame([], $this->response($I)['items']);
        Assert::assertNull($this->claimRow('new', $submission['new_item_id'])['claimed_by']);
        Assert::assertSame(1, $this->eventCount($submission['submission_id'], 'claim_expired'));
        Assert::assertSame('claim_expired', $this->notifications[0]['event']);

        $reuseId = $this->createReuseItem($submission['submission_id'], 'API-082 reused book', 2);
        $this->clockNow = '2026-10-19 12:00:00';
        $this->claim($I, 'reuse', $reuseId, $this->staffToken);
        $this->clockNow = '2026-10-22 12:00:01';
        $command = new \app\commands\WorkflowController('workflow', \Yii::$app);
        $command->actionExpireClaims();

        Assert::assertNull($this->claimRow('reuse', $reuseId)['claimed_by']);
        Assert::assertSame(2, $this->eventCount($submission['submission_id'], 'claim_expired'));
    }

    public function existingItemWritesRenewClaimActivity(FunctionalTester $I)
    {
        $submission = $this->createSubmission('activity');
        $this->claim($I, 'new', $submission['new_item_id'], $this->staffToken);
        $this->clockNow = '2026-10-20 15:30:00';
        $this->request($I, 'PUT', 'submission-workflow/update-item', [
            'staff_notes' => 'Synthetic API-082 activity update',
        ], $this->staffToken, ['itemId' => $submission['new_item_id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('2026-10-20 15:30:00', $this->claimRow('new', $submission['new_item_id'])['last_activity_at']);

        $taskId = $this->addChecklistTask($submission['new_item_id']);
        $this->clockNow = '2026-10-21 09:15:00';
        $this->request($I, 'PATCH', 'checklist/update-task', ['completed' => true], $this->staffToken, [
            'itemId' => $submission['new_item_id'], 'taskId' => $taskId,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('2026-10-21 09:15:00', $this->claimRow('new', $submission['new_item_id'])['last_activity_at']);
        $this->request($I, 'POST', 'checklist/complete-checklist', [], $this->staffToken, [
            'itemId' => $submission['new_item_id'],
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertNull($this->claimRow('new', $submission['new_item_id'])['claimed_by']);
        Assert::assertSame(1, $this->eventCount($submission['submission_id'], 'released'));

        $completeItemId = $this->createNewItem($submission['submission_id'], 'API-082 materialized source', 3);
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'source_resource_id' => $this->resourceId,
        ], ['id' => $completeItemId])->execute();
        $this->claim($I, 'new', $completeItemId, $this->staffToken);
        $this->clockNow = '2026-10-21 10:00:00';
        $this->request($I, 'POST', 'submission-workflow/complete-processing', [], $this->staffToken, [
            'itemId' => $completeItemId,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('2026-10-21 10:00:00', $this->claimRow('new', $completeItemId)['last_activity_at']);
    }

    public function unlinkedItemsAndNonStaffCannotUseClaimRoutes(FunctionalTester $I)
    {
        $submission = $this->createSubmission('unlinked', false);
        $this->request($I, 'POST', 'workflow-claim/claim', [], $this->staffToken, [
            'kind' => 'new', 'id' => $submission['new_item_id'],
        ]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('submission_not_linked', $this->response($I)['error_code']);

        $this->request($I, 'GET', 'workflow-claim/queue', [], null);
        $I->seeResponseCodeIs(401);

        foreach ([$this->facultyToken, $this->employeeToken] as $token) {
            $this->request($I, 'GET', 'workflow-claim/queue', [], $token);
            $I->seeResponseCodeIs(403);
        }
    }

    public function facultySubmissionNeverExposesClaimFields(FunctionalTester $I)
    {
        $submission = $this->createSubmission('faculty-privacy');
        $this->claim($I, 'new', $submission['new_item_id'], $this->staffToken);

        $this->request($I, 'GET', 'faculty-submission/view', [], $this->facultyToken, [
            'id' => $submission['uuid'],
        ]);
        $I->seeResponseCodeIs(200);
        $response = $this->response($I);
        $keys = $this->recursiveKeys($response);
        foreach (['claimed_by', 'claimed_by_staff_id', 'claimed_by_display', 'claimed_at', 'last_activity_at', 'expires_at', 'assigned_group_id'] as $key) {
            Assert::assertNotContains($key, $keys);
        }
    }

    public function legacyAdminClaimRoutesKeepTheirResponseShapeWithoutWritingNotes(FunctionalTester $I)
    {
        $submission = $this->createSubmission('legacy');
        $this->request($I, 'POST', 'submission-workflow/claim-item', [], $this->staffToken, [
            'itemId' => $submission['new_item_id'],
        ]);
        $I->seeResponseCodeIs(200);
        $claim = $this->response($I);
        foreach (['success', 'item', 'message', 'claimed_by', 'claimed_by_id', 'claimed_at'] as $key) {
            Assert::assertArrayHasKey($key, $claim);
        }
        Assert::assertSame('Synthetic API-082 Staff', $claim['claimed_by']);
        Assert::assertSame('', (string)$claim['item']['staff_notes']);
        Assert::assertArrayNotHasKey('claimed_by', $claim['item']);
        Assert::assertArrayNotHasKey('last_activity_at', $claim['item']);

        $this->request($I, 'GET', 'submission-workflow/my-claimed-items', [], $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertNotEmpty($this->response($I));
        Assert::assertArrayHasKey('processing_context', $this->response($I)[0]);
        Assert::assertArrayNotHasKey('claimed_by', $this->response($I)[0]);
    }

    private function claim(FunctionalTester $I, $kind, $id, $token)
    {
        $this->request($I, 'POST', 'workflow-claim/claim', [], $token, ['kind' => $kind, 'id' => $id]);
        $I->seeResponseCodeIs(200);
        return $this->response($I)['item'];
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, $token, array $params = [])
    {
        $I->haveHttpHeader('Authorization', $token === null ? '' : 'Bearer ' . $token);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function token($userType)
    {
        $username = $this->prefix . $userType;
        $role = $userType === 'target' ? 'staff' : $userType;
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'internal_id' => '999078082',
            'full_name' => 'Synthetic API-082 ' . ucfirst($userType),
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertUser($userType, $role, $displayName)
    {
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $this->prefix . $userType,
            'full_name' => $displayName,
            'email' => $this->prefix . $userType . '@example.test',
            'role' => $role,
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function createSubmission($suffix, $linked = true)
    {
        $uuid = $this->uuid();
        $courseCode = 'TST 082-' . substr(str_replace('-', '', $uuid), 0, 8);
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => $courseCode,
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => $linked ? 'linked' : 'needs_linking',
        ]);
        $newItemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id ASC LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'display_order' => 1,
            'material_type_id' => $this->materialTypeId,
            'resource_data' => json_encode(['title' => 'API-082 new material']),
        ], ['id' => $newItemId])->execute();

        if ($linked) {
            $courseId = $this->createCourse($uuid, $courseCode);
            $termId = $this->prefix . 'term-' . substr(str_replace('-', '', $uuid), 0, 16);
            \Yii::$app->db->createCommand()->insert('course_offerings', [
                'course_id' => $courseId,
                'folio_course_id' => $this->prefix . 'listing-' . substr(str_replace('-', '', $uuid), 0, 16),
                'term_id' => $termId,
                'term_name' => 'Fall 2027',
                'section_name' => '01',
            ])->execute();
            $offeringId = (int)\Yii::$app->db->getLastInsertID();
            \Yii::$app->db->createCommand()->update('faculty_submissions', [
                'offering_id' => $offeringId,
                'folio_course_listing_id' => $this->prefix . 'listing-' . substr(str_replace('-', '', $uuid), 0, 16),
            ], ['submission_id' => $submissionId])->execute();
        }

        $submission = [
            'uuid' => $uuid,
            'submission_id' => $submissionId,
            'new_item_id' => $newItemId,
            'course_code' => $courseCode,
        ];
        $this->submissions[] = $submissionId;
        return $submission;
    }

    private function createCourse($uuid, $courseCode)
    {
        \Yii::$app->db->createCommand()->insert('courses', [
            'course_name' => 'Synthetic API-082 course',
            'course_number' => $courseCode,
            'location_id' => $this->prefix . 'location-' . substr(str_replace('-', '', $uuid), 0, 16),
            'location_name' => 'Synthetic Library',
        ])->execute();
        $courseId = (int)\Yii::$app->db->getLastInsertID();
        $this->courseIds[] = $courseId;
        return $courseId;
    }

    private function createNewItem($submissionId, $title, $position)
    {
        \Yii::$app->db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submissionId,
            'material_type_id' => $this->materialTypeId,
            'resource_data' => json_encode(['title' => $title]),
            'display_order' => $position,
            'item_status' => 'pending',
        ])->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function createReuseItem($submissionId, $title, $position)
    {
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $submissionId,
            'source_resource_id' => $this->resourceId,
            'display_order' => $position,
            'item_status' => 'pending',
        ])->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function addChecklistTask($itemId)
    {
        \Yii::$app->db->createCommand()->insert('checklist_templates', [
            'name' => $this->prefix . 'checklist',
            'format' => 'any',
            'created_by' => null,
        ])->execute();
        $templateId = (int)\Yii::$app->db->getLastInsertID();
        \Yii::$app->db->createCommand()->insert('checklist_template_tasks', [
            'template_id' => $templateId,
            'label' => 'Synthetic API-082 checklist task',
            'task_order' => 1,
        ])->execute();
        $templateTaskId = (int)\Yii::$app->db->getLastInsertID();
        \Yii::$app->db->createCommand()->insert('item_checklists', [
            'submission_item_id' => $itemId,
            'template_id' => $templateId,
            'assigned_by' => 'test-api082-staff',
        ])->execute();
        $checklistId = (int)\Yii::$app->db->getLastInsertID();
        \Yii::$app->db->createCommand()->insert('item_checklist_tasks', [
            'item_checklist_id' => $checklistId,
            'template_task_id' => $templateTaskId,
            'completed' => 0,
        ])->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function claimRow($kind, $itemId)
    {
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        return \Yii::$app->db->createCommand(
            'SELECT claimed_by, claimed_at, last_activity_at FROM ' . $table . ' WHERE id = :id',
            [':id' => $itemId]
        )->queryOne();
    }

    private function eventCount($submissionId, $eventType)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :submission_id AND event_type = :event_type',
            [':submission_id' => $submissionId, ':event_type' => $eventType]
        )->queryScalar();
    }

    private function recursiveKeys(array $value)
    {
        $keys = [];
        foreach ($value as $key => $child) {
            if (is_string($key)) {
                $keys[] = $key;
            }
            if (is_array($child)) {
                $keys = array_merge($keys, $this->recursiveKeys($child));
            }
        }
        return $keys;
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $submissionIds = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE course_title LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($submissionIds) {
            $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionIds])->execute();
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        $courseIds = $db->createCommand(
            'SELECT course_id FROM courses WHERE location_id LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($courseIds) {
            $offeringIds = (new \yii\db\Query())
                ->select('offering_id')
                ->from('course_offerings')
                ->where(['course_id' => $courseIds])
                ->column($db);
            if ($offeringIds) {
                $db->createCommand()->delete('course_resources', ['offering_id' => $offeringIds])->execute();
                $db->createCommand()->delete('physical_resource_references', ['offering_id' => $offeringIds])->execute();
                $db->createCommand()->delete('course_offerings', ['offering_id' => $offeringIds])->execute();
            }
            $db->createCommand()->delete('courses', ['course_id' => $courseIds])->execute();
        }
        $resourceIds = $db->createCommand(
            'SELECT resource_id FROM resources WHERE name = :name',
            [':name' => 'API-082 reused book']
        )->queryColumn();
        if ($resourceIds) {
            $db->createCommand()->delete('course_resources', ['resource_id' => $resourceIds])->execute();
            $db->createCommand()->delete('resources', ['resource_id' => $resourceIds])->execute();
        }
        $db->createCommand()->delete('material_types', ['like', 'name', $this->prefix . '%', false])->execute();
        $db->createCommand()->delete('users', ['like', 'username', $this->prefix . '%', false])->execute();
        $this->submissions = [];
        $this->courseIds = [];
    }
}

class Api082NotifierSpy
{
    private $callback;

    public function __construct($callback)
    {
        $this->callback = $callback;
    }

    public function notify($event, array $context)
    {
        call_user_func($this->callback, $event, $context);
    }
}
