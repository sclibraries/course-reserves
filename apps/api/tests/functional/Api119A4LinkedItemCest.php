<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';
require_once __DIR__ . '/../_support/TestSubmissionFixture.php';
require_once __DIR__ . '/../_support/concurrency/ItemWriteConcurrencyWorkerOps.php';

use PHPUnit\Framework\Assert;
use app\services\FlowRunner;
use app\services\ItemClaimService;
use app\services\SubmittedSubmissionScope;
use app\services\Transactional;

/** Covers retry ownership, nested notices, per-attempt target/input reads, and response wiring. */
class Api119A4LinkedItemCest extends BaseFunctionalCest
{
    use Api119A4LinkedItemFixtureSupport;

    private $prefix;
    private $restoreDb;
    private $oldCommandClass;
    private $usernames = [];
    private $submissionUuids = [];
    private $flowIds = [];
    private $groupId;
    private $groupName;
    private $staffToken;
    private $notifications = [];
    private $observer;
    private $clockCalls = 0;
    private $oldAccessPathMappings = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->restoreDb = Api116B1CommittedConnection::swap();
        $this->oldCommandClass = Yii::$app->db->commandClass;
        Yii::$app->db->commandClass = Api119A4TestCommand::class;
        $this->prefix = 'test-api119a4b-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        Api119A4TestCommand::resetHarness();

        foreach (['staff', 'target', 'member'] as $role) {
            $this->insertUser($role);
        }
        $this->staffToken = $this->token('staff');
        $this->groupName = $this->prefix . 'group';
        $this->groupId = $this->createGroup();
        $db = Yii::$app->db;
        $this->oldAccessPathMappings = $db->createCommand(
            'SELECT access_path, flow_id, group_id FROM access_path_flows WHERE access_path = "purchase"'
        )->queryAll();

