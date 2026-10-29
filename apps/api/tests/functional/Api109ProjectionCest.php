<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;
use app\models\Resources;
use app\models\SubmissionNewResource;

class Api109ProjectionCest extends Api109FunctionalCest
{
    public function projectionKeepsKindsSeparateAndUsesCourseScopedFields(FunctionalTester $I)
    {
        $submissionId = $this->createSubmission('representations');
        $db = \Yii::$app->db;
        $sourceType = $this->materialTypeId('book');
        $ebookType = $this->materialTypeId('ebook');
        Assert::assertGreaterThan(0, $sourceType);
        Assert::assertGreaterThan(0, $ebookType);
        $sourceId = $this->createSource($sourceType);
        $id = (int)$db->createCommand(
            'SELECT GREATEST(COALESCE((SELECT MAX(id) FROM submission_new_resources), 0), '
            . 'COALESCE((SELECT MAX(id) FROM submission_reuse_resources), 0)) + 1000'
        )->queryScalar();
        $db->createCommand()->delete('submission_new_resources', ['submission_id' => $submissionId])->execute();

        $db->createCommand()->insert('submission_new_resources', [
            'id' => $id,
            'submission_id' => $submissionId,
            'material_type_id' => $ebookType,
            'is_reuse' => 1,
            'source_resource_id' => (string)$sourceId,
            'source_folio_instance_id' => 'folio-instance-api109',
            'source_folio_holdings_id' => 'folio-holdings-api109',
            'resource_data' => json_encode([
                'title' => 'Faculty saved title',
                'url' => 'https://faculty.example.test/item',
                'materialType' => 'book',
            ]),
            'source_snapshot_json' => json_encode([
                'title' => 'Frozen shared title',
                'url' => 'https://shared.example.test/item',
            ]),
            'staff_corrections_json' => json_encode([
                'title' => 'Course-only title',
                'url' => null,
            ]),
            'item_status' => 'pending',
        ])->execute();
        $db->createCommand()->insert('submission_reuse_resources', [
            'id' => $id,
            'submission_id' => $submissionId,
            'source_resource_id' => $sourceId,
            'material_type_id' => $sourceType,
            'source_snapshot_json' => json_encode([
                'title' => 'Frozen legacy reuse title',
                'url' => 'https://shared.example.test/reuse',
            ]),
            'item_status' => 'pending',
        ])->execute();
        $ordinaryId = $id + 1;
        $db->createCommand()->insert('submission_new_resources', [
            'id' => $ordinaryId,
            'submission_id' => $submissionId,
            'material_type_id' => $sourceType,
            'is_reuse' => 0,
            'resource_data' => json_encode(['title' => 'Synthetic new title']),
            'item_status' => 'pending',
        ])->execute();

        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $id]);
        $I->seeResponseCodeIs(200);
        $newProjection = $this->response($I)['projection'];
        Assert::assertSame('new', $newProjection['kind']);
        Assert::assertSame('Course-only title', $newProjection['inputs']['title']);
        Assert::assertNull($newProjection['inputs']['url']);
        Assert::assertSame('electronic', $newProjection['destination_class']);
        Assert::assertSame((string)$sourceId, $newProjection['source']['resource_id']);
        Assert::assertSame('folio-instance-api109', $newProjection['source']['folio_instance_id']);
        Assert::assertSame('folio-holdings-api109', $newProjection['source']['folio_holdings_id']);

        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'reuse', 'id' => $id]);
        $I->seeResponseCodeIs(200);
        $reuseProjection = $this->response($I)['projection'];
        Assert::assertSame('reuse', $reuseProjection['kind']);
        Assert::assertSame('Frozen legacy reuse title', $reuseProjection['inputs']['title']);
        Assert::assertSame('print', $reuseProjection['destination_class']);

        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $ordinaryId]);
        $I->seeResponseCodeIs(200);
        $ordinaryProjection = $this->response($I)['projection'];
        Assert::assertSame('Synthetic new title', $ordinaryProjection['inputs']['title']);
        Assert::assertSame([], $ordinaryProjection['blockers']);
        $this->assertNoDestination('new', $id);
        $this->assertNoDestination('reuse', $id);
        $this->assertNoDestination('new', $ordinaryId);
    }

    public function sourceEditsAndDeletionInvalidateTheFrozenItemDraft(FunctionalTester $I)
    {
        $submissionId = $this->createSubmission('source-changes');
        $bookId = $this->materialTypeId('book');
        $sourceId = $this->createSource($bookId);
        $item = SubmissionNewResource::find()->where(['submission_id' => $submissionId])->one();
        $item->material_type_id = $bookId;
        $item->source_resource_id = (string)$sourceId;
        $item->resource_data = json_encode(['materialType' => 'book']);
        Assert::assertTrue($item->save());

        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $item->id]);
        $I->seeResponseCodeIs(200);
        $beforeRevision = (int)$this->response($I)['publication']['revision']['draft'];
        $resource = Resources::findOne($sourceId);
        $resource->name = 'Synthetic edited shared title';
        Assert::assertTrue($resource->save());

        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $item->id]);
        Assert::assertSame($beforeRevision + 1, (int)$this->response($I)['publication']['revision']['draft']);
        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $item->id]);
        Assert::assertSame('Synthetic API-109 source', $this->response($I)['projection']['inputs']['title']);

        Assert::assertSame(1, $resource->delete());
        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $item->id]);
        Assert::assertSame($beforeRevision + 2, (int)$this->response($I)['publication']['revision']['draft']);
        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $item->id]);
        Assert::assertContains('source_resource_missing', $this->response($I)['projection']['blockers']);
        $this->assertNoDestination('new', $item->id);
    }
}
