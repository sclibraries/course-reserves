<?php

use PHPUnit\Framework\Assert;
use app\services\ItemClaimRepository;
use app\services\ItemClaimService;

/** Covers claim presentation on staff submission details. */
class Api102SubmissionDetailClaimsCest extends BaseFunctionalCest
{
    private $prefix = 'test-api102-';
    private $tokens = [];
    private $clockNow = '2026-10-19 12:00:00';
    private $notifications = [];
    private $materialTypeId;
    private $resourceId;
    private $courseIds = [];
    private $originalExpiryHours;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->insertUser('admin', 'admin', 'Synthetic API-102 Admin');
        $this->insertUser('staff-a', 'staff', '');
        $this->insertUser('staff-b', 'staff', 'Synthetic API-102 Staff B');
        $this->insertUser('faculty', 'faculty', 'Synthetic API-102 Faculty');
        $this->tokens = [
            'admin' => $this->token('admin', 'admin'),
            'staff-a' => $this->token('staff-a', 'staff'),
            'staff-b' => $this->token('staff-b', 'staff'),
            'faculty' => $this->token('faculty', 'faculty'),
        ];
        $this->notifications = [];
        $this->clockNow = '2026-10-19 12:00:00';
        $this->originalExpiryHours = \Yii::$app->params['workflowClaimExpiryHours'];
        \Yii::$app->params['workflowClaimExpiryHours'] = 72;
        \Yii::$app->db->createCommand()->insert('material_types', [
            'name' => $this->prefix . 'book',
            'description' => 'Synthetic API-102 material type',
        ])->execute();
        $this->materialTypeId = (int)\Yii::$app->db->getLastInsertID();
        \Yii::$app->db->createCommand()->insert('resources', [
            'name' => 'Synthetic API-102 reused book',
            'material_type_id' => $this->materialTypeId,
        ])->execute();
        $this->resourceId = (int)\Yii::$app->db->getLastInsertID();

