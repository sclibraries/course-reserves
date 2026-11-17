<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;

class Api122StepResultContextCest extends Api109FunctionalCest
{
    private $replacementFlowId;

    public function _after(FunctionalTester $I)
    {
        parent::_after($I);
        if ($this->replacementFlowId) {
            \Yii::$app->db->createCommand()->delete('flow_versions', ['flow_id' => $this->replacementFlowId])->execute();
            \Yii::$app->db->createCommand()->delete('flows', ['id' => $this->replacementFlowId])->execute();
        }
    }

    public function testMissingAndMalformedContextIsRejectedBeforeWriting(FunctionalTester $I)
    {
        $item = $this->loopingItem($I, 'invalid-context');
        $runId = (int)$this->latestRun('new', $item['id'])['id'];
        $beforeActivity = $this->itemActivity($item['id']);
        $base = ['step_key' => 'loop', 'outcome_key' => 'again'];
        foreach ([
            $base,
            $base + ['run_id' => $runId],
            $base + ['result_seq' => 0],
            $base + ['run_id' => 0, 'result_seq' => 0],
            $base + ['run_id' => 'invalid', 'result_seq' => 0],
            $base + ['run_id' => $runId, 'result_seq' => -1],
        ] as $body) {
            $this->request($I, 'POST', 'workflow-flow/step-result', $body, ['kind' => 'new', 'id' => $item['id']]);
            $I->seeResponseCodeIs(400);
            $response = $this->response($I);
            Assert::assertSame('run_context_required', $response['error_code']);
            Assert::assertSame(12, strlen($response['reference']));
            Assert::assertSame(0, $this->resultCount($runId));
            Assert::assertSame($beforeActivity, $this->itemActivity($item['id']));
        }
    }

    public function testRunAndSequenceContextAdvancesWithoutAFlowReload(FunctionalTester $I)
    {
        $item = $this->loopingItem($I, 'sequence-context');
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        $state = $this->response($I);
        $runId = (int)$state['run_id'];
        Assert::assertSame(0, $state['result_seq'] ?? null);

        $this->postLoop($I, $item['id'], $runId + 1, 0);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('stale_step', $this->response($I)['error_code']);
        Assert::assertSame(0, $this->resultCount($runId));

        $this->postLoop($I, $item['id'], $runId, 0);
        $I->seeResponseCodeIs(200);
        $state = $this->response($I);
        Assert::assertSame($runId, (int)$state['run_id']);
        Assert::assertSame(1, $state['result_seq']);

        $this->postLoop($I, $item['id'], $runId, 0);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('stale_step', $this->response($I)['error_code']);
        Assert::assertSame(1, $this->resultCount($runId));

        $this->postLoop($I, $item['id'], $runId, 1);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($runId, (int)$this->response($I)['run_id']);
        Assert::assertSame(2, $this->response($I)['result_seq']);
        Assert::assertSame(2, $this->resultCount($runId));

        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($runId, (int)$this->response($I)['run_id']);
        Assert::assertSame(2, $this->response($I)['result_seq']);

        $this->replacementFlowId = $this->createLoopingFlow('replacement');
        $this->request($I, 'POST', 'workflow-flow/switch-flow', [
            'flow_id' => $this->replacementFlowId, 'reason' => 'Synthetic flow switch',
        ], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        $state = $this->response($I);
        Assert::assertNotSame($runId, (int)$state['run_id']);
        Assert::assertSame(0, $state['result_seq']);
    }

    public function testWorkflowStaleRunIsClosedBeforeReturningStaleStep(FunctionalTester $I)
    {
        $item = $this->loopingItem($I, 'workflow-stale');
        $runId = (int)$this->latestRun('new', $item['id'])['id'];
        \Yii::$app->db->createCommand()->update('submission_publication_state', [
            'workflow_revision' => 2,
        ], ['item_kind' => 'new', 'item_id' => $item['id']])->execute();

        $this->postLoop($I, $item['id'], $runId, 0);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('stale_step', $this->response($I)['error_code']);
        $run = $this->latestRun('new', $item['id']);
        Assert::assertSame('superseded', $run['finish_state']);
        Assert::assertNotEmpty($run['closed_at']);
        Assert::assertSame(0, $this->resultCount($runId));
    }

    private function loopingItem(FunctionalTester $I, $suffix)
    {
        $this->mapTypesToSameFlow([$this->materialTypeId('book')]);
        \Yii::$app->db->createCommand()->update('flow_versions', [
            'steps_json' => json_encode([[
                'key' => 'loop', 'kind' => 'question', 'label' => 'Synthetic loop',
                'outcomes' => [['key' => 'again', 'label' => 'Again', 'next' => ['step' => 'loop']]],
            ]]),
        ], ['flow_id' => $this->flowId, 'version' => 1])->execute();
        $submissionId = $this->createSubmission($suffix);
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1', [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $this->materialTypeId('book'),
        ], ['id' => $itemId])->execute();
        $this->claim($I, 'new', $itemId);
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        return ['id' => $itemId, 'submission_id' => $submissionId];
    }

    private function postLoop(FunctionalTester $I, $itemId, $runId, $resultSeq)
    {
        $this->request($I, 'POST', 'workflow-flow/step-result', [
            'step_key' => 'loop', 'outcome_key' => 'again', 'run_id' => $runId, 'result_seq' => $resultSeq,
        ], ['kind' => 'new', 'id' => $itemId]);
    }

    private function resultCount($runId)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM item_flow_step_results WHERE run_id = :run_id', [':run_id' => $runId]
        )->queryScalar();
    }

    private function itemActivity($itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT last_activity_at FROM submission_new_resources WHERE id = :id', [':id' => $itemId]
        )->queryScalar();
    }

    private function createLoopingFlow($suffix)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . $suffix,
            'description' => 'Synthetic replacement flow',
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $flowId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $flowId,
            'version' => 1,
            'steps_json' => json_encode([[
                'key' => 'loop', 'kind' => 'question', 'label' => 'Synthetic loop',
                'outcomes' => [['key' => 'again', 'label' => 'Again', 'next' => ['step' => 'loop']]],
            ]]),
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        return $flowId;
    }
}
