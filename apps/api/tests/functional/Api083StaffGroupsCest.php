<?php

use PHPUnit\Framework\Assert;
use app\services\ItemClaimService;

/** Covers admin-managed staff groups and their shared claim queues. */
class Api083StaffGroupsCest extends BaseFunctionalCest
{
    private $prefix = 'test-api083-';
    private $tokens = [];
    private $notifications = [];
    private $clockNow = '2026-10-19 12:00:00';
    private $materialTypeId;
    private $courseIds = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->insertUser('admin', 'admin');
        $this->insertUser('staff', 'staff');
        $this->insertUser('member', 'staff');
        $this->insertUser('second', 'staff');
        $this->insertUser('target', 'staff');
        $this->insertUser('faculty', 'faculty');
        $this->insertUser('employee', 'employee');
        foreach (['admin', 'staff', 'member', 'second', 'target', 'faculty', 'employee'] as $userType) {
            $this->tokens[$userType] = $this->token($userType);
        }

        \Yii::$app->db->createCommand()->insert('material_types', [
            'name' => $this->prefix . 'book',
            'description' => 'Synthetic API-083 material type',
        ])->execute();
        $this->materialTypeId = (int)\Yii::$app->db->getLastInsertID();
        $this->notifications = [];
        $this->clockNow = '2026-10-19 12:00:00';
        $case = $this;
        \Yii::$container->set(ItemClaimService::class, function ($container = null) use ($case) {
            return new ItemClaimService(
                null,
                null,
                function () use ($case) {
                    return $case->clockNow;
                },
                new Api083NotifierSpy(function ($event, $context) use ($case) {
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

    public function adminsManageGroupsAndMembershipAndWritesAreLogged(FunctionalTester $I)
    {
        $this->request($I, 'GET', 'workflow-group/admin-groups', [], 'admin');
        $I->seeResponseCodeIs(200);
        Assert::assertSame([], $this->response($I)['groups']);

        $this->request($I, 'POST', 'workflow-group/admin-groups', [
            'name' => $this->prefix . 'acquisitions',
            'description' => 'Synthetic acquisitions queue',
        ], 'admin');
        $I->seeResponseCodeIs(201);
        $group = $this->response($I)['group'];
        $groupId = (int)$group['id'];
        Assert::assertSame($this->prefix . 'acquisitions', $group['name']);

        $this->request($I, 'GET', 'workflow-group/groups', [], 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame([[
            'id' => $groupId,
            'name' => $this->prefix . 'acquisitions',
        ]], $this->response($I)['groups']);

        $this->request($I, 'GET', 'workflow-group/admin-groups', [], 'staff');
        $I->seeResponseCodeIs(403);

        $this->request($I, 'PUT', 'workflow-group/admin-group', [
            'name' => $this->prefix . 'acquisitions-updated',
            'description' => 'Updated synthetic queue',
        ], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($this->prefix . 'acquisitions-updated', $this->response($I)['group']['name']);

        $this->request($I, 'GET', 'workflow-group/admin-group-members', [], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame([], $this->response($I)['members']);

        $this->request($I, 'POST', 'workflow-group/admin-group-members', [
            'username' => $this->prefix . 'member',
        ], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(201);
        Assert::assertSame($this->prefix . 'member', $this->response($I)['member']['username']);

        $this->request($I, 'POST', 'workflow-group/admin-group-members', [
            'username' => $this->prefix . 'employee',
        ], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(404);
        Assert::assertSame('unknown_staff', $this->response($I)['error_code']);

        $this->request($I, 'GET', 'workflow-group/admin-group-members', [], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($this->prefix . 'member', $this->response($I)['members'][0]['username']);

        $this->request($I, 'DELETE', 'workflow-group/admin-group-member', [], 'admin', [
            'id' => $groupId,
            'username' => $this->prefix . 'member',
        ]);
        $I->seeResponseCodeIs(204);
        $this->request($I, 'DELETE', 'workflow-group/admin-group', [], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(204);

        $events = \Yii::$app->db->createCommand(
            'SELECT event_type FROM staff_group_events WHERE group_name LIKE :prefix ORDER BY id',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        Assert::assertSame([
            'group_created', 'group_updated', 'member_added', 'member_removed', 'group_deleted',
        ], $events);
    }

    public function groupQueuesEnforceMembershipAndSupportTakeoverAndRelease(FunctionalTester $I)
    {
        $groupId = $this->createGroup($I, 'shared-queue');
        $groupName = $this->prefix . 'shared-queue';
        $this->addMember($I, $groupId, 'member');
        $this->addMember($I, $groupId, 'second');
        $item = $this->createLinkedItem('queue');

        $this->claim($I, $item['id'], 'staff');
        $this->request($I, 'POST', 'workflow-claim/handoff', [
            'to_group_id' => $groupId,
            'reason' => 'Synthetic group handoff',
        ], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame([
            'id' => $groupId,
            'name' => $groupName,
        ], $this->response($I)['item']['assigned_group']);
        Assert::assertCount(2, array_filter($this->notifications, function ($notification) {
            return $notification['event'] === 'group_handoff';
        }));
        $recipients = array_map(function ($notification) {
            return $notification['context']['recipient_username'];
        }, array_filter($this->notifications, function ($notification) {
            return $notification['event'] === 'group_handoff';
        }));
        sort($recipients);
        Assert::assertSame([$this->prefix . 'member', $this->prefix . 'second'], $recipients);
        Assert::assertSame(1, $this->eventCount($item['submission_id'], 'group_handoff'));

        $this->request($I, 'GET', 'workflow-claim/queue', [], 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertNotContains($item['id'], array_column($this->response($I)['items'], 'id'));

        $this->request($I, 'GET', 'workflow-group/my-groups', [], 'member');
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, (int)$this->response($I)['groups'][0]['queue_count']);

        $this->request($I, 'GET', 'workflow-group/group-queue', [], 'member', ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, $this->response($I)['count']);
        Assert::assertSame($groupName, $this->response($I)['items'][0]['assigned_group']['name']);

        $this->request($I, 'GET', 'workflow-group/group-queue', [], 'staff', ['id' => $groupId]);
        $I->seeResponseCodeIs(403);

        $this->request($I, 'POST', 'workflow-claim/claim', [], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(403);
        Assert::assertSame('not_group_member', $this->response($I)['error_code']);

        $this->claim($I, $item['id'], 'member');
        $this->request($I, 'POST', 'workflow-claim/claim', [], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(403);
        Assert::assertSame('not_group_member', $this->response($I)['error_code']);

        $this->request($I, 'POST', 'workflow-claim/takeover', [], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('reason_required', $this->response($I)['error_code']);
        $this->request($I, 'POST', 'workflow-claim/takeover', [
            'reason' => 'Synthetic API-083 workload change',
        ], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('staff', substr($this->response($I)['item']['claimed_by'], strlen($this->prefix)));

        $this->request($I, 'GET', 'workflow-group/group-queue', [], 'member', ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(0, $this->response($I)['count']);

        $this->request($I, 'POST', 'workflow-claim/release', [
            'reason' => 'Synthetic return to group queue',
        ], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($groupId, (int)$this->response($I)['item']['assigned_group']['id']);
        $this->request($I, 'GET', 'workflow-group/group-queue', [], 'member', ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, $this->response($I)['count']);

        $this->request($I, 'DELETE', 'workflow-group/admin-group', [], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('group_has_items', $this->response($I)['error_code']);

        $this->claim($I, $item['id'], 'member');
        $this->request($I, 'POST', 'workflow-claim/handoff', [
            'to_username' => $this->prefix . 'target',
        ], 'member', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertNull($this->response($I)['item']['assigned_group']);
        $this->request($I, 'DELETE', 'workflow-group/admin-group', [], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(204);
    }

    public function expiredGroupClaimReturnsToItsSharedQueue(FunctionalTester $I)
    {
        $groupId = $this->createGroup($I, 'expiry-queue');
        $this->addMember($I, $groupId, 'member');
        $item = $this->createLinkedItem('expiry');
        $this->claim($I, $item['id'], 'staff');
        $this->request($I, 'POST', 'workflow-claim/handoff', [
            'to_group_id' => $groupId,
        ], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        $this->claim($I, $item['id'], 'member');

        $this->clockNow = '2026-10-22 13:00:00';
        $this->request($I, 'GET', 'workflow-group/group-queue', [], 'member', ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, $this->response($I)['count']);
        Assert::assertNull($this->response($I)['items'][0]['claimed_by']);
        Assert::assertSame($groupId, (int)$this->response($I)['items'][0]['assigned_group']['id']);
        Assert::assertSame(1, $this->eventCount($item['submission_id'], 'claim_expired'));

        $expired = array_values(array_filter($this->notifications, function ($notification) {
            return $notification['event'] === 'claim_expired';
        }));
        Assert::assertNotEmpty($expired);
        Assert::assertSame($this->prefix . 'member', $expired[0]['context']['previous_holder']);
    }

    private function createGroup(FunctionalTester $I, $suffix)
    {
        $name = $this->prefix . $suffix;
        $this->request($I, 'POST', 'workflow-group/admin-groups', [
            'name' => $name,
            'description' => 'Synthetic API-083 group',
        ], 'admin');
        $I->seeResponseCodeIs(201);
        return (int)$this->response($I)['group']['id'];
    }

    private function addMember(FunctionalTester $I, $groupId, $userType)
    {
        $this->request($I, 'POST', 'workflow-group/admin-group-members', [
            'username' => $this->prefix . $userType,
        ], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(201);
    }

    private function claim(FunctionalTester $I, $itemId, $userType)
    {
        $this->request($I, 'POST', 'workflow-claim/claim', [], $userType, ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        return $this->response($I)['item'];
    }

    private function createLinkedItem($suffix)
    {
        $uuid = $this->uuid();
        $courseCode = 'TST 083-' . substr(str_replace('-', '', $uuid), 0, 8);
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => $courseCode,
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id ASC LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'display_order' => 1,
            'material_type_id' => $this->materialTypeId,
            'resource_data' => json_encode(['title' => 'Synthetic API-083 item']),
        ], ['id' => $itemId])->execute();

        \Yii::$app->db->createCommand()->insert('courses', [
            'course_name' => 'Synthetic API-083 course',
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
        return ['submission_id' => $submissionId, 'id' => $itemId];
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

    private function token($userType)
    {
        $username = $this->prefix . $userType;
        $role = $userType === 'admin' ? 'admin' : ($userType === 'faculty' ? 'faculty' : ($userType === 'employee' ? 'employee' : 'staff'));
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'internal_id' => '999083001',
            'full_name' => 'Synthetic API-083 ' . ucfirst($userType),
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertUser($userType, $role)
    {
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $this->prefix . $userType,
            'full_name' => 'Synthetic API-083 ' . ucfirst($userType),
            'email' => $this->prefix . $userType . '@example.test',
            'role' => $role,
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function eventCount($submissionId, $eventType)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :submission_id AND event_type = :event_type',
            [':submission_id' => $submissionId, ':event_type' => $eventType]
        )->queryScalar();
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
        $db->createCommand()->delete('material_types', ['like', 'name', $this->prefix . '%', false])->execute();
        $this->courseIds = [];
    }
}

class Api083NotifierSpy
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
