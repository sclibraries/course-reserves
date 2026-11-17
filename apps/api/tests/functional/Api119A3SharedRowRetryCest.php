<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';
require_once __DIR__ . '/../_support/Api119A3MutationCommand.php';
require_once __DIR__ . '/../_support/concurrency/PublicationDestinationConcurrencyCommand.php';
require_once __DIR__ . '/../_support/concurrency/SharedRowConcurrencyWorkerOps.php';

use PHPUnit\Framework\Assert;
use app\services\ItemClaimService;

class Api119A3SharedRowRetryCest extends BaseFunctionalCest
{
    use Api119A3MutationRequestSupport, Api119A3CurrentStateFixtureSupport;

    private $prefix;
    private $restore;
    private $commandClass;
    private $uuids = [];
    private $resourceIds = [];
    private $flowIds = [];
    private $itemIds = [];
    private $savedMaterialMappings;
    private $savedAccessMappings;
    private $staffToken;
    private $adminToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->restore = Api116B1CommittedConnection::swap();
        $this->prefix = 'test-api119a3-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        $db = \Yii::$app->db;
        $this->savedMaterialMappings = $db->createCommand(
            'SELECT material_type_id, flow_id FROM material_type_flows ORDER BY material_type_id'
        )->queryAll();
        $this->savedAccessMappings = $db->createCommand(
            'SELECT access_path, flow_id, group_id FROM access_path_flows ORDER BY access_path'
        )->queryAll();
        $this->staffToken = $this->token('staff');
        $this->adminToken = $this->token('admin');
        $this->commandClass = $db->commandClass;
        $db->commandClass = Api119A3MutationCommand::class;
        Api119A3MutationCommand::clearConfiguration();
        \Yii::$app->get('workflowNotificationQueue')->discard();
        \Yii::$container->set(ItemClaimService::class, function () {
            return new ItemClaimService(null, null, function () {
                return '2026-11-17 12:00:00';
            });
        });
    }

    public function _after(FunctionalTester $I)
    {
        Api119A3MutationCommand::clearConfiguration();
        \Yii::$app->db->commandClass = $this->commandClass;
        \Yii::$app->get('workflowNotificationQueue')->discard();
        $this->cleanup();
        \Yii::$container->clear(ItemClaimService::class);
        call_user_func($this->restore);
    }

    public function eightDirectWriterRoutesRetryAndExhaustAtomically(FunctionalTester $I)
    {
        foreach ([
            'resource-update', 'resource-add-link', 'resource-delete-link', 'resource-delete',
            'material-map', 'access-map', 'flow-version', 'switch-flow',
        ] as $operation) {
            $case = $this->writerCase($I, $operation);
            $this->assertRetriedWriter($I, $operation, $case);

            $case = $this->writerCase($I, $operation);
            $before = $this->writerSnapshot($operation, $case);
            Api119A3MutationCommand::failNext($case['failure_pattern'], 3);
            $this->send($I, $case);
            $I->seeResponseCodeIs(409);
            $body = $this->response($I);
            Assert::assertSame(['error_code', 'reference'], array_keys($body));
            Assert::assertSame('item_contention', $body['error_code']);
            Assert::assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/', $body['reference']);
            Assert::assertSame(3, Api119A3MutationCommand::matches(), $operation);
            Assert::assertSame($before, $this->writerSnapshot($operation, $case), $operation);
            Api119A3MutationCommand::clearConfiguration();
        }
    }

    public function mappingAndSwitchRetriesUseCurrentCommittedState(FunctionalTester $I)
    {
        $materialTypeId = $this->materialTypeId();
        $oldFlow = $this->flow('mapping-old');
        $targetFlow = $this->flow('mapping-target');
        $item = $this->item('mapping-current', $materialTypeId);
        $this->publicationState($item);
        $this->setMaterialFlow($materialTypeId, $oldFlow);
        $mapping = $this->materialMapping($materialTypeId, $targetFlow);
        Api119A3MutationCommand::failNext(
            '/INSERT INTO `?workflow_events`?/i',
            1,
            function () use ($materialTypeId, $targetFlow) {
                $this->setMaterialFlow($materialTypeId, $targetFlow);
            }
        );
        $this->request($I, 'PUT', 'workflow-flow-admin/mapping', ['mapping' => $mapping], 'admin');
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, Api119A3MutationCommand::matches());
        Assert::assertSame('ready', $this->publication($item)['state']);
        Assert::assertSame($targetFlow, (int)$this->materialFlow($materialTypeId));
        Api119A3MutationCommand::clearConfiguration();

        $targetFlow = $this->flow('access-target');
        $item = $this->item('access-current', null, null, 'purchase');
        $this->publicationState($item);
        $accessMapping = $this->accessMapping('purchase', $targetFlow);
        Api119A3MutationCommand::failNext(
            '/INSERT INTO `?workflow_events`?/i',
            1,
            function () use ($accessMapping) {
                $this->replaceAccessMappings($accessMapping);
            }
        );
        $this->request($I, 'PUT', 'workflow-flow-admin/access-path-mapping', [
            'mapping' => $accessMapping,
        ], 'admin');
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, Api119A3MutationCommand::matches());
        Assert::assertSame('ready', $this->publication($item)['state']);
        Assert::assertSame($targetFlow, (int)$this->accessFlow('purchase'));
        Api119A3MutationCommand::clearConfiguration();

        $item = $this->item('latest-version');
        $flowId = $this->flow('latest-target');
        $this->claim($item['id']);
        $steps = $this->steps('Version two');
        Api119A3MutationCommand::failNext(
            '/INSERT INTO `?workflow_events`?/i',
            1,
            function () use ($flowId, $steps) {
                \Yii::$app->db->createCommand()->insert('flow_versions', [
                    'flow_id' => $flowId,
                    'version' => 2,
                    'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES),
                    'created_by' => $this->prefix . 'admin',
                ])->execute();
            }
        );
        $this->request($I, 'POST', 'workflow-flow/switch-flow', [
            'flow_id' => $flowId, 'reason' => 'Synthetic retry after latest version changed',
        ], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, Api119A3MutationCommand::matches());
        Assert::assertSame(2, (int)$this->latestRun($item['id'])['version']);
    }

    public function switchExpiryNotificationFollowsCommittedRetryAndRollback(FunctionalTester $I)
    {
        $observer = Api116B1CommittedConnection::open(\Yii::$app->db, [\PDO::ATTR_CASE => \PDO::CASE_NATURAL]);
        $notifier = new class($observer) {
            public $notifications = [];
            public $committedState = [];

            private $db;

            public function __construct($db)
            {
                $this->db = $db;
            }

            public function notify($eventType, array $context)
            {
                $this->notifications[] = [$eventType, $context];
                $this->committedState[] = [
                    'claim' => $this->db->createCommand(
                        'SELECT claimed_by FROM submission_new_resources WHERE id = :id',
                        [':id' => $context['item_id']]
                    )->queryScalar(),
                    'events' => (int)$this->db->createCommand(
                        'SELECT COUNT(*) FROM workflow_events WHERE item_id = :id AND event_type = "claim_expired"',
                        [':id' => $context['item_id']]
                    )->queryScalar(),
                ];
            }
        };
        \Yii::$container->set(ItemClaimService::class, function () use ($notifier) {
            return new ItemClaimService(null, null, function () {
                return '2026-11-17 12:00:00';
            }, $notifier);
        });

        try {
            $item = $this->item('expired-claim');
            $flowId = $this->flow('expired-target');
            $this->expireClaim($item['id'], $this->prefix . 'former-staff');
            Api119A3MutationCommand::failNext('/INSERT INTO `?workflow_events`?/i', 2);
            $this->request($I, 'POST', 'workflow-flow/switch-flow', [
                'flow_id' => $flowId, 'reason' => 'Synthetic expired claim',
            ], 'staff', ['kind' => 'new', 'id' => $item['id']]);
            $I->seeResponseCodeIs(409);
            Assert::assertSame('not_claimed_by_you', $this->response($I)['error_code']);
            Assert::assertSame(2, Api119A3MutationCommand::matches());
            Assert::assertSame(1, count($notifier->notifications));
            Assert::assertSame('claim_expired', $notifier->notifications[0][0]);
            Assert::assertSame([['claim' => null, 'events' => 1]], $notifier->committedState);
            Assert::assertNull($this->itemRow($item['id'])['claimed_by']);

            Api119A3MutationCommand::clearConfiguration();
            $rejected = $this->item('rollback-rejection');
            $this->claim($rejected['id']);
            $this->request($I, 'POST', 'workflow-flow/switch-flow', [
                'flow_id' => 999999999, 'reason' => 'Synthetic invalid target',
            ], 'staff', ['kind' => 'new', 'id' => $rejected['id']]);
            $I->seeResponseCodeIs(404);
            Assert::assertSame('unknown_flow', $this->response($I)['error_code']);
            Assert::assertSame($this->prefix . 'staff', $this->itemRow($rejected['id'])['claimed_by']);
            Assert::assertSame(1, count($notifier->notifications));
        } finally {
            $observer->close();
        }
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function token($role)
    {
        $username = $this->prefix . $role;
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1, 'exp' => time() + 3600, 'username' => $username,
            'role' => $role, 'id' => $username, 'internal_id' => '999119031',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
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
        if (!$db->isActive) {
            $db->open();
        }
        $db->createCommand()->delete('material_type_flows')->execute();
        foreach ($this->savedMaterialMappings ?: [] as $row) {
            $db->createCommand()->insert('material_type_flows', $row)->execute();
        }
        $db->createCommand()->delete('access_path_flows')->execute();
        foreach ($this->savedAccessMappings ?: [] as $row) {
            $db->createCommand()->insert('access_path_flows', $row)->execute();
        }
        $db->createCommand('DELETE FROM workflow_events WHERE actor_username LIKE :prefix', [
            ':prefix' => $this->prefix . '%',
        ])->execute();
        foreach ($this->itemIds as $itemId) {
            $db->createCommand()->delete('item_flow_runs', ['item_kind' => 'new', 'item_id' => $itemId])->execute();
        }
        foreach ($this->uuids as $uuid) {
            TestSubmissionFixture::delete($uuid);
        }
        foreach ($this->resourceIds as $resourceId) {
            $db->createCommand()->delete('resource_metadata', ['resource_id' => $resourceId])->execute();
            $db->createCommand()->delete('resource_links', ['resource_id' => $resourceId])->execute();
            $db->createCommand()->delete('course_resources', ['resource_id' => $resourceId])->execute();
            $db->createCommand()->delete('resources', ['resource_id' => $resourceId])->execute();
        }
        foreach ($this->flowIds as $flowId) {
            $db->createCommand()->delete('flow_versions', ['flow_id' => $flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $flowId])->execute();
        }
    }
}