        $case = $this;
        Yii::$container->clear(ItemClaimService::class);
        Yii::$container->set(ItemClaimService::class, function () use ($case) {
            return new ItemClaimService(
                null,
                null,
                function () use ($case) {
                    $case->clockCalls++;
                    return '2026-10-19 12:00:00';
                },
                new Api119A4NotifierSpy(function ($event, $context) use ($case) {
                    $visible = null;
                    if ($case->observer !== null && $event === 'group_handoff') {
                        $visible = (int)$case->observer->createCommand(
                            'SELECT COUNT(*) FROM workflow_events WHERE item_kind = :kind AND item_id = :id '
                            . 'AND event_type = "group_handoff"',
                            [':kind' => $context['item_kind'], ':id' => $context['item_id']]
                        )->queryScalar();
                    }
                    $case->notifications[] = [
                        'event' => $event,
                        'context' => $context,
                        'committed_group_events' => $visible,
                    ];
                })
            );
        });
    }

    public function _after(FunctionalTester $I)
    {
        Yii::$container->clear(ItemClaimService::class);
        if (Yii::$app->has('workflowNotificationQueue')) {
            Yii::$app->get('workflowNotificationQueue')->discard();
        }
        if ($this->observer !== null) {
            $this->observer->close();
            $this->observer = null;
        }
        Api119A4TestCommand::resetHarness();
        Yii::$app->db->commandClass = $this->oldCommandClass;
        $this->cleanup();
        call_user_func($this->restoreDb);
    }

    public function submittedScopeKeepsItsPureRuleAndHttpConflictBehavior(FunctionalTester $I)
    {
        $scope = new SubmittedSubmissionScope();
        $originalStatus = Yii::$app->response->statusCode;
        try {
            Yii::$app->response->setStatusCode(200);
            Assert::assertSame(['error_code' => 'submission_not_submitted'], $scope->blockedBodyForStatus('draft'));
            Assert::assertSame(200, Yii::$app->response->statusCode);
            Assert::assertSame(['error_code' => 'submission_not_submitted'], $scope->guardStatus('draft'));
            Assert::assertSame(409, Yii::$app->response->statusCode);
        } finally {
            Yii::$app->response->setStatusCode($originalStatus);
        }
    }

    public function linkedCallersRetryAndKeepTheContentionEnvelope(FunctionalTester $I)
    {
        $item = $this->createItem('routes');
        $flowId = $this->createFlow();
        $params = ['kind' => 'new', 'id' => $item['id']];
        $routes = [
            ['POST', 'workflow-claim/claim', [], $params],
            ['POST', 'workflow-claim/release', [], $params],
            ['POST', 'workflow-claim/handoff', ['to_username' => $this->username('target')], $params],
            ['POST', 'workflow-claim/handoff', ['to_group_id' => $this->groupId], $params],
            ['POST', 'workflow-claim/takeover', ['reason' => 'Synthetic takeover'], $params],
            ['GET', 'workflow-claim/timeline', [], $params],
            ['GET', 'workflow-flow/item-flow', [], $params],
            ['POST', 'workflow-flow/step-result', [
                'run_id' => 1, 'result_seq' => 0, 'step_key' => 'start', 'outcome_key' => 'route',
            ], $params],
            ['POST', 'workflow-flow/switch-flow', [
                'flow_id' => $flowId, 'reason' => 'Synthetic switch',
            ], $params],
            ['POST', 'workflow-flow/access-path', ['access_path' => 'purchase'], $params],
            ['GET', 'workflow-publication/state', [], $params],
            ['GET', 'workflow-publication/projection', [], $params],
            ['POST', 'workflow-publication/refresh-copy-inputs', [], $params],
            ['POST', 'workflow-publication/ready', ['reason' => 'Synthetic ready'], $params],
            ['PUT', 'workflow-item-details/update', ['public_note' => 'Synthetic note'], $params],
            ['PUT', 'submission-workflow/update-item', ['item_status' => 'pending'], ['itemId' => $item['id']]],
        ];

        foreach ($routes as $route) {
            Api119A4TestCommand::failBeforeDiscovery($item['id'], 3);
            $this->request($I, $route[0], $route[1], $route[2], $route[3]);
            $I->seeResponseCodeIs(409);
            $body = $this->response($I);
            Assert::assertSame('item_contention', $body['error_code']);
            Assert::assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/', $body['reference']);
            Assert::assertSame(3, Api119A4TestCommand::discoveries());
        }

        $personItem = $this->createItem('person-handoff');
        $this->claimItem($I, $personItem['id']);
        Api119A4TestCommand::failAfterQuery(
            '/FROM users(?:\\s+claimant)? WHERE (?:claimant\\.)?username = ["\']?'
                . preg_quote($this->username('target'), '/') . '["\']?/i',
            1
        );
        $this->request($I, 'POST', 'workflow-claim/handoff', [
            'to_username' => $this->username('target'),
        ], ['kind' => 'new', 'id' => $personItem['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(2, Api119A4TestCommand::afterMatches());
        Assert::assertSame(1, count($this->notifications));
        Assert::assertSame('claim_handed_off', $this->notifications[0]['event']);

        $groupItem = $this->createItem('group-handoff');
        $this->claimItem($I, $groupItem['id']);
        Api119A4TestCommand::failAfterQuery(
            '/SELECT username FROM staff_group_members WHERE group_id = ' . $this->groupId . '/i',
            1
        );
        $this->request($I, 'POST', 'workflow-claim/handoff', [
            'to_group_id' => $this->groupId,
        ], ['kind' => 'new', 'id' => $groupItem['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(2, Api119A4TestCommand::afterMatches());
        Assert::assertSame(3, count($this->notifications));

        $detailsItem = $this->createItem('material-type');
        $this->clockCalls = 0;
        Api119A4TestCommand::failAfterQuery('/FROM `?material_types`? WHERE `?material_type_id`?\s*=\s*999999/i', 1);
        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'effective_material_type_id' => 999999,
        ], ['kind' => 'new', 'id' => $detailsItem['id']]);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('invalid_item_detail', $this->response($I)['error_code']);
        Assert::assertSame(2, Api119A4TestCommand::afterMatches());
        Assert::assertSame(2, $this->clockCalls);
    }

    public function nestedStepAndAccessPathHandoffsWaitForTheirOwner(FunctionalTester $I)
    {
        $item = $this->createItem('nested-handoff');
        $flowId = $this->createHandoffFlow();
        $this->claimItem($I, $item['id']);
        Api119A4TestCommand::resetHarness();
        $this->request($I, 'POST', 'workflow-flow/switch-flow', [
            'flow_id' => $flowId, 'reason' => 'Synthetic setup',
        ], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        $flowLock = $this->queryIndex('/SELECT \* FROM flows WHERE id = ' . $flowId . ' LIMIT 1 FOR UPDATE/i');
        $runLock = $this->queryIndex('/FROM item_flow_runs(?: r)? .*FOR UPDATE/i');
        Assert::assertGreaterThanOrEqual(0, $flowLock);
        Assert::assertGreaterThan($flowLock, $runLock, 'Switching locks the target flow before run enrichment.');
        $runId = (int)Yii::$app->db->createCommand(
            'SELECT id FROM item_flow_runs WHERE item_kind = "new" AND item_id = :id ORDER BY id DESC LIMIT 1',
            [':id' => $item['id']]
        )->queryScalar();

        $this->observer = Api116B1CommittedConnection::open(Yii::$app->db, [PDO::ATTR_CASE => PDO::CASE_NATURAL]);
        $this->notifications = [];
        Api119A4TestCommand::resetHarness();
        $status = $this->request($I, 'POST', 'workflow-flow/step-result', [
            'run_id' => $runId, 'result_seq' => 0, 'step_key' => 'start', 'outcome_key' => 'route',
        ], ['kind' => 'new', 'id' => $item['id']]);
        Assert::assertSame(200, $status);
        Assert::assertCount(2, $this->notifications);
        Assert::assertSame([1, 1], array_column($this->notifications, 'committed_group_events'));
        Assert::assertSame(1, $this->observerEventCount($item['id'], 'group_handoff'));

        $this->claimItem($I, $item['id']);
        $this->notifications = [];
        Api119A4TestCommand::failBeforeDiscovery($item['id'], 1);
        $status = $this->request($I, 'POST', 'workflow-flow/step-result', [
            'run_id' => $runId, 'result_seq' => 1, 'step_key' => 'start', 'outcome_key' => 'route',
        ], ['kind' => 'new', 'id' => $item['id']]);
        Assert::assertSame(200, $status);
        Assert::assertSame(3, Api119A4TestCommand::discoveries());
        Assert::assertCount(2, $this->notifications);
        Assert::assertSame([2, 2], array_column($this->notifications, 'committed_group_events'));

        $this->claimItem($I, $item['id']);
        $this->mapPurchasePath($flowId);
        $this->notifications = [];
        $mappingQuery = '/SELECT access_path, flow_id, group_id FROM access_path_flows WHERE access_path = .*purchase.*LIMIT 1/i';
        Api119A4TestCommand::failAfterQuery($mappingQuery, 1);
        $status = $this->request($I, 'POST', 'workflow-flow/access-path', [
            'access_path' => 'purchase',
        ], ['kind' => 'new', 'id' => $item['id']]);
        Assert::assertSame(200, $status);
        Assert::assertSame(2, Api119A4TestCommand::afterMatches());
        Assert::assertSame(2, Api119A4TestCommand::countQueries($mappingQuery));
        $flowLock = $this->queryIndex('/SELECT \* FROM flows WHERE id = ' . $flowId . ' LIMIT 1 FOR UPDATE/i');
        $runLock = $this->queryIndex('/FROM item_flow_runs(?: r)? .*FOR UPDATE/i');
        Assert::assertGreaterThanOrEqual(0, $flowLock);
        Assert::assertGreaterThan($flowLock, $runLock, 'Access-path mapping locks its target flow before run enrichment.');
        Assert::assertCount(2, $this->notifications);
        Assert::assertSame([3, 3], array_column($this->notifications, 'committed_group_events'));

        $this->claimItem($I, $item['id']);
        $rollbackFlow = $this->createHandoffFlow();
        $status = $this->request($I, 'POST', 'workflow-flow/switch-flow', [
            'flow_id' => $rollbackFlow, 'reason' => 'Synthetic rollback setup',
        ], ['kind' => 'new', 'id' => $item['id']]);
        Assert::assertSame(200, $status);
        $runId = (int)Yii::$app->db->createCommand(
            'SELECT id FROM item_flow_runs WHERE item_kind = "new" AND item_id = :id ORDER BY id DESC LIMIT 1',
            [':id' => $item['id']]
        )->queryScalar();
        $sentBeforeRollback = count($this->notifications);
        $result = Transactional::retrying(function ($transaction) use ($item, $runId) {
            $result = Yii::$container->get(FlowRunner::class)->stepResult(
                'new', $item['id'], ['username' => $this->username('staff'), 'role' => 'staff'], [
                    'run_id' => $runId, 'result_seq' => 0, 'step_key' => 'start', 'outcome_key' => 'route',
                ]
            );
            $transaction->rollBack();
            return $result;
        });
        Assert::assertSame(200, $result['status']);
        Assert::assertSame($sentBeforeRollback, count($this->notifications));
        Assert::assertSame(3, $this->observerEventCount($item['id'], 'group_handoff'));
        Assert::assertSame(2, $this->observerEventCount($item['id'], 'step_result'));

        Api119A4TestCommand::failBeforeDiscovery($item['id'], 3);
        $this->request($I, 'POST', 'workflow-flow/step-result', [
            'run_id' => $runId, 'result_seq' => 0, 'step_key' => 'start', 'outcome_key' => 'route',
        ], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(409);
        $body = $this->response($I);
        Assert::assertSame('item_contention', $body['error_code']);
        Assert::assertSame(3, Api119A4TestCommand::discoveries());
        Assert::assertSame($sentBeforeRollback, count($this->notifications));
        Assert::assertSame(3, $this->observerEventCount($item['id'], 'group_handoff'));
    }


}
