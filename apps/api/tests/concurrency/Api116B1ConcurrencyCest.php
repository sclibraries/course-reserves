<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';

use PHPUnit\Framework\Assert;

/** Harness and database preflight; this file sorts first, so the suite fails closed before any race case runs. */
class Api116B1ConcurrencyCest extends Api116B1ConcurrencyCase
{
    /** The first suite test fails closed when proc_open or framed pipes are unavailable. */
    public function test00PreflightRequiresProcOpenAndARealPipeRoundTrip(ConcurrencyTester $I)
    {
        Assert::assertTrue(function_exists('proc_open'), 'The test image must provide proc_open.');
        $this->supervisor->start('preflight', ['op' => 'preflight']);
        $ready = $this->supervisor->awaitPhase('preflight', 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, $ready['connection_id']);
        $this->supervisor->release('preflight', 'ready', 0);
        $result = $this->supervisor->complete('preflight');
        Assert::assertSame(['round_trip' => true], $result['result']);
        Assert::assertSame(['ready', 'result'], array_column($this->supervisor->history('preflight'), 'phase'));
    }

    /** C7 preflight: next-key locking and immediate deadlock detection are prerequisites of the protocol. */
    public function test01PreflightRequiresRepeatableReadGapLocksAndDeadlockDetection(ConcurrencyTester $I)
    {
        $this->assertGapLockingDatabase();
    }

    public function testHarnessRejectsMalformedFramesMissingResultsAndDeadlines(ConcurrencyTester $I)
    {
        $this->supervisor->start('malformed', ['op' => 'harness_malformed']);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('malformed');
        }, 'Malformed concurrency frame');

        $this->supervisor->start('eof', ['op' => 'harness_eof']);
        $this->supervisor->awaitPhase('eof', 'ready', 0);
        $this->supervisor->release('eof', 'ready', 0);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('eof');
        }, 'EOF before the expected phase');

        $this->supervisor = new PublicationDestinationConcurrencySupervisor(1);
        $this->supervisor->start('deadline', ['op' => 'harness_stall']);
        $this->supervisor->awaitPhase('deadline', 'ready', 0);
        $this->supervisor->release('deadline', 'ready', 0);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('deadline');
        }, 'deadline exceeded');
        Assert::assertTrue($this->supervisor->allReaped());
    }

    public function testSameLoopingStepContextSucceedsOnOnlyOneConnection(ConcurrencyTester $I)
    {
        $item = $this->item('same-step-context');
        $db = \Yii::$app->db;
        $username = 'test-api116b1-step-worker';
        $db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $username,
            'claimed_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
            'last_activity_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
        ], ['id' => $item['id']])->execute();
        $db->createCommand()->insert('flows', [
            'name' => 'Synthetic concurrency loop ' . uniqid(),
            'description' => 'Synthetic API-122B flow',
            'created_by' => $username,
        ])->execute();
        $flowId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $flowId,
            'version' => 1,
            'steps_json' => json_encode([[
                'key' => 'loop', 'kind' => 'question', 'label' => 'Synthetic loop',
                'outcomes' => [['key' => 'again', 'label' => 'Again', 'next' => ['step' => 'loop']]],
            ]]),
            'created_by' => $username,
        ])->execute();
        $db->createCommand()->insert('item_flow_runs', [
            'item_kind' => 'new',
            'item_id' => $item['id'],
            'flow_id' => $flowId,
            'version' => 1,
            'current_step_key' => 'loop',
            'draft_revision' => 1,
            'workflow_revision' => 1,
        ])->execute();
        $runId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('submission_publication_state', [
            'item_kind' => 'new', 'item_id' => $item['id'], 'submission_id' => $item['submission_id'],
            'workflow_revision' => 1,
        ])->execute();

        $request = [
            'kind' => 'new', 'item_id' => $item['id'],
            'actor' => ['username' => $username, 'role' => 'staff'],
            'body' => ['run_id' => $runId, 'result_seq' => 0, 'step_key' => 'loop', 'outcome_key' => 'again'],
            'manifest' => $this->tracker->manifest(),
        ];
        foreach (['step-a', 'step-b'] as $label) {
            $this->supervisor->start($label, ['op' => 'step_result'] + $request);
            $ready[$label] = $this->supervisor->awaitPhase($label, 'ready', 0);
        }
        Assert::assertCount(3, array_unique([
            $this->parentConnectionId, $ready['step-a']['connection_id'], $ready['step-b']['connection_id'],
        ]));
        foreach (['step-a', 'step-b'] as $label) {
            $this->supervisor->release($label, 'ready', 0);
        }
        $results = [
            $this->supervisor->complete('step-a')['result'],
            $this->supervisor->complete('step-b')['result'],
        ];
        $statuses = array_column($results, 'status');
        sort($statuses);
        Assert::assertSame([200, 409], $statuses);
        foreach ($results as $result) {
            if ($result['status'] === 409) {
                Assert::assertSame('stale_step', $result['body']['error_code']);
            }
        }
        Assert::assertSame(1, (int)$db->createCommand(
            'SELECT COUNT(*) FROM item_flow_step_results WHERE run_id = :id', [':id' => $runId]
        )->queryScalar());
    }

    private function expectSupervisorFailure(callable $callback, $message)
    {
        try {
            call_user_func($callback);
            Assert::fail('Expected concurrency harness failure containing: ' . $message);
        } catch (\RuntimeException $exception) {
            Assert::assertNotFalse(strpos($exception->getMessage(), $message), $exception->getMessage());
        }
    }
}
