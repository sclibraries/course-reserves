<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;
use app\services\FlowRepository;
use app\services\ItemClaimRepository;
use app\services\ItemChangeClass;
use app\services\PublicationPolicy;
use app\services\SubmissionPublicationStateRepository;
use app\services\SubmissionPublicationStateService;

class Api122RevisionFoundationCest extends Api109FunctionalCest
{
    private $extraFlowId;

    public function _after(FunctionalTester $I)
    {
        parent::_after($I);
        if ($this->extraFlowId) {
            \Yii::$app->db->createCommand()->delete('flow_versions', ['flow_id' => $this->extraFlowId])->execute();
            \Yii::$app->db->createCommand()->delete('flows', ['id' => $this->extraFlowId])->execute();
        }
    }

    public function testChangeClassesUpdateRevisionsAndPreserveOnlyValidReadiness(FunctionalTester $I)
    {
        $this->mapTypesToSameFlow([$this->materialTypeId('book')]);
        $newStateSubmission = $this->createSubmission('new-state');
        $transaction = \Yii::$app->db->beginTransaction();
        (new SubmissionPublicationStateRepository())->ensureForSubmission($newStateSubmission);
        $transaction->commit();
        $newStateItemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $newStateSubmission]
        )->queryScalar();
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT workflow_revision FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
            [':id' => $newStateItemId]
        )->queryScalar());

        $identity = $this->createRevisionItem('identity', 4, 3);
        $display = $this->createRevisionItem('display', 4, 3);
        $staleDisplay = $this->createRevisionItem('stale-display', 4, 3);
        $flowPlacement = $this->createRevisionItem('flow-placement', 4, 3);
        $invalidFlowPlacement = $this->createRevisionItem('invalid-flow-placement', 4, 3);
        $manualPlacement = $this->createRevisionItem('manual-placement', 4, 3);
        $invalidPlacement = $this->createRevisionItem('invalid-placement', 4, 3);

        $this->saveState($identity, [
            'state' => 'ready', 'readiness_source' => 'manual', 'readiness_revision' => 4,
            'readiness_reason' => 'Synthetic ready state', 'readiness_context_json' => '{}',
        ]);
        $this->recordChange($identity, ItemChangeClass::IDENTITY);
        $this->assertState($identity, 5, 4, null, 'pending');

        $displayRun = $this->insertRun($display, 4, 3, null);
        $this->saveState($display, ['state' => 'ready', 'readiness_source' => 'manual']);
        $this->recordChange($display, ItemChangeClass::DISPLAY_ONLY);
        $this->assertState($display, 5, 3, null, 'pending');
        $this->assertRun($displayRun, 5, 3, null);

        $staleRun = $this->insertRun($staleDisplay, 3, 3, null);
        $this->recordChange($staleDisplay, ItemChangeClass::DISPLAY_ONLY);
        $this->assertRun($staleRun, 3, 3, null);

        $flowRun = $this->insertRun($flowPlacement, 4, 3, 'available_online');
        $this->saveState($flowPlacement, [
            'state' => 'ready', 'readiness_source' => 'flow', 'readiness_run_id' => $flowRun,
            'readiness_revision' => 4,
        ]);
        $this->recordChange($flowPlacement, ItemChangeClass::PLACEMENT);
        $this->assertState($flowPlacement, 5, 3, 'flow', 'ready');
        $this->assertRun($flowRun, 5, 3, 'available_online');

        $invalidFlowRun = $this->insertRun($invalidFlowPlacement, 3, 3, 'available_online');
        $this->saveState($invalidFlowPlacement, [
            'state' => 'ready', 'readiness_source' => 'flow', 'readiness_run_id' => $invalidFlowRun,
            'readiness_revision' => 4,
        ]);
        $this->recordChange($invalidFlowPlacement, ItemChangeClass::PLACEMENT);
        $this->assertState($invalidFlowPlacement, 5, 3, null, 'pending');
        $this->assertRun($invalidFlowRun, 3, 3, 'available_online');

        $manualContext = $this->manualContext($manualPlacement);
        $this->saveState($manualPlacement, [
            'state' => 'ready', 'readiness_source' => 'manual', 'readiness_revision' => 4,
            'readiness_reason' => 'Synthetic manual readiness',
            'readiness_context_json' => json_encode($manualContext, JSON_UNESCAPED_SLASHES),
        ]);
        $this->recordChange($manualPlacement, ItemChangeClass::PLACEMENT);
        $this->assertState($manualPlacement, 5, 3, 'manual', 'ready');
        Assert::assertSame(5, (int)$this->state($manualPlacement)['readiness_revision']);

        $this->saveState($invalidPlacement, [
            'state' => 'ready', 'readiness_source' => 'manual', 'readiness_revision' => 4,
            'readiness_context_json' => '{}',
        ]);
        $this->recordChange($invalidPlacement, ItemChangeClass::PLACEMENT);
        $this->assertState($invalidPlacement, 5, 3, null, 'pending');
    }

    public function testFlowUsesWorkflowRevisionForCreationReadinessAndSupersession(FunctionalTester $I)
    {
        $bookId = $this->materialTypeId('book');
        $this->mapTypesToSameFlow([$bookId]);
        $this->setSuccessfulSteps($this->flowId);
        $item = $this->createRevisionItem('flow-revisions', 5, 2);
        $this->claim($I, 'new', $item['id']);

        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        $state = $this->response($I);
        Assert::assertSame((int)$this->latestRun('new', $item['id'])['id'], (int)$state['run_id']);
        Assert::assertSame(0, $state['result_seq']);
        $run = $this->latestRun('new', $item['id']);
        Assert::assertSame(5, (int)$run['draft_revision']);
        Assert::assertSame(2, (int)$run['workflow_revision']);

        $this->setRevisions($item, 6, 2);
        $this->recordChange($item, ItemChangeClass::DISPLAY_ONLY);
        $this->request($I, 'POST', 'workflow-flow/step-result', [
            'run_id' => $state['run_id'], 'result_seq' => $state['result_seq'],
            'step_key' => 'start', 'outcome_key' => 'done',
        ], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame((int)$run['id'], (int)$this->response($I)['run_id']);
        Assert::assertSame(1, $this->response($I)['result_seq']);
        Assert::assertSame('available_online', $this->response($I)['finished']['finish_state']);
        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertNotSame('ready', $this->response($I)['publication']['state']);
        Assert::assertNull($this->response($I)['publication']['readiness']['source']);

        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame((int)$run['id'], (int)$this->latestRun('new', $item['id'])['id']);
        Assert::assertCount(1, $this->runs('new', $item['id']));

        $this->setRevisions($item, 7, 3);
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertCount(2, $this->runs('new', $item['id']));
        $latest = $this->latestRun('new', $item['id']);
        Assert::assertNotSame((int)$run['id'], (int)$latest['id']);
        Assert::assertSame(7, (int)$latest['draft_revision']);
        Assert::assertSame(3, (int)$latest['workflow_revision']);

        $this->extraFlowId = $this->createSecondFlow();
        $this->setRevisions($item, 9, 4);
        $this->request($I, 'POST', 'workflow-flow/switch-flow', [
            'flow_id' => $this->extraFlowId, 'reason' => 'Synthetic flow change',
        ], ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame((int)$this->latestRun('new', $item['id'])['id'], (int)$this->response($I)['run_id']);
        Assert::assertSame(0, $this->response($I)['result_seq']);
        $latest = $this->latestRun('new', $item['id']);
        Assert::assertSame(9, (int)$latest['draft_revision']);
        Assert::assertSame(4, (int)$latest['workflow_revision']);
    }

    public function testMissingStateUsesWorkflowRevisionOne(FunctionalTester $I)
    {
        $this->mapTypesToSameFlow([$this->materialTypeId('book')]);
        $submissionId = $this->createSubmission('empty-state');
        $item = (new ItemClaimRepository())->find('new', (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar());
        $runId = $this->insertRun(['id' => $item['id']], 1, 2, 'available_online');
        $run = (new FlowRepository())->run($runId);
        $contracts = (new SubmissionPublicationStateService())->contractsForSubmission(
            $submissionId,
            [['kind' => 'new', 'id' => $item['id'], 'item' => $item]],
            ['role' => 'staff'],
            ['new:' . (int)$item['id'] => $run],
            []
        );
        Assert::assertNull($contracts['new:' . (int)$item['id']]['readiness']['source']);
    }

    private function createRevisionItem($suffix, $draftRevision, $workflowRevision)
    {
        $submissionId = $this->createSubmission($suffix);
        $db = \Yii::$app->db;
        $itemId = (int)$db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $this->materialTypeId('book'),
        ], ['id' => $itemId])->execute();
        $db->createCommand()->insert('submission_publication_state', [
            'item_kind' => 'new', 'item_id' => $itemId, 'submission_id' => $submissionId,
            'draft_revision' => $draftRevision, 'workflow_revision' => $workflowRevision,
        ])->execute();
        return ['id' => $itemId, 'submission_id' => $submissionId];
    }

    private function saveState(array $item, array $values)
    {
        \Yii::$app->db->createCommand()->update('submission_publication_state', $values, [
            'item_kind' => 'new', 'item_id' => $item['id'],
        ])->execute();
    }

    private function setRevisions(array $item, $draftRevision, $workflowRevision)
    {
        $this->saveState($item, [
            'draft_revision' => $draftRevision, 'workflow_revision' => $workflowRevision,
        ]);
    }

    private function recordChange(array $item, $class)
    {
        $transaction = \Yii::$app->db->beginTransaction();
        (new SubmissionPublicationStateService())->recordChange(
            'new', $item['id'], $item['submission_id'], $class
        );
        $transaction->commit();
    }

    private function insertRun(array $item, $draftRevision, $workflowRevision, $finishState)
    {
        $db = \Yii::$app->db;
        $values = [
            'item_kind' => 'new', 'item_id' => $item['id'], 'flow_id' => $this->flowId, 'version' => 1,
            'current_step_key' => $finishState === null ? 'start' : null,
            'draft_revision' => $draftRevision, 'workflow_revision' => $workflowRevision,
            'finish_state' => $finishState,
            'closed_at' => $finishState === null ? null : '2026-11-01 12:00:00',
        ];
        $db->createCommand()->insert('item_flow_runs', $values)->execute();
        return (int)$db->getLastInsertID();
    }

    private function assertState(array $item, $draftRevision, $workflowRevision, $readinessSource, $stateName)
    {
        $state = $this->state($item);
        Assert::assertSame($draftRevision, (int)$state['draft_revision']);
        Assert::assertSame($workflowRevision, (int)$state['workflow_revision']);
        Assert::assertSame($readinessSource, $state['readiness_source']);
        Assert::assertSame($stateName, $state['state']);
    }

    private function state(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
            [':id' => $item['id']]
        )->queryOne();
    }

    private function assertRun($runId, $draftRevision, $workflowRevision, $finishState)
    {
        $run = \Yii::$app->db->createCommand('SELECT * FROM item_flow_runs WHERE id = :id', [
            ':id' => $runId,
        ])->queryOne();
        Assert::assertSame($draftRevision, (int)$run['draft_revision']);
        Assert::assertSame($workflowRevision, (int)$run['workflow_revision']);
        Assert::assertSame($finishState, $run['finish_state']);
    }

    private function manualContext(array $item)
    {
        $row = (new ItemClaimRepository())->find('new', $item['id']);
        $mapping = (new FlowRepository())->mappedFlow($row['material_type_id']);
        return (new PublicationPolicy())->context($row, null, $mapping);
    }

    private function setSuccessfulSteps($flowId)
    {
        $steps = [
            [
                'key' => 'start', 'kind' => 'question', 'label' => 'Synthetic start', 'help_text' => null,
                'outcomes' => [['key' => 'done', 'label' => 'Done', 'next' => ['finish' => 'available']]],
            ],
            [
                'key' => 'available', 'kind' => 'finish', 'label' => 'Available', 'help_text' => null,
                'finish_state' => 'available_online', 'reason_required' => false, 'outcomes' => [],
            ],
        ];
        \Yii::$app->db->createCommand()->update('flow_versions', [
            'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES),
        ], ['flow_id' => $flowId, 'version' => 1])->execute();
    }

    private function createSecondFlow()
    {
        $repository = new FlowRepository();
        $flowId = $repository->insertFlow($this->prefix . 'second flow', 'Synthetic second flow', $this->prefix . 'staff');
        $repository->insertVersion($flowId, 1, [[
            'key' => 'start', 'kind' => 'question', 'label' => 'Synthetic second start', 'outcomes' => [],
        ]], $this->prefix . 'staff');
        return $flowId;
    }
}