        $case = $this;
        \Yii::$container->set(ItemClaimService::class, function ($container = null) use ($case) {
            return new ItemClaimService(
                null,
                null,
                function () use ($case) {
                    return $case->clockNow;
                },
                new Api102NotifierSpy(function ($event, $context) use ($case) {
                    $case->notifications[] = ['event' => $event, 'context' => $context];
                })
            );
        });
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        \Yii::$app->params['workflowClaimExpiryHours'] = $this->originalExpiryHours;
        \Yii::$container->clear(ItemClaimService::class);
    }

    public function staffDetailPresentsClaimsByCollectionKindAndKeepsOnlyTheStaffProjection(FunctionalTester $I)
    {
        $submission = $this->createSubmission('claims');
        $reuseId = $this->createReuseItem($submission['submission_id'], 2);
        $pristineId = $this->createNewItem($submission['submission_id'], 3, 0);
        $releasedId = $this->createNewItem($submission['submission_id'], 4, 0);
        $isReuseId = $this->createNewItem($submission['submission_id'], 5, 1);
        $overlapId = $this->overlappingItems($submission['submission_id']);
        $otherSubmission = $this->createSubmission('other-submission');

        $groupId = $this->createGroup($I);
        $this->claim($I, 'new', $submission['new_item_id'], 'staff-a');
        $this->claim($I, 'reuse', $reuseId, 'staff-a');
        $this->request($I, 'POST', 'workflow-claim/handoff', [
            'to_group_id' => $groupId,
        ], 'staff-a', ['kind' => 'reuse', 'id' => $reuseId]);
        $I->seeResponseCodeIs(200);
        $this->claim($I, 'new', $releasedId, 'staff-a');
        $this->request($I, 'POST', 'workflow-claim/release', [], 'staff-a', [
            'kind' => 'new', 'id' => $releasedId,
        ]);
        $I->seeResponseCodeIs(200);
        $this->claim($I, 'new', $isReuseId, 'staff-b');
        $this->claim($I, 'new', $overlapId, 'staff-a');
        $this->claim($I, 'reuse', $overlapId, 'staff-b');
        $this->claim($I, 'new', $otherSubmission['new_item_id'], 'staff-b');
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by_staff_id' => $this->prefix . 'staff-b',
        ], ['id' => $pristineId])->execute();
        \Yii::$app->params['workflowClaimExpiryHours'] = 6;

        $detail = $this->staffDetail($I, $submission['submission_id']);
        $newItems = $this->itemsById($detail['newResources']);
        $reuseItems = $this->itemsById($detail['reuseResources']);
        $claimFields = ['claimed_by', 'claimed_by_display', 'claimed_at', 'last_activity_at', 'expires_at', 'assigned_group'];

        foreach ([$newItems, $reuseItems] as $items) {
            foreach ($items as $item) {
                foreach ($claimFields as $field) {
                    Assert::assertArrayHasKey($field, $item);
                }
                Assert::assertArrayNotHasKey('claimed_by_staff_id', $item);
                Assert::assertArrayNotHasKey('assigned_group_id', $item);
            }
        }
        Assert::assertSame($this->prefix . 'staff-a', $newItems[$submission['new_item_id']]['claimed_by']);
        Assert::assertSame($this->prefix . 'staff-a', $newItems[$submission['new_item_id']]['claimed_by_display']);
        Assert::assertSame('2026-10-19 12:00:00', $newItems[$submission['new_item_id']]['claimed_at']);
        Assert::assertSame('2026-10-19 18:00:00', $newItems[$submission['new_item_id']]['expires_at']);

        $this->assertNullClaim($newItems[$pristineId]);
        Assert::assertNull($newItems[$releasedId]['claimed_by']);
        Assert::assertSame('2026-10-19 12:00:00', $newItems[$releasedId]['last_activity_at']);
        Assert::assertNull($newItems[$releasedId]['expires_at']);
        Assert::assertSame(1, (int)$newItems[$isReuseId]['is_reuse']);
        Assert::assertSame($this->prefix . 'staff-b', $newItems[$isReuseId]['claimed_by']);
        Assert::assertSame('Synthetic API-102 Staff B', $newItems[$isReuseId]['claimed_by_display']);

        Assert::assertNull($reuseItems[$reuseId]['claimed_by']);
        Assert::assertNull($reuseItems[$reuseId]['claimed_by_display']);
        Assert::assertNull($reuseItems[$reuseId]['claimed_at']);
        Assert::assertSame('2026-10-19 12:00:00', $reuseItems[$reuseId]['last_activity_at']);
        Assert::assertNull($reuseItems[$reuseId]['expires_at']);
        Assert::assertSame([
            'id' => $groupId,
            'name' => $this->prefix . 'shared-queue',
        ], $reuseItems[$reuseId]['assigned_group']);
        Assert::assertSame($this->prefix . 'staff-a', $newItems[$overlapId]['claimed_by']);
        Assert::assertSame($this->prefix . 'staff-b', $reuseItems[$overlapId]['claimed_by']);
        Assert::assertSame($this->prefix . 'staff-a', $newItems[$overlapId]['claimed_by_display']);
        Assert::assertSame('Synthetic API-102 Staff B', $reuseItems[$overlapId]['claimed_by_display']);
        Assert::assertSame('Synthetic API-102 reused book', $reuseItems[$reuseId]['sourceResource']['name']);
        Assert::assertArrayNotHasKey($otherSubmission['new_item_id'], $newItems);
        $claimRows = (new ItemClaimRepository())->claimsBySubmission($submission['submission_id']);
        Assert::assertArrayNotHasKey($otherSubmission['new_item_id'], $claimRows['new']);
    }

    public function detailExpiresDueClaimsAndFacultyViewKeepsClaimFieldsPrivate(FunctionalTester $I)
    {
        $submission = $this->createSubmission('expiry');
        $this->claim($I, 'new', $submission['new_item_id'], 'staff-a');

        $this->request($I, 'GET', 'faculty-submission/view', [], 'faculty', ['id' => $submission['uuid']]);
        $I->seeResponseCodeIs(200);
        $facultyKeys = $this->recursiveKeys($this->response($I));
        foreach ([
            'claimed_by', 'claimed_by_display', 'claimed_at', 'last_activity_at', 'expires_at',
            'assigned_group', 'assigned_group_id', 'claimed_by_staff_id',
        ] as $field) {
            Assert::assertNotContains($field, $facultyKeys);
        }

        $this->clockNow = '2026-10-22 12:00:01';
        $detail = $this->staffDetail($I, $submission['submission_id']);
        $item = $this->itemsById($detail['newResources'])[$submission['new_item_id']];
        Assert::assertNull($item['claimed_by']);
        Assert::assertNull($item['claimed_by_display']);
        Assert::assertNull($item['claimed_at']);
        Assert::assertSame($this->clockNow, $item['last_activity_at']);
        Assert::assertNull($item['expires_at']);
        Assert::assertNull($item['assigned_group']);
        Assert::assertSame(1, $this->eventCount($submission['submission_id'], 'claim_expired'));
        Assert::assertSame('claim_expired', $this->notifications[0]['event']);
        Assert::assertNull($this->claimRow('new', $submission['new_item_id'])['claimed_by']);
    }

    public function claimReadsStayAtTwoForTwoAndSixItems(FunctionalTester $I)
    {
        $two = $this->createSubmission('two-items');
        $this->createNewItem($two['submission_id'], 2, 0);
        Assert::assertSame(2, $this->claimReadCount($two['submission_id']));

        $six = $this->createSubmission('six-items');
        for ($position = 2; $position <= 6; $position++) {
            $this->createNewItem($six['submission_id'], $position, 0);
        }
        Assert::assertSame(2, $this->claimReadCount($six['submission_id']));
    }

    private function createSubmission($suffix)
    {
        $uuid = $this->uuid();
        $courseCode = 'TST 102-' . substr(str_replace('-', '', $uuid), 0, 8);
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => $courseCode,
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $newItemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id ASC LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $this->materialTypeId,
            'resource_data' => json_encode(['title' => 'Synthetic API-102 new material']),
        ], ['id' => $newItemId])->execute();

        \Yii::$app->db->createCommand()->insert('courses', [
            'course_name' => 'Synthetic API-102 course',
            'course_number' => $courseCode,
            'location_id' => $this->prefix . 'location-' . substr(str_replace('-', '', $uuid), 0, 16),
            'location_name' => 'Synthetic Library',
        ])->execute();
        $courseId = (int)\Yii::$app->db->getLastInsertID();
        $this->courseIds[] = $courseId;
        \Yii::$app->db->createCommand()->insert('course_offerings', [
            'course_id' => $courseId,
            'folio_course_id' => $this->prefix . 'listing-' . substr(str_replace('-', '', $uuid), 0, 16),
            'term_id' => $this->prefix . 'term-' . substr(str_replace('-', '', $uuid), 0, 16),
            'term_name' => 'Fall 2027',
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)\Yii::$app->db->getLastInsertID();
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'offering_id' => $offeringId,
            'folio_course_listing_id' => $this->prefix . 'listing-' . substr(str_replace('-', '', $uuid), 0, 16),
        ], ['submission_id' => $submissionId])->execute();
        return ['uuid' => $uuid, 'submission_id' => $submissionId, 'new_item_id' => $newItemId];
    }

    private function createNewItem($submissionId, $position, $isReuse)
    {
        \Yii::$app->db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submissionId,
            'material_type_id' => $this->materialTypeId,
            'resource_data' => json_encode(['title' => 'Synthetic API-102 item ' . $position]),
            'display_order' => $position,
            'item_status' => 'pending',
            'is_reuse' => $isReuse,
        ])->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function createReuseItem($submissionId, $position)
    {
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $submissionId,
            'source_resource_id' => $this->resourceId,
            'display_order' => $position,
            'item_status' => 'pending',
        ])->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function overlappingItems($submissionId)
    {
        $db = \Yii::$app->db;
        $newMax = (int)$db->createCommand('SELECT COALESCE(MAX(id), 0) FROM submission_new_resources')->queryScalar();
        $reuseMax = (int)$db->createCommand('SELECT COALESCE(MAX(id), 0) FROM submission_reuse_resources')->queryScalar();
        $id = max($newMax, $reuseMax) + 1;
        $db->createCommand()->insert('submission_new_resources', [
            'id' => $id,
            'submission_id' => $submissionId,
            'material_type_id' => $this->materialTypeId,
            'resource_data' => json_encode(['title' => 'Synthetic API-102 overlapping new']),
            'display_order' => 6,
            'item_status' => 'pending',
        ])->execute();
        $db->createCommand()->insert('submission_reuse_resources', [
            'id' => $id,
            'submission_id' => $submissionId,
            'source_resource_id' => $this->resourceId,
            'display_order' => 7,
            'item_status' => 'pending',
        ])->execute();
        return $id;
    }

    private function createGroup(FunctionalTester $I)
    {
        $this->request($I, 'POST', 'workflow-group/admin-groups', [
            'name' => $this->prefix . 'shared-queue',
            'description' => 'Synthetic API-102 staff group',
        ], 'admin');
        $I->seeResponseCodeIs(201);
        return (int)$this->response($I)['group']['id'];
    }

    private function claim(FunctionalTester $I, $kind, $id, $userType)
    {
        $this->request($I, 'POST', 'workflow-claim/claim', [], $userType, ['kind' => $kind, 'id' => $id]);
        $I->seeResponseCodeIs(200);
        return $this->response($I)['item'];
    }

    private function staffDetail(FunctionalTester $I, $submissionId)
    {
        $this->request($I, 'GET', 'submission-workflow/view-submission', [], 'staff-a', ['id' => $submissionId]);
        $I->seeResponseCodeIs(200);
        return $this->response($I);
    }

    private function claimReadCount($submissionId)
    {
        $db = \Yii::$app->db;
        $wasLogging = $db->enableLogging;
        $db->enableLogging = true;
        $logger = \Yii::getLogger();
        $firstMessage = count($logger->messages);
        try {
            (new \app\controllers\SubmissionWorkflowController('submission-workflow', \Yii::$app))
                ->actionViewSubmission($submissionId);
            $messages = array_slice($logger->messages, $firstMessage);
        } finally {
            $db->enableLogging = $wasLogging;
        }
        $queries = array_filter($messages, function ($message) {
            return $message[2] === 'yii\\db\\Command::query'
                && $message[1] === \yii\log\Logger::LEVEL_INFO
                && is_string($message[0])
                && strpos($message[0], 'COALESCE(NULLIF(claimant.full_name, ""), claimant.username)') !== false;
        });
        return count($queries);
    }

    private function itemsById(array $items)
    {
        $result = [];
        foreach ($items as $item) {
            $result[(int)$item['id']] = $item;
        }
        return $result;
    }

    private function assertNullClaim(array $item)
    {
        foreach (['claimed_by', 'claimed_by_display', 'claimed_at', 'last_activity_at', 'expires_at', 'assigned_group'] as $field) {
            Assert::assertNull($item[$field]);
        }
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, $userType, array $params = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->tokens[$userType]);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function token($userType, $role)
    {
        $username = $this->prefix . $userType;
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'internal_id' => '999102001',
            'full_name' => 'Synthetic API-102 ' . $userType,
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertUser($userType, $role, $fullName)
    {
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $this->prefix . $userType,
            'full_name' => $fullName,
            'email' => $this->prefix . $userType . '@example.test',
            'role' => $role,
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function claimRow($kind, $id)
    {
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        return \Yii::$app->db->createCommand(
            'SELECT claimed_by, claimed_at, last_activity_at FROM ' . $table . ' WHERE id = :id',
            [':id' => $id]
        )->queryOne();
    }

    private function eventCount($submissionId, $eventType)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :id AND event_type = :event',
            [':id' => $submissionId, ':event' => $eventType]
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
        if ($db->schema->getTableSchema('staff_groups', true)) {
            $db->createCommand()->delete('staff_group_events', ['like', 'group_name', $this->prefix . '%', false])->execute();
            $groupIds = $db->createCommand(
                'SELECT id FROM staff_groups WHERE name LIKE :prefix',
                [':prefix' => $this->prefix . '%']
            )->queryColumn();
            if ($groupIds) {
                $db->createCommand()->delete('staff_groups', ['id' => $groupIds])->execute();
            }
        }
        $db->createCommand()->delete('users', ['like', 'username', $this->prefix . '%', false])->execute();
        $courseIds = $db->createCommand(
            'SELECT course_id FROM courses WHERE location_id LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($courseIds) {
            $offeringIds = (new yii\db\Query())->select('offering_id')->from('course_offerings')
                ->where(['course_id' => $courseIds])->column($db);
            if ($offeringIds) {
                $db->createCommand()->delete('course_resources', ['offering_id' => $offeringIds])->execute();
                $db->createCommand()->delete('physical_resource_references', ['offering_id' => $offeringIds])->execute();
                $db->createCommand()->delete('course_offerings', ['offering_id' => $offeringIds])->execute();
            }
            $db->createCommand()->delete('courses', ['course_id' => $courseIds])->execute();
        }
        $db->createCommand()->delete('resources', ['name' => 'Synthetic API-102 reused book'])->execute();
        $db->createCommand()->delete('material_types', ['like', 'name', $this->prefix . '%', false])->execute();
        $this->courseIds = [];
    }
}

class Api102NotifierSpy
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
