<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';
require_once __DIR__ . '/../_support/Api119A2ChecklistFixture.php';

use PHPUnit\Framework\Assert;
use app\services\ItemClaimService;
use app\services\Transactional;

class Api119A2ChecklistCest extends BaseFunctionalCest
{
    private $fixture;
    private $prefix;
    private $staffToken;
    private $notifier;
    private $restore;
    private $commandClass;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->restore = Api116B1CommittedConnection::swap();
        $this->prefix = 'test-api119a2-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        $this->fixture = new Api119A2ChecklistFixture($this->prefix);
        $this->staffToken = $this->token();
        $this->notifier = new Api119A2NotifierSpy();
        $notifier = $this->notifier;
        \Yii::$container->set(ItemClaimService::class, function () use ($notifier) {
            return new ItemClaimService(null, null, function () {
                return '2026-11-17 12:00:00';
            }, $notifier);
        });
        \Yii::$app->get('workflowNotificationQueue')->discard();
        $this->commandClass = \Yii::$app->db->commandClass;
        \Yii::$app->db->commandClass = Api119A2FailingCommand::class;
        Api119A2FailingCommand::clearConfiguration();
    }

    public function _after(FunctionalTester $I)
    {
        Api119A2FailingCommand::clearConfiguration();
        \Yii::$app->db->commandClass = $this->commandClass;
        \Yii::$app->get('workflowNotificationQueue')->discard();
        $this->fixture->cleanup();
        \Yii::$container->clear(ItemClaimService::class);
        call_user_func($this->restore);
    }

    public function checklistWritesUseCurrentRowsAndRollbackPersistenceFailures(FunctionalTester $I)
    {
        $first = $this->fixture->submission('first');
        $second = $this->fixture->submission('second');
        $template = $this->fixture->template([false, true]);
        $checklist = $this->fixture->checklist($first['item_id'], $template);
        $before = $this->fixture->snapshot($first['item_id']);

        $this->request($I, 'PATCH', 'checklist/update-task', ['notes' => 'wrong item'], [
            'itemId' => $second['item_id'], 'taskId' => $checklist['task_ids'][0],
        ]);
        $I->seeResponseCodeIs(404);
        Assert::assertSame($before, $this->fixture->snapshot($first['item_id']));

        $this->request($I, 'POST', 'checklist/assign-checklist', ['template_id' => $template['id']], [
            'itemId' => 999999999,
        ]);
        $I->seeResponseCodeIs(404);
        $this->request($I, 'PATCH', 'checklist/update-task', [], [
            'itemId' => $first['item_id'], 'taskId' => 999999999,
        ]);
        $I->seeResponseCodeIs(404);
        $this->request($I, 'POST', 'checklist/complete-checklist', [], ['itemId' => $second['item_id']]);
        $I->seeResponseCodeIs(404);

        $this->request($I, 'POST', 'checklist/complete-checklist', [], ['itemId' => $first['item_id']]);
        $I->seeResponseCodeIs(400);
        Assert::assertSame($before, $this->fixture->snapshot($first['item_id']));

        Api119A2FailingCommand::resetQueries();
        $this->request($I, 'PATCH', 'checklist/update-task', [
            'completed' => true,
        ], ['itemId' => $first['item_id'], 'taskId' => $checklist['task_ids'][0]]);
        $I->seeResponseCodeIs(200);
        $this->fixture->assertChecklistLockOrder();

        $this->request($I, 'PATCH', 'checklist/update-task', [
            'completed' => false, 'notes' => 'Synthetic uncompletion note',
        ], ['itemId' => $first['item_id'], 'taskId' => $checklist['task_ids'][0]]);
        $I->seeResponseCodeIs(200);
        Assert::assertFalse($this->response($I)['task']['completed']);
        Assert::assertNull($this->response($I)['task']['completed_at']);
        Assert::assertNull($this->response($I)['task']['completed_by']);
        Assert::assertSame('Synthetic uncompletion note', $this->response($I)['task']['notes']);

        $this->request($I, 'POST', 'checklist/complete-checklist', [], ['itemId' => $first['item_id']]);
        $I->seeResponseCodeIs(400);
        $this->request($I, 'PATCH', 'checklist/update-task', [
            'completed' => true,
        ], ['itemId' => $first['item_id'], 'taskId' => $checklist['task_ids'][0]]);
        $I->seeResponseCodeIs(200);
        $this->request($I, 'POST', 'checklist/complete-checklist', [], ['itemId' => $first['item_id']]);
        $I->seeResponseCodeIs(200);
        $after = $this->fixture->snapshot($first['item_id']);
        Assert::assertSame([1, 1], array_map('intval', array_column($after['tasks'], 'completed')));

        $claimClearFailure = $this->fixture->submission('claim-clear-failure');
        $claimTemplate = $this->fixture->template([false]);
        $claimChecklist = $this->fixture->checklist($claimClearFailure['item_id'], $claimTemplate);
        \Yii::$app->db->createCommand()->update('item_checklist_tasks', [
            'completed' => 1,
            'completed_at' => '2026-11-17 11:00:00',
            'completed_by' => '999119021',
        ], ['id' => $claimChecklist['task_ids'][0]])->execute();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $this->prefix . 'staff',
            'claimed_at' => '2026-11-17 11:59:00',
            'last_activity_at' => '2026-11-17 11:59:00',
        ], ['id' => $claimClearFailure['item_id']])->execute();
        $before = $this->fixture->snapshot($claimClearFailure['item_id']);
        $notifier = $this->notifier;
        \Yii::$container->set(ItemClaimService::class, function () use ($notifier) {
            $repository = new class extends \app\services\ItemClaimRepository {
                public function clearClaimForChecklistCompletion($kind, $id, $now)
                {
                    return 0;
                }
            };
            return new ItemClaimService($repository, null, function () {
                return '2026-11-17 12:00:00';
            }, $notifier);
        });
        try {
            $this->request($I, 'POST', 'checklist/complete-checklist', [], [
                'itemId' => $claimClearFailure['item_id'],
            ]);
            Assert::fail('Expected the failed claim release to abort completion.');
        } catch (\RuntimeException $exception) {
            Assert::assertSame('Failed to release claim for checklist completion.', $exception->getMessage());
        }
        Assert::assertSame($before, $this->fixture->snapshot($claimClearFailure['item_id']));
        Assert::assertSame([], $this->notifier->notifications);

        $failure = $this->fixture->submission('persistence-failure');
        $failureTemplate = $this->fixture->template([false]);
        $failureChecklist = $this->fixture->checklist($failure['item_id'], $failureTemplate);
        $this->fixture->expireClaim($failure['item_id']);
        $before = $this->fixture->snapshot($failure['item_id']);
        Api119A2FailingCommand::failNext('/SELECT .*FROM `?checklist_template_tasks`?/i');
        try {
            $this->request($I, 'PATCH', 'checklist/update-task', [
                'completed' => true,
            ], ['itemId' => $failure['item_id'], 'taskId' => $failureChecklist['task_ids'][0]]);
            Assert::fail('Expected the synthetic response read to fail.');
        } catch (\RuntimeException $exception) {
            Assert::assertSame('Synthetic persistence failure.', $exception->getMessage());
        }
        Assert::assertSame(0, Api119A2FailingCommand::remaining());
        Assert::assertSame($before, $this->fixture->snapshot($failure['item_id']));
        Assert::assertSame([], $this->notifier->notifications);
    }

    public function checklistHttpWritesRetryAndExhaustWithCommittedEffectsOnly(FunctionalTester $I)
    {
        $completionRollback = $this->fixture->submission('completion-outer-rollback');
        $completionTemplate = $this->fixture->template([false]);
        $completionChecklist = $this->fixture->checklist($completionRollback['item_id'], $completionTemplate);
        \Yii::$app->db->createCommand()->update('item_checklist_tasks', [
            'completed' => 1,
            'completed_at' => '2026-11-17 11:00:00',
            'completed_by' => '999119021',
        ], ['id' => $completionChecklist['task_ids'][0]])->execute();
        $this->fixture->expireClaim($completionRollback['item_id']);
        $before = $this->fixture->snapshot($completionRollback['item_id']);
        try {
            Transactional::retrying(function () use ($I, $completionRollback) {
                $this->request($I, 'POST', 'checklist/complete-checklist', [], [
                    'itemId' => $completionRollback['item_id'],
                ]);
                $I->seeResponseCodeIs(200);
                throw new \RuntimeException('Synthetic completion rollback.');
            });
            Assert::fail('Expected the outer completion transaction to roll back.');
        } catch (\RuntimeException $exception) {
            Assert::assertSame('Synthetic completion rollback.', $exception->getMessage());
        }
        Assert::assertSame($before, $this->fixture->snapshot($completionRollback['item_id']));
        Assert::assertSame([], $this->notifier->notifications);

        foreach (['assign', 'update', 'complete'] as $operation) {
            $item = $this->fixture->submission($operation . '-retry');
            $template = $this->fixture->template([true]);
            $checklist = $operation === 'assign' ? null : $this->fixture->checklist($item['item_id'], $template);
            $taskId = $checklist ? $checklist['task_ids'][0] : null;
            if ($operation !== 'assign') {
                $this->fixture->expireClaim($item['item_id']);
            }
            Api119A2FailingCommand::failNext($this->fixture->writePattern($operation), 2, true);
            $this->requestOperation($I, $operation, $item['item_id'], $template['id'], $taskId);
            $I->seeResponseCodeIs(200);
            Assert::assertSame(2, Api119A2FailingCommand::matches());
            if ($operation === 'assign') {
                Assert::assertSame('999119021', $this->response($I)['assigned_by']);
            }
            if ($operation !== 'assign') {
                Assert::assertCount(1, $this->notifier->notifications);
                Assert::assertSame(1, $this->fixture->eventCount($item['item_id'], 'claim_expired'));
                $this->notifier->notifications = [];
            }

            $exhausted = $this->fixture->submission($operation . '-exhausted');
            $exhaustedTemplate = $this->fixture->template([true]);
            $exhaustedChecklist = $operation === 'assign'
                ? null : $this->fixture->checklist($exhausted['item_id'], $exhaustedTemplate);
            if ($operation !== 'assign') {
                $this->fixture->expireClaim($exhausted['item_id']);
            }
            $before = $this->fixture->snapshot($exhausted['item_id']);
            Api119A2FailingCommand::failNext($this->fixture->writePattern($operation), 3, true);
            $this->requestOperation(
                $I,
                $operation,
                $exhausted['item_id'],
                $exhaustedTemplate['id'],
                $exhaustedChecklist ? $exhaustedChecklist['task_ids'][0] : null
            );
            $I->seeResponseCodeIs(409);
            $body = $this->response($I);
            Assert::assertSame(['error_code', 'reference'], array_keys($body));
            Assert::assertSame('item_contention', $body['error_code']);
            Assert::assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/', $body['reference']);
            Assert::assertSame(3, Api119A2FailingCommand::matches());
            Assert::assertSame($before, $this->fixture->snapshot($exhausted['item_id']));
            Assert::assertSame([], $this->notifier->notifications);
        }

        $rollback = $this->fixture->submission('outer-rollback');
        $template = $this->fixture->template([true]);
        $checklist = $this->fixture->checklist($rollback['item_id'], $template);
        $this->fixture->expireClaim($rollback['item_id']);
        $before = $this->fixture->snapshot($rollback['item_id']);
        try {
            Transactional::retrying(function () use ($I, $rollback, $checklist) {
                $this->request($I, 'PATCH', 'checklist/update-task', ['completed' => true], [
                    'itemId' => $rollback['item_id'], 'taskId' => $checklist['task_ids'][0],
                ]);
                $I->seeResponseCodeIs(200);
                throw new \RuntimeException('Synthetic outer rollback.');
            });
            Assert::fail('Expected the outer write transaction to roll back.');
        } catch (\RuntimeException $exception) {
            Assert::assertSame('Synthetic outer rollback.', $exception->getMessage());
        }
        Assert::assertSame($before, $this->fixture->snapshot($rollback['item_id']));
        Assert::assertSame([], $this->notifier->notifications);
    }

    private function requestOperation(FunctionalTester $I, $operation, $itemId, $templateId, $taskId)
    {
        if ($operation === 'assign') {
            $this->request($I, 'POST', 'checklist/assign-checklist', ['template_id' => $templateId], [
                'itemId' => $itemId,
            ]);
        } elseif ($operation === 'update') {
            $this->request($I, 'PATCH', 'checklist/update-task', ['notes' => 'Synthetic retry'], [
                'itemId' => $itemId, 'taskId' => $taskId,
            ]);
        } else {
            $this->request($I, 'POST', 'checklist/complete-checklist', [], ['itemId' => $itemId]);
        }
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, array $params)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->staffToken);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function token()
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $this->prefix . 'staff',
            'role' => 'staff',
            'id' => '999119021',
            'internal_id' => '999119021',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

}
