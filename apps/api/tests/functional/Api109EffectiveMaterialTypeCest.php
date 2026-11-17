<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;
use app\models\SubmissionNewResource;
use app\services\SubmittedSubmissionUpdateService;

class Api109EffectiveMaterialTypeCest extends Api109FunctionalCest
{
    public function staffDisplayCorrectionKeepsCurrentRunOpenAndClearsManualReadiness(FunctionalTester $I)
    {
        $bookId = $this->materialTypeId('book');
        $this->mapTypesToSameFlow([$bookId]);
        $submissionId = $this->createSubmission('staff-display-correction');
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $bookId,
            'resource_data' => json_encode(['title' => 'Synthetic display item', 'materialType' => 'book']),
        ], ['id' => $itemId])->execute();

        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $run = $this->latestRun('new', $itemId);
        $this->claim($I, 'new', $itemId);
        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic readiness before display correction',
        ], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $before = $this->revisionRow($itemId);

        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'public_note' => 'Synthetic student-facing note',
        ], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);

        $after = $this->revisionRow($itemId);
        $currentRun = $this->latestRun('new', $itemId);
        Assert::assertSame((int)$before['draft_revision'] + 1, (int)$after['draft_revision']);
        Assert::assertSame((int)$before['workflow_revision'], (int)$after['workflow_revision']);
        Assert::assertSame('ready', $before['state']);
        Assert::assertNull($after['readiness_source']);
        Assert::assertSame((int)$run['id'], (int)$currentRun['id']);
        Assert::assertNull($currentRun['closed_at']);
        Assert::assertSame((int)$after['draft_revision'], (int)$currentRun['draft_revision']);
    }

    public function facultyFullSaveRecordsOneStrongestChangePerItem(FunctionalTester $I)
    {
        $bookId = $this->materialTypeId('book');
        $this->mapTypesToSameFlow([$bookId]);

        list($displaySubmissionId, $displayItemId) = $this->createBookItem('faculty-display', $bookId);
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $displayItemId]);
        $I->seeResponseCodeIs(200);
        $this->claim($I, 'new', $displayItemId);
        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic readiness before faculty display save',
        ], ['kind' => 'new', 'id' => $displayItemId]);
        $I->seeResponseCodeIs(200);
        $displayBefore = $this->revisionRow($displayItemId);
        $displayUpdate = (new SubmittedSubmissionUpdateService())->update($displaySubmissionId, [
            'items' => [[
                'id' => $displayItemId,
                'resource_data' => ['description' => 'Synthetic faculty display description'],
            ]],
        ]);
        Assert::assertArrayHasKey('submission', $displayUpdate);
        $displayAfter = $this->revisionRow($displayItemId);
        $displayRun = $this->latestRun('new', $displayItemId);
        Assert::assertSame((int)$displayBefore['draft_revision'] + 1, (int)$displayAfter['draft_revision']);
        Assert::assertSame((int)$displayBefore['workflow_revision'], (int)$displayAfter['workflow_revision']);
        Assert::assertSame('ready', $displayBefore['state']);
        Assert::assertNull($displayAfter['readiness_source']);
        Assert::assertNull($displayRun['closed_at']);
        Assert::assertSame((int)$displayAfter['draft_revision'], (int)$displayRun['draft_revision']);

        list($placementSubmissionId, $placementItemId) = $this->createBookItem(
            'faculty-folder-rename', $bookId, 'Original folder'
        );
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $placementItemId]);
        $I->seeResponseCodeIs(200);
        $this->claim($I, 'new', $placementItemId);
        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic readiness before folder rename',
        ], ['kind' => 'new', 'id' => $placementItemId]);
        $I->seeResponseCodeIs(200);
        $placementBefore = $this->revisionRow($placementItemId);
        $placementUpdate = (new SubmittedSubmissionUpdateService())->update($placementSubmissionId, [
            'folders' => [['folder_uuid' => 'renamed-folder', 'folder_name' => 'Renamed folder']],
            'items' => [[
                'id' => $placementItemId,
                'folder_uuid' => 'renamed-folder',
                'position_in_folder' => 1,
            ]],
        ]);
        Assert::assertArrayHasKey('submission', $placementUpdate);
        $placementAfter = $this->revisionRow($placementItemId);
        Assert::assertSame((int)$placementBefore['draft_revision'] + 1, (int)$placementAfter['draft_revision']);
        Assert::assertSame((int)$placementBefore['workflow_revision'], (int)$placementAfter['workflow_revision']);
        Assert::assertSame('ready', $placementAfter['state']);
        Assert::assertSame('manual', $placementAfter['readiness_source']);
        Assert::assertSame((int)$placementAfter['draft_revision'], (int)$placementAfter['readiness_revision']);

        list($combinedSubmissionId, $combinedItemId) = $this->createBookItem(
            'faculty-folder-title', $bookId, 'Combined original folder'
        );
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $combinedItemId]);
        $I->seeResponseCodeIs(200);
        $combinedRun = $this->latestRun('new', $combinedItemId);
        $combinedBefore = $this->revisionRow($combinedItemId);
        $combinedUpdate = (new SubmittedSubmissionUpdateService())->update($combinedSubmissionId, [
            'folders' => [['folder_uuid' => 'combined-renamed-folder', 'folder_name' => 'Combined renamed folder']],
            'items' => [[
                'id' => $combinedItemId,
                'folder_uuid' => 'combined-renamed-folder',
                'position_in_folder' => 1,
                'title' => 'Synthetic changed title',
            ]],
        ]);
        Assert::assertArrayHasKey('submission', $combinedUpdate);
        $combinedAfter = $this->revisionRow($combinedItemId);
        Assert::assertSame((int)$combinedBefore['draft_revision'] + 1, (int)$combinedAfter['draft_revision']);
        Assert::assertSame((int)$combinedBefore['workflow_revision'] + 1, (int)$combinedAfter['workflow_revision']);
        Assert::assertNull($combinedAfter['readiness_source']);
        Assert::assertNull($this->latestRun('new', $combinedItemId)['closed_at']);

        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $combinedItemId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('superseded', $this->latestRunById($combinedRun['id'])['finish_state']);
        Assert::assertCount(2, $this->runs('new', $combinedItemId));
    }

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

    private function createBookItem($suffix, $bookId, $folderName = null)
    {
        $submissionId = $this->createSubmission($suffix);
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $bookId,
            'resource_data' => json_encode(['title' => 'Synthetic original title', 'materialType' => 'book']),
            'folder_name' => $folderName,
            'position_in_folder' => $folderName === null ? null : 1,
        ], ['id' => $itemId])->execute();
        if ($folderName !== null) {
            \Yii::$app->db->createCommand()->insert('submission_folders', [
                'submission_id' => $submissionId,
                'folder_name' => $folderName,
                'display_order' => 1,
            ])->execute();
        }
        return [$submissionId, $itemId];
    }

    private function revisionRow($itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
            [':id' => $itemId]
        )->queryOne();
    }

    private function latestRunById($runId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM item_flow_runs WHERE id = :id', [':id' => $runId]
        )->queryOne();
    }
}
