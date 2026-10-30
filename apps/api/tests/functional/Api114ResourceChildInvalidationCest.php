<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;
use app\services\SubmissionPublicationInvalidator;

/** Ensures child-only resource writes participate in draft revision tracking. */
class Api114ResourceChildInvalidationCest extends Api109FunctionalCest
{
    public function testMetadataAndBulkLinkChangesInvalidateEachDependentDraftOnceAndIgnoreNoOps(FunctionalTester $I)
    {
        $items = $this->createDependentItems('bulk-children');
        $before = $this->primeRevisions($I, $items);

        $payload = [
            'metadata' => ['isbn' => 'Synthetic API-114 ISBN'],
            'links' => [[
                'url' => 'https://links.example.test/api114-bulk',
                'title' => 'Synthetic bulk link',
                'use_proxy' => 1,
                'use_link_visibility' => 1,
                'start_visibility' => '2027-02-01',
                'end_visibility' => null,
            ]],
        ];
        $this->request($I, 'PUT', 'resource/update', $payload, ['id' => $items['resource_id']]);
        $I->seeResponseCodeIs(200);
        $afterChange = $this->currentRevisions($I, $items);
        foreach (['new', 'reuse'] as $kind) {
            Assert::assertSame($before[$kind] + 1, $afterChange[$kind], $kind . ' should be invalidated once after the batch.');
        }

        $this->request($I, 'PUT', 'resource/update', $payload, ['id' => $items['resource_id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(
            $afterChange,
            $this->currentRevisions($I, $items),
            'Replacing semantically identical links must ignore generated row ids and timestamps.'
        );
    }

    public function testAdditionalLinkAddAndDeleteInvalidateDependentDraftsOnce(FunctionalTester $I)
    {
        $items = $this->createDependentItems('link-add-delete');
        $before = $this->primeRevisions($I, $items);

        $this->request($I, 'POST', 'resource/add-link', [
            'url' => 'https://links.example.test/api114-add',
            'title' => 'Synthetic added link',
            'use_proxy' => 1,
            'use_link_visibility' => 1,
            'start_visibility' => '2027-03-01',
            'end_visibility' => null,
        ], ['resourceId' => $items['resource_id']]);
        $I->seeResponseCodeIs(200);
        $added = $this->currentRevisions($I, $items);
        Assert::assertSame($before['new'] + 1, $added['new']);
        Assert::assertSame($before['reuse'] + 1, $added['reuse']);

        $linkId = (int)\Yii::$app->db->createCommand(
            'SELECT link_id FROM resource_links WHERE resource_id = :id AND url = :url',
            [':id' => $items['resource_id'], ':url' => 'https://links.example.test/api114-add']
        )->queryScalar();
        $this->request($I, 'DELETE', 'resource/delete-link', [], ['id' => $linkId]);
        $I->seeResponseCodeIs(200);
        $deleted = $this->currentRevisions($I, $items);
        Assert::assertSame($added['new'] + 1, $deleted['new']);
        Assert::assertSame($added['reuse'] + 1, $deleted['reuse']);
    }

    public function testPublicationBookkeepingSkipsOnlyPublishingItemAndInvalidatesOtherDependents(FunctionalTester $I)
    {
        $items = $this->createDependentItems('bookkeeping');
        $before = $this->primeRevisions($I, $items);
        \Yii::$app->db->createCommand()->update('submission_publication_state', [
            'state' => 'published',
            'published_revision' => $before['new'],
        ], ['item_kind' => 'new', 'item_id' => $items['new']['id']])->execute();

        // This call represents the post-save bookkeeping path for the publishing item.
        (new SubmissionPublicationInvalidator())->sourceResource($items['resource_id'], [
            'kind' => 'new',
            'id' => $items['new']['id'],
        ]);

        $after = $this->currentRevisions($I, $items);
        Assert::assertSame($before['new'], $after['new'], 'The publishing item must not invalidate itself.');
        Assert::assertSame($before['reuse'] + 1, $after['reuse'], 'Other drafts sharing the source still invalidate.');
    }

    private function createDependentItems($suffix)
    {
        $ebookId = $this->materialTypeId('ebook');
        Assert::assertGreaterThan(0, $ebookId);
        $resourceId = $this->createSource($ebookId);
        $newSubmission = $this->createSubmission($suffix . '-new');
        $newId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $newSubmission]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $ebookId,
            'source_resource_id' => (string)$resourceId,
            'resource_data' => json_encode(['title' => 'Synthetic new dependent']),
        ], ['id' => $newId])->execute();

        $reuseSubmission = $this->createSubmission($suffix . '-reuse');
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $reuseSubmission,
            'source_resource_id' => $resourceId,
            'material_type_id' => $ebookId,
            'item_status' => 'pending',
        ])->execute();
        $reuseId = (int)\Yii::$app->db->getLastInsertID();

        return [
            'resource_id' => $resourceId,
            'new' => ['kind' => 'new', 'id' => $newId],
            'reuse' => ['kind' => 'reuse', 'id' => $reuseId],
        ];
    }

    private function primeRevisions(FunctionalTester $I, array $items)
    {
        $revisions = [];
        foreach (['new', 'reuse'] as $kind) {
            $this->request($I, 'GET', 'workflow-publication/state', [], $items[$kind]);
            $I->seeResponseCodeIs(200);
            $revisions[$kind] = (int)$this->response($I)['publication']['revision']['draft'];
        }
        return $revisions;
    }

    private function currentRevisions(FunctionalTester $I, array $items)
    {
        $revisions = [];
        foreach (['new', 'reuse'] as $kind) {
            $this->request($I, 'GET', 'workflow-publication/state', [], $items[$kind]);
            $I->seeResponseCodeIs(200);
            $revisions[$kind] = (int)$this->response($I)['publication']['revision']['draft'];
        }
        return $revisions;
    }
}
