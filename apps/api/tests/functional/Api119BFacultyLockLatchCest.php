<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;
use app\services\FacultyLockLatch;
use app\services\ItemClaimRepository;
use app\services\ItemWriteLock;

class Api119BFacultyLockLatchCest extends Api109FunctionalCest
{
    public function testLatchRequiresTransactionAndPreservesTheFirstWriteForBothKinds(FunctionalTester $I)
    {
        \Yii::$app->db->getTransaction()->commit();
        $submissionId = $this->createSubmission('latch-contract');
        $newId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $submissionId,
            'faculty_notes' => 'Synthetic latch contract item',
        ])->execute();
        $items = ['new' => $newId, 'reuse' => (int)\Yii::$app->db->getLastInsertID()];
        $latch = new FacultyLockLatch();
        $first = date('Y-m-d H:i:s', time() - 300);
        $later = date('Y-m-d H:i:s', time() - 240);

        try {
            $latch->set('new', $newId, $first);
            Assert::fail('Expected the latch to require a transaction.');
        } catch (\LogicException $exception) {
            Assert::assertNotSame('', $exception->getMessage());
        }

        $transaction = \Yii::$app->db->beginTransaction();
        foreach ($items as $kind => $id) {
            (new ItemWriteLock())->lock($kind, $id);
            Assert::assertSame(1, $latch->set($kind, $id, $first));
            Assert::assertSame(0, $latch->set($kind, $id, $later));
        }
        $transaction->rollBack();
        foreach ($items as $kind => $id) {
            Assert::assertNull($this->facultyLatch($kind, $id));
        }

        $transaction = \Yii::$app->db->beginTransaction();
        foreach ($items as $kind => $id) {
            (new ItemWriteLock())->lock($kind, $id);
            $latch->set($kind, $id, $first);
            $latch->set($kind, $id, $later);
        }
        $transaction->commit();
        foreach ($items as $kind => $id) {
            Assert::assertSame($first, $this->facultyLatch($kind, $id));
        }
    }

    public function testFlowFinishUsingNextFinishLatches(FunctionalTester $I)
    {
        $this->mapTypesToSameFlow([$this->materialTypeId('book')]);
        $item = $this->runFlow($I, 'next-finish', ['finish' => 'finish'], 'available_online');

        Assert::assertSame('available_online', $item['result']['finished']['finish_state']);
        Assert::assertNotEmpty($this->facultyLatch('new', $item['id']));
    }

    public function testFlowFinishUsingNextStepToFinishLatches(FunctionalTester $I)
    {
        $this->mapTypesToSameFlow([$this->materialTypeId('book')]);
        $item = $this->runFlow($I, 'next-step-finish', ['step' => 'finish'], 'prepared');

        Assert::assertSame('prepared', $item['result']['finished']['finish_state']);
        Assert::assertNotEmpty($this->facultyLatch('new', $item['id']));
    }

    public function testUnsuccessfulAndIntermediateFlowResultsDoNotLatch(FunctionalTester $I)
    {
        $this->mapTypesToSameFlow([$this->materialTypeId('book')]);
        foreach ([
            ['unavailable', ['finish' => 'finish']],
            ['needs_access_path', ['step' => 'finish']],
            ['withdrawn', ['finish' => 'finish']],
            [null, ['step' => 'start']],
        ] as $index => $case) {
            $item = $this->runFlow($I, 'nonready-' . $index, $case[1], $case[0]);
            if ($case[0] === null) {
                Assert::assertNull($item['result']['finished']);
            } else {
                Assert::assertSame($case[0], $item['result']['finished']['finish_state']);
            }
            Assert::assertNull($this->facultyLatch('new', $item['id']));
        }
    }

    public function testManualReadinessLatchesAfterValidationAndSurvivesLaterChanges(FunctionalTester $I)
    {
        $submissionId = $this->createSubmission('manual-latch-lifecycle');
        $itemId = $this->itemId($submissionId);
        $params = ['kind' => 'new', 'id' => $itemId];

        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic manual readiness',
        ], $params);
        $I->seeResponseCodeIs(409);
        Assert::assertNull($this->facultyLatch('new', $itemId));

        $this->claim($I, 'new', $itemId);
        $this->request($I, 'POST', 'workflow-publication/ready', [], $params);
        $I->seeResponseCodeIs(400);
        Assert::assertNull($this->facultyLatch('new', $itemId));

        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic manual readiness',
        ], $params);
        $I->seeResponseCodeIs(200);
        $latch = $this->facultyLatch('new', $itemId);
        Assert::assertNotEmpty($latch);

        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'corrections' => ['title' => 'Synthetic corrected title'],
        ], $params);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($latch, $this->facultyLatch('new', $itemId));
        $this->request($I, 'GET', 'workflow-publication/state', [], $params);
        $I->seeResponseCodeIs(200);
        Assert::assertNotSame('ready', $this->response($I)['publication']['state']);
        Assert::assertNull($this->response($I)['publication']['readiness']['source']);

        $this->request($I, 'POST', 'workflow-claim/release', [], $params);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($latch, $this->facultyLatch('new', $itemId));
        $this->claim($I, 'new', $itemId);
        $expiredAt = date('Y-m-d H:i:s', time() - 73 * 60 * 60);
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_at' => $expiredAt,
            'last_activity_at' => $expiredAt,
        ], ['id' => $itemId])->execute();
        $this->request($I, 'GET', 'workflow-claim/my-items', []);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($latch, $this->facultyLatch('new', $itemId));
        foreach (['complete', 'pending'] as $status) {
            $this->request($I, 'PUT', 'submission-workflow/update-item', [
                'item_status' => $status,
            ], ['itemId' => $itemId]);
            $I->seeResponseCodeIs(200);
            Assert::assertSame($latch, $this->facultyLatch('new', $itemId));
        }
    }

    public function testLegacyUpdateLatchesOnlyAnExplicitCompleteStatus(FunctionalTester $I)
    {
        $notesSubmission = $this->createSubmission('legacy-notes-only');
        $notesItemId = $this->itemId($notesSubmission);
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'item_status' => 'complete',
        ], ['id' => $notesItemId])->execute();
        $this->request($I, 'PUT', 'submission-workflow/update-item', [
            'staff_notes' => 'Synthetic note on an existing complete item',
        ], ['itemId' => $notesItemId]);
        $I->seeResponseCodeIs(200);
        Assert::assertNull($this->facultyLatch('new', $notesItemId));

        $completeSubmission = $this->createSubmission('legacy-explicit-complete');
        $completeItemId = $this->itemId($completeSubmission);
        $this->request($I, 'PUT', 'submission-workflow/update-item', [
            'item_status' => 'complete',
        ], ['itemId' => $completeItemId]);
        $I->seeResponseCodeIs(200);
        $latch = $this->facultyLatch('new', $completeItemId);
        Assert::assertNotEmpty($latch);
        $this->request($I, 'PUT', 'submission-workflow/update-item', [
            'staff_notes' => 'Synthetic later note',
        ], ['itemId' => $completeItemId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($latch, $this->facultyLatch('new', $completeItemId));
    }

    private function runFlow(FunctionalTester $I, $suffix, array $next, $finishState)
    {
        $steps = [[
            'key' => 'start',
            'kind' => 'question',
            'label' => 'Synthetic start',
            'outcomes' => [[
                'key' => 'done',
                'label' => 'Done',
                'next' => $next,
            ]],
        ]];
        if ($finishState !== null) {
            $steps[] = [
                'key' => 'finish',
                'kind' => 'finish',
                'label' => 'Synthetic finish',
                'finish_state' => $finishState,
                'reason_required' => false,
                'outcomes' => [],
            ];
        }
        \Yii::$app->db->createCommand()->update('flow_versions', [
            'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES),
        ], ['flow_id' => $this->flowId, 'version' => 1])->execute();

        $submissionId = $this->createSubmission($suffix);
        $itemId = $this->itemId($submissionId);
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $this->materialTypeId('book'),
        ], ['id' => $itemId])->execute();
        $this->claim($I, 'new', $itemId);
        $params = ['kind' => 'new', 'id' => $itemId];
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], $params);
        $I->seeResponseCodeIs(200);
        $flow = $this->response($I);
        $this->request($I, 'POST', 'workflow-flow/step-result', [
            'run_id' => $flow['run_id'],
            'result_seq' => $flow['result_seq'],
            'step_key' => 'start',
            'outcome_key' => 'done',
        ], $params);
        $I->seeResponseCodeIs(200);
        return ['id' => $itemId, 'result' => $this->response($I)];
    }

    private function itemId($submissionId)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
    }

    private function facultyLatch($kind, $itemId)
    {
        $table = (new ItemClaimRepository())->table($kind);
        return \Yii::$app->db->createCommand(
            'SELECT locked_for_faculty_at FROM ' . $table . ' WHERE id = :id',
            [':id' => $itemId]
        )->queryScalar();
    }
}
