<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';
require_once __DIR__ . '/../_support/Api116AFixture.php';
require_once __DIR__ . '/../_support/concurrency/ItemWriteConcurrencyWorkerOps.php';

use PHPUnit\Framework\Assert;
use app\services\ItemClaimService;
use app\services\StaffGroupRepository;

/** Covers HTTP and console ownership of individual claim expiry attempts. */
class Api119A4ExpiryOwnersCest extends BaseFunctionalCest
{
    private $restore;
    private $oldCommandClass;
    private $oldExpiryHours;
    private $fixture;
    private $prefix;
    private $now;
    private $tokens = [];
    private $notifications = [];
    private $observer;
    private $groupId;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->restore = Api116B1CommittedConnection::swap();
        $this->oldCommandClass = Yii::$app->db->commandClass;
        Yii::$app->db->commandClass = Api119A4TestCommand::class;
        Api119A4TestCommand::resetHarness();
        $this->prefix = 'test-api119a4c-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        $this->now = time();
        $this->oldExpiryHours = Yii::$app->params['workflowClaimExpiryHours'];
        Yii::$app->params['workflowClaimExpiryHours'] = 72;
        $this->fixture = new Api116AFixture($this->prefix);

        foreach (['staff', 'member', 'admin', 'faculty'] as $role) {
            $this->insertUser($role);
            $this->tokens[$role] = $this->token($role, $role === 'admin' ? 'admin' : ($role === 'faculty' ? 'faculty' : 'staff'));
        }
        $groups = new StaffGroupRepository();
        $this->groupId = $groups->insertGroup([
            'name' => $this->prefix . 'queue',
            'description' => 'Synthetic expiry owner test group',
            'created_by' => $this->username('admin'),
        ]);
        $groups->insertMember($this->groupId, $this->username('member'), $this->username('admin'));

