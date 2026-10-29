<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;
use app\models\SubmissionNewResource;
use app\services\SubmittedSubmissionUpdateService;

class Api109EffectiveMaterialTypeCest extends Api109FunctionalCest
{
    public function effectiveTypeAndCorrectionsInvalidateOnceAndRestartTheSameFlow(FunctionalTester $I)
    {
        $articleId = $this->materialTypeId('article');
        $bookId = $this->materialTypeId('book');
        Assert::assertGreaterThan(0, $articleId);
        Assert::assertGreaterThan(0, $bookId);
        $this->mapTypesToSameFlow([$articleId, $bookId]);
        $submissionId = $this->createSubmission('same-flow');
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $articleId,
            'resource_data' => json_encode([
                'title' => 'Faculty title',
                'url' => 'https://faculty.example.test/article',
                'materialType' => 'article',
                'material_type_id' => $articleId,
            ]),
            'access_path' => 'ill',
        ], ['id' => $itemId])->execute();

        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $this->claim($I, 'new', $itemId);
        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $beforeRevision = (int)$this->response($I)['publication']['revision']['draft'];
        $oldRun = $this->latestRun('new', $itemId);
        Assert::assertNotEmpty($oldRun);

        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'effective_material_type_id' => $bookId,
            'corrections' => ['title' => 'Course-only correction', 'url' => null],
        ], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($bookId, $this->response($I)['item']['effective_material_type_id']);
        Assert::assertNull($this->response($I)['item']['access_path']);
        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        Assert::assertSame($beforeRevision + 1, (int)$this->response($I)['publication']['revision']['draft']);

        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        $projection = $this->response($I)['projection'];
        Assert::assertSame('Course-only correction', $projection['inputs']['title']);
        Assert::assertNull($projection['inputs']['url']);
        Assert::assertSame('print', $projection['destination_class']);

        $runs = $this->runs('new', $itemId);
        Assert::assertSame('superseded', $runs[0]['finish_state']);
        Assert::assertSame((int)$oldRun['id'], (int)$runs[0]['id']);
        Assert::assertSame((int)$this->flowId, (int)$runs[0]['flow_id']);
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $runs = $this->runs('new', $itemId);
        Assert::assertCount(2, $runs);
        Assert::assertSame((int)$this->flowId, (int)$runs[1]['flow_id']);
        Assert::assertSame($beforeRevision + 1, (int)$runs[1]['draft_revision']);
        Assert::assertNull($runs[1]['closed_at']);

        $noOpAuditCount = $this->detailAuditCount('new', $itemId);
        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'effective_material_type_id' => $bookId,
            'corrections' => ['title' => 'Course-only correction', 'url' => null],
        ], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($noOpAuditCount, $this->detailAuditCount('new', $itemId));

        $facultyUpdate = (new SubmittedSubmissionUpdateService())->update($submissionId, [
            'items' => [['id' => $itemId, 'materialType' => 'article']],
        ]);
        Assert::assertArrayHasKey('submission', $facultyUpdate);
        $itemJson = SubmissionNewResource::findOne($itemId)->toArray([], ['materialType']);
        Assert::assertSame($bookId, (int)$itemJson['material_type_id']);
        Assert::assertSame('book', $itemJson['resource_data']['materialType']);
        Assert::assertSame($bookId, (int)$itemJson['resource_data']['material_type_id']);
        Assert::assertArrayNotHasKey('staff_material_type_id', $itemJson);
        Assert::assertArrayNotHasKey('staff_corrections_json', $itemJson);
        Assert::assertSame($beforeRevision + 1, (int)$this->publicationRevision('new', $itemId));
        $this->assertNoDestination('new', $itemId);
    }
}