        $case = $this;
        Yii::$container->set(ItemClaimService::class, function ($container = null) use ($case) {
            return new ItemClaimService(
                null,
                null,
                function () use ($case) {
                    return date('Y-m-d H:i:s', $case->now);
                },
                new Api119A4NotifierSpy(function ($event, $context) use ($case) {
                    $committedEvents = null;
                    if ($case->observer !== null && $event === 'claim_expired') {
                        $committedEvents = (int)$case->observer->createCommand(
                            'SELECT COUNT(*) FROM workflow_events WHERE item_kind = :kind AND item_id = :id '
                            . 'AND event_type = "claim_expired"',
                            [':kind' => $context['item_kind'], ':id' => $context['item_id']]
                        )->queryScalar();
                    }
                    $case->notifications[] = [
                        'event' => $event,
                        'context' => $context,
                        'committed_events' => $committedEvents,
                    ];
                })
            );
        });
    }

    public function _after(FunctionalTester $I)
    {
        try {
            if ($this->observer !== null) {
                $this->observer->close();
                $this->observer = null;
            }
            $this->fixture->cleanup();
            if ($this->groupId !== null) {
                Yii::$app->db->createCommand()->delete('staff_group_members', ['group_id' => $this->groupId])->execute();
                Yii::$app->db->createCommand()->delete('staff_groups', ['id' => $this->groupId])->execute();
            }
            Yii::$app->db->createCommand()->delete('users', ['username' => array_map(
                function ($role) {
                    return $this->username($role);
                },
                ['staff', 'member', 'admin', 'faculty']
            )])->execute();
            Yii::$app->params['workflowClaimExpiryHours'] = $this->oldExpiryHours;
            Yii::$container->clear(ItemClaimService::class);
            Yii::$app->get('workflowNotificationQueue')->discard();
            Api119A4TestCommand::resetHarness();
            Yii::$app->db->commandClass = $this->oldCommandClass;
        } finally {
            if ($this->restore !== null) {
                call_user_func($this->restore);
            }
        }
    }

    public function expiryOwnersPropagateHttpContentionSkipDeletedItemsAndContinueInConsole(FunctionalTester $I)
    {
        $httpItem = $this->createExpiredItem('http');
        foreach ([
            ['workflow-claim/queue', 'staff', []],
            ['workflow-claim/my-items', 'staff', []],
            ['workflow-group/my-groups', 'staff', []],
            ['workflow-group/group-queue', 'member', ['id' => $this->groupId]],
        ] as $route) {
            Api119A4TestCommand::failBeforeDiscovery($httpItem['id'], 3);
            $this->request($I, 'GET', $route[0], $route[1], $route[2]);
            $I->seeResponseCodeIs(409);
            $body = $this->response($I);
            Assert::assertSame(['error_code', 'reference'], array_keys($body));
            Assert::assertSame('item_contention', $body['error_code']);
            Assert::assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/', $body['reference']);
            Assert::assertSame(3, Api119A4TestCommand::discoveries());
        }
        Assert::assertSame([], $this->notifications);
        Api119A4TestCommand::resetHarness();
        Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => null,
            'claimed_at' => null,
            'last_activity_at' => date('Y-m-d H:i:s', $this->now),
        ], ['id' => $httpItem['id']])->execute();

        $deleted = $this->createExpiredItem('deleted');
        $service = Yii::$container->get(ItemClaimService::class);
        $candidate = null;
        foreach ($service->expiredClaimCandidates() as $reference) {
            if ($reference['id'] === $deleted['id']) {
                $candidate = $reference;
                break;
            }
        }
        Assert::assertNotNull($candidate);
        Yii::$app->db->createCommand()->delete('submission_new_resources', ['id' => $deleted['id']])->execute();
        Assert::assertFalse($service->expireCandidate($candidate));
        Assert::assertSame([], $this->notifications);

        $ineligible = $this->createExpiredItem('ineligible');
        $ineligibleReferences = array_values(array_filter(
            $service->expiredClaimCandidates(),
            function ($reference) use ($ineligible) {
                return $reference['id'] === $ineligible['id'];
            }
        ));
        $ineligibleRef = $ineligibleReferences[0] ?? null;
        Assert::assertNotNull($ineligibleRef);
        Yii::$app->db->createCommand()->update('faculty_submissions', [
            'status' => 'draft',
        ], ['submission_id' => $ineligible['submission_id']])->execute();
        Yii::$app->response->setStatusCode(200);
        Assert::assertFalse($service->expireCandidate($ineligibleRef));
        Assert::assertSame(200, Yii::$app->response->statusCode);
        Assert::assertSame([], $this->notifications);

        $first = $this->createExpiredItem('console-first');
        $second = $this->createExpiredItem('console-second');
        $references = array_values(array_filter(
            $service->expiredClaimCandidates(),
            function ($reference) use ($first, $second) {
                return in_array($reference['id'], [$first['id'], $second['id']], true);
            }
        ));
        Assert::assertCount(2, $references);
        $failedId = $references[0]['id'];
        $expiredId = $references[1]['id'];
        $consoleService = new class($service, array_merge([$ineligibleRef], $references)) {
            private $service;
            private $references;
            public $attempted = [];
            public function __construct($service, array $references) { $this->service = $service; $this->references = $references; }
            public function expiredClaimCandidates() { return $this->references; }
            public function expireCandidate(array $reference)
            {
                $this->attempted[] = $reference['id'];
                return $this->service->expireCandidate($reference);
            }
        };
        Yii::$container->set(ItemClaimService::class, function () use ($consoleService) { return $consoleService; });
        $this->observer = Api116B1CommittedConnection::open(Yii::$app->db, [PDO::ATTR_CASE => PDO::CASE_NATURAL]);
        $this->notifications = [];
        $originalApp = Yii::$app;
        $originalLogger = Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        Yii::setLogger($logger);
        try {
            $config = \yii\helpers\ArrayHelper::merge(
                require Yii::getAlias('@app/config/console.php'),
                ['components' => ['db' => $originalApp->db]]
            );
            new \yii\console\Application($config);
            Assert::assertTrue(Yii::$app->has('workflowNotificationQueue'));
            Api119A4TestCommand::failBeforeDiscovery($failedId, 3);
            $command = new \app\commands\WorkflowController('workflow', Yii::$app);
            Assert::assertSame(\yii\console\ExitCode::OK, $command->actionExpireClaims());
            Assert::assertSame(3, Api119A4TestCommand::discoveries());
            Assert::assertSame([$ineligible['id'], $failedId, $expiredId], $consoleService->attempted);
        } finally {
            Api119A4TestCommand::resetHarness();
            Yii::$app = $originalApp;
            Yii::setLogger($originalLogger);
        }

        Assert::assertSame($this->username('staff'), $this->claimRow($failedId)['claimed_by']);
        Assert::assertNull($this->claimRow($expiredId)['claimed_by']);
        Assert::assertSame(0, $this->eventCount($failedId));
        Assert::assertSame(1, $this->eventCount($expiredId));
        Assert::assertCount(1, $this->notifications);
        Assert::assertSame('claim_expired', $this->notifications[0]['event']);
        Assert::assertSame(1, $this->notifications[0]['committed_events']);
        Assert::assertNotEmpty(array_filter($logger->messages, function ($message) {
            return strpos($message[0], 'Claim expiry contention reference=') !== false
                && preg_match('/[A-HJ-NP-Z2-9]{6}/', $message[0]);
        }));
    }

    private function createExpiredItem($suffix)
    {
        $item = $this->fixture->createItem($suffix, $this->fixture->createOffering($suffix));
        $expiredAt = date('Y-m-d H:i:s', $this->now - 73 * 3600);
        Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $this->username('staff'),
            'claimed_at' => $expiredAt,
            'last_activity_at' => $expiredAt,
            'item_status' => 'in_progress',
        ], ['id' => $item['id']])->execute();
        return $item;
    }

    private function insertUser($role)
    {
        $username = $this->username($role);
        Yii::$app->db->createCommand()->insert('users', [
            'username' => $username,
            'full_name' => $role === 'staff' ? '' : 'Synthetic ' . $role,
            'email' => $username . '@example.test',
            'role' => $role === 'member' ? 'staff' : $role,
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function token($role, $claimRole)
    {
        $username = $this->username($role);
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $claimRole,
            'id' => $username,
            'internal_id' => '999119040',
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function request(FunctionalTester $I, $method, $route, $role, array $params)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->tokens[$role]);
        $I->sendJsonRequest($method, $route, [], $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function claimRow($id)
    {
        return Yii::$app->db->createCommand(
            'SELECT claimed_by FROM submission_new_resources WHERE id = :id', [':id' => $id]
        )->queryOne();
    }

    private function eventCount($id)
    {
        return (int)Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE item_kind = "new" AND item_id = :id '
            . 'AND event_type = "claim_expired"', [':id' => $id]
        )->queryScalar();
    }

    private function username($role)
    {
        return $this->prefix . $role;
    }
}
