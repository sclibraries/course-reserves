<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;
use app\models\Resources;
use app\models\SubmissionNewResource;

/** Exercises frozen course-copy inputs through the staff projection routes. */
class Api114CopyInputsCest extends Api109FunctionalCest
{
    private $courseIds = [];
    private $offeringIds = [];
    private $referenceIds = [];

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        foreach ($this->resourceIds as $resourceId) {
            $db->createCommand()->delete('course_resources', ['resource_id' => $resourceId])->execute();
        }
        foreach ($this->referenceIds as $referenceId) {
            $db->createCommand()->delete('physical_resource_references', ['reference_id' => $referenceId])->execute();
        }
        foreach ($this->offeringIds as $offeringId) {
            $db->createCommand()->delete('course_offerings', ['offering_id' => $offeringId])->execute();
        }
        foreach ($this->courseIds as $courseId) {
            $db->createCommand()->delete('courses', ['course_id' => $courseId])->execute();
        }
        $this->courseIds = [];
        $this->offeringIds = [];
        $this->referenceIds = [];
        parent::_after($I);
    }

    public function testProjectionFreezesPendingPrimaryLinkAdditionalLinksAndBibliographicAllowlist(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        Assert::assertGreaterThan(0, $ebookId);
        $resourceId = $this->createSource($ebookId);
        $this->addSourceChildren($resourceId);
        $this->addConflictingOtherCourseLinkSettings($resourceId);

        $submissionId = $this->createSubmission('frozen-copy-inputs');
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $item = SubmissionNewResource::findOne($itemId);
        $item->material_type_id = $ebookId;
        $item->source_resource_id = (string)$resourceId;
        $item->resource_data = json_encode([
            'title' => 'Synthetic pending title',
            'url' => 'https://pending.example.test/primary',
            'use_proxy' => 1,
            'use_primary_link_visibility' => 1,
            'primary_link_start_visibility' => '2027-01-15',
            'primary_link_end_visibility' => '2027-05-15',
            'pages' => '17-28',
            'notes' => 'Synthetic private faculty note',
            'libraryNotes' => 'Synthetic internal library note',
            'arbitrary_secret' => 'Synthetic raw-only value',
        ], JSON_UNESCAPED_SLASHES);
        $item->public_note = 'Synthetic course-owned public note';
        $item->assigned_pages = '20-22';
        Assert::assertTrue($item->save());

        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $beforeRevision = (int)$this->response($I)['publication']['revision']['draft'];
        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $before = $this->response($I)['projection']['copy_inputs'];

        Assert::assertSame('https://pending.example.test/primary', $before['primary_link']['url']);
        Assert::assertSame(1, (int)$before['primary_link']['use_proxy']);
        Assert::assertSame(1, (int)$before['primary_link']['use_primary_link_visibility']);
        Assert::assertSame('2027-01-15', $before['primary_link']['primary_link_start_visibility']);
        Assert::assertSame('2027-05-15', $before['primary_link']['primary_link_end_visibility']);
        Assert::assertSame([
            [
                'url' => 'https://links.example.test/first',
                'label' => 'Synthetic first link',
                'order' => 2,
                'use_proxy' => 1,
                'use_link_visibility' => 1,
                'start_visibility' => '2027-02-01',
                'end_visibility' => null,
            ],
            [
                'url' => 'https://links.example.test/second',
                'label' => 'Synthetic second link',
                'order' => 8,
                'use_proxy' => 0,
                'use_link_visibility' => 0,
                'start_visibility' => null,
                'end_visibility' => null,
            ],
        ], $before['additional_links']);

        $allowedMetadata = [
            'title', 'authors', 'publisher', 'publicationYear', 'isbn', 'issn', 'doi',
            'journalTitle', 'volume', 'issue', 'edition', 'pages',
        ];
        $metadataKeys = array_keys($before['bibliographic_metadata']);
        sort($metadataKeys);
        sort($allowedMetadata);
        Assert::assertSame($allowedMetadata, $metadataKeys);
        Assert::assertSame('Synthetic pending title', $before['bibliographic_metadata']['title']);
        Assert::assertSame('17-28', $before['bibliographic_metadata']['pages']);
        Assert::assertSame('20-22', $this->response($I)['projection']['inputs']['assigned_pages']);
        Assert::assertSame('Synthetic course-owned public note', $this->response($I)['projection']['inputs']['public_note']);
        Assert::assertArrayNotHasKey('resource_data', $before);
        $encoded = json_encode($before);
        foreach ([
            'Synthetic private faculty note', 'Synthetic internal library note', 'Synthetic raw-only value',
            'Synthetic private metadata',
        ] as $privateValue) {
            Assert::assertStringNotContainsString($privateValue, $encoded);
        }

        $resource = Resources::findOne($resourceId);
        $resource->name = 'Synthetic later source title';
        Assert::assertTrue($resource->save());
        \Yii::$app->db->createCommand()->delete('resource_links', [
            'resource_id' => $resourceId,
            'url' => 'https://links.example.test/first',
        ])->execute();
        \Yii::$app->db->createCommand()->insert('resource_links', [
            'resource_id' => $resourceId,
            'url' => 'https://links.example.test/later',
            'title' => 'Synthetic later link',
            'order' => 1,
        ])->execute();
        \Yii::$app->db->createCommand()->update('resource_metadata', [
            'field_value' => 'Synthetic later ISBN',
        ], ['resource_id' => $resourceId, 'field_name' => 'isbn'])->execute();

        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        Assert::assertSame($beforeRevision + 1, (int)$this->response($I)['publication']['revision']['draft']);
        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        $after = $this->response($I)['projection']['copy_inputs'];
        Assert::assertSame($before, $after, 'Source edits invalidate the revision without replacing frozen inputs.');
    }

    public function testAdminAuthorMetadataAliasIsCapturedAndFacultyAliasClearWins(FunctionalTester $I)
    {
        $articleId = $this->materialTypeId('article');
        $resourceId = $this->createSource($articleId);
        $this->request($I, 'PUT', 'resource/update', [
            'title' => 'Synthetic admin EDS article',
            'link' => 'https://admin.example.test/article',
            'metadata' => [
                'article_title' => 'Synthetic admin EDS article metadata',
                'author' => 'Synthetic admin EDS author',
                'journal_title' => 'Synthetic admin journal',
                'publication_date' => '2025',
            ],
        ], ['id' => $resourceId]);
        $I->seeResponseCodeIs(200);

        $submissionId = $this->createSubmission('admin-author-alias');
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $item = SubmissionNewResource::findOne($itemId);
        $item->material_type_id = $articleId;
        $item->source_resource_id = (string)$resourceId;
        $item->resource_data = json_encode([]);
        Assert::assertTrue($item->save());

        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(
            'Synthetic admin EDS author',
            $this->response($I)['projection']['copy_inputs']['bibliographic_metadata']['authors']
        );
        $captured = $this->response($I)['projection']['copy_inputs']['bibliographic_metadata'];
        Assert::assertSame('Synthetic admin EDS article metadata', $captured['title']);
        Assert::assertSame('Synthetic admin journal', $captured['journalTitle']);
        Assert::assertSame('2025', $captured['publicationYear']);

        $item->resource_data = json_encode([
            'title' => 'Synthetic item with explicit author clear',
            'author' => null,
        ]);
        Assert::assertTrue($item->save());
        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        Assert::assertNull(
            $this->response($I)['projection']['copy_inputs']['bibliographic_metadata']['authors'],
            'An explicit faculty alias clear must not resurrect the frozen admin author.'
        );
    }

    public function testPendingLinksAdditionsAndExplicitClearChangeDraftRevision(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $resourceId = $this->createSource($ebookId);
        $db = \Yii::$app->db;
        $db->createCommand()->insert('resource_links', [
            'resource_id' => $resourceId,
            'url' => 'https://links.example.test/frozen',
            'title' => 'Synthetic frozen link',
            'order' => 1,
        ])->execute();
        $submissionId = $this->createSubmission('pending-link-edits');
        $itemId = (int)$db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $item = SubmissionNewResource::findOne($itemId);
        $item->material_type_id = $ebookId;
        $item->source_resource_id = (string)$resourceId;
        $item->resource_data = json_encode(['title' => 'Synthetic pending link item']);
        Assert::assertTrue($item->save());

        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $beforeRevision = (int)$this->response($I)['publication']['revision']['draft'];
        $pendingLinks = [[
            'url' => 'https://links.example.test/pending',
            'title' => 'Synthetic pending link',
            'order' => 4,
            'use_proxy' => 1,
            'use_link_visibility' => 1,
            'start_visibility' => '2027-02-01',
            'end_visibility' => null,
        ]];
        $update = (new \app\services\SubmittedSubmissionUpdateService())->update($submissionId, [
            'items' => [['id' => $itemId, 'resource_data' => ['links' => $pendingLinks]]],
        ]);
        Assert::assertArrayHasKey('submission', $update);

        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        Assert::assertSame($beforeRevision + 1, (int)$this->response($I)['publication']['revision']['draft']);
        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        Assert::assertSame([[
            'url' => 'https://links.example.test/pending',
            'label' => 'Synthetic pending link',
            'order' => 4,
            'use_proxy' => 1,
            'use_link_visibility' => 1,
            'start_visibility' => '2027-02-01',
            'end_visibility' => null,
        ]], $this->response($I)['projection']['copy_inputs']['additional_links']);

        $update = (new \app\services\SubmittedSubmissionUpdateService())->update($submissionId, [
            'items' => [['id' => $itemId, 'resource_data' => ['links' => []]]],
        ]);
        Assert::assertArrayHasKey('submission', $update);
        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        Assert::assertSame($beforeRevision + 2, (int)$this->response($I)['publication']['revision']['draft']);
        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        Assert::assertSame([], $this->response($I)['projection']['copy_inputs']['additional_links']);
    }

    public function testOmittedPrimaryVisibilityIsItemOwnedForNewAndLegacyReuseItems(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $resourceId = $this->createSource($ebookId);
        \Yii::$app->db->createCommand()->update('resources', [
            'use_primary_link_visibility' => 1,
            'primary_link_start_visibility' => '2027-01-01',
            'primary_link_end_visibility' => '2027-12-31',
        ], ['resource_id' => $resourceId])->execute();
        $submissionId = $this->createSubmission('item-owned-primary-visibility');
        $newItemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $newItem = SubmissionNewResource::findOne($newItemId);
        $newItem->material_type_id = $ebookId;
        $newItem->source_resource_id = (string)$resourceId;
        $newItem->resource_data = json_encode(['title' => 'Synthetic new item without visibility']);
        Assert::assertTrue($newItem->save());
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $submissionId,
            'source_resource_id' => $resourceId,
            'material_type_id' => $ebookId,
            'source_snapshot_json' => json_encode([
                'version' => 2,
                'title' => 'Synthetic legacy reuse item',
                'copy_inputs' => [
                    'primary_link' => [
                        'url' => 'https://shared.example.test/source',
                        'use_primary_link_visibility' => 1,
                        'primary_link_start_visibility' => '2027-01-01',
                        'primary_link_end_visibility' => '2027-12-31',
                    ],
                ],
            ], JSON_UNESCAPED_SLASHES),
            'item_status' => 'pending',
        ])->execute();
        $reuseItemId = (int)\Yii::$app->db->getLastInsertID();

        foreach ([['new', $newItemId], ['reuse', $reuseItemId]] as $item) {
            $this->request($I, 'GET', 'workflow-publication/projection', [], [
                'kind' => $item[0], 'id' => $item[1],
            ]);
            $I->seeResponseCodeIs(200);
            $primary = $this->response($I)['projection']['copy_inputs']['primary_link'];
            Assert::assertSame(0, (int)$primary['use_primary_link_visibility']);
            Assert::assertNull($primary['primary_link_start_visibility']);
            Assert::assertNull($primary['primary_link_end_visibility']);
        }
    }

    public function testV1SnapshotBlocksUntilExplicitRefreshEditsDraftAndKeepsPublicationDisabled(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $resourceId = $this->createSource($ebookId);
        $submissionId = $this->createSubmission('v1-refresh');
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $ebookId,
            'source_resource_id' => (string)$resourceId,
            'resource_data' => json_encode(['title' => 'Synthetic current item']),
            'source_snapshot_json' => json_encode([
                'version' => 1,
                'title' => 'Synthetic old frozen title',
                'url' => 'https://old.example.test/item',
                'eds' => ['an' => 'Synthetic preserved EDS identity'],
                'legacy_extension' => ['preserve' => true],
            ], JSON_UNESCAPED_SLASHES),
        ], ['id' => $itemId])->execute();

        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        Assert::assertContains('copy_inputs_incomplete', $this->response($I)['projection']['blockers']);
        $this->request($I, 'POST', 'workflow-claim/claim', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic refresh readiness',
        ], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);

        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        $ready = $this->response($I)['publication'];
        $beforeRevision = (int)$ready['revision']['draft'];
        Assert::assertSame('manual', $ready['readiness']['source']);
        Assert::assertFalse($ready['actions']['can_publish']);

        $this->request($I, 'POST', 'workflow-publication/refresh-copy-inputs', [], [
            'kind' => 'new', 'id' => $itemId,
        ]);
        $I->seeResponseCodeIs(200);

        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        $refreshed = $this->response($I)['publication'];
        Assert::assertSame($beforeRevision + 1, (int)$refreshed['revision']['draft']);
        Assert::assertNull($refreshed['readiness']['source']);
        Assert::assertFalse($refreshed['actions']['can_publish']);
        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        $projection = $this->response($I)['projection'];
        Assert::assertNotContains('copy_inputs_incomplete', $projection['blockers']);
        Assert::assertArrayHasKey('copy_inputs', $projection);
        $snapshot = json_decode(\Yii::$app->db->createCommand(
            'SELECT source_snapshot_json FROM submission_new_resources WHERE id = :id',
            [':id' => $itemId]
        )->queryScalar(), true);
        Assert::assertSame(2, $snapshot['version']);
        Assert::assertSame('Synthetic preserved EDS identity', $snapshot['eds']['an']);
        Assert::assertSame(['preserve' => true], $snapshot['legacy_extension']);
        $this->assertNoDestination('new', $itemId);
    }

    public function testSourceLessLegacyReuseRefreshIsRejectedWithoutDroppingFrozenFields(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $submissionId = $this->createSubmission('source-less-legacy-reuse');
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $submissionId,
            'material_type_id' => $ebookId,
            'source_snapshot_json' => json_encode([
                'version' => 1,
                'title' => 'Synthetic legacy reuse title',
                'url' => 'https://legacy.example.test/reuse',
                'eds' => ['an' => 'Synthetic EDS identity'],
                'legacy_extension' => ['kept' => true],
            ], JSON_UNESCAPED_SLASHES),
            'item_status' => 'pending',
        ])->execute();
        $itemId = (int)\Yii::$app->db->getLastInsertID();
        $this->claim($I, 'reuse', $itemId);
        $before = \Yii::$app->db->createCommand(
            'SELECT source_snapshot_json FROM submission_reuse_resources WHERE id = :id',
            [':id' => $itemId]
        )->queryScalar();

        $this->request($I, 'POST', 'workflow-publication/refresh-copy-inputs', [], [
            'kind' => 'reuse', 'id' => $itemId,
        ]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame(
            'copy_input_refresh_requires_local_electronic_source',
            $this->response($I)['error_code']
        );
        $after = \Yii::$app->db->createCommand(
            'SELECT source_snapshot_json FROM submission_reuse_resources WHERE id = :id',
            [':id' => $itemId]
        )->queryScalar();
        Assert::assertSame($before, $after, 'Rejected refresh must preserve the full legacy snapshot.');
    }

    public function testDraftNoteAndAssignedPagesLeaveLiveResourceContentUnchanged(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $resourceId = $this->createSource($ebookId);
        \Yii::$app->db->createCommand()->update('resources', [
            'external_note' => 'Synthetic existing live note',
            'assigned_pages' => '2-4',
        ], ['resource_id' => $resourceId])->execute();
        $submissionId = $this->createSubmission('unchanged-live-content');
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $ebookId,
            'source_resource_id' => (string)$resourceId,
            'resource_data' => json_encode(['title' => 'Synthetic pending item']),
        ], ['id' => $itemId])->execute();

        $this->request($I, 'POST', 'workflow-claim/claim', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'public_note' => 'Synthetic pending course note',
            'assigned_pages' => '7-9',
        ], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);

        $live = \Yii::$app->db->createCommand(
            'SELECT external_note, assigned_pages FROM resources WHERE resource_id = :id',
            [':id' => $resourceId]
        )->queryOne();
        Assert::assertSame('Synthetic existing live note', $live['external_note']);
        Assert::assertSame('2-4', $live['assigned_pages']);
        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $itemId]);
        $publication = $this->response($I)['publication'];
        Assert::assertFalse($publication['actions']['can_publish']);
        $this->assertNoDestination('new', $itemId);
    }

    public function testPhysicalDraftNotePagesAndVisibilityLeaveLiveReferenceUnchanged(FunctionalTester $I)
    {
        $bookId = $this->materialTypeId('book');
        $courseId = $this->insertSyntheticCourse('physical-draft');
        $offeringId = $this->insertSyntheticOffering($courseId);
        $this->insertPhysicalDestination($offeringId);
        $referenceId = (int)\Yii::$app->db->getLastInsertID();
        $this->referenceIds[] = $referenceId;

        $submissionId = $this->createSubmission('physical-unchanged-live-content');
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'offering_id' => $offeringId,
        ], ['submission_id' => $submissionId])->execute();
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $submissionId,
            'material_type_id' => $bookId,
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000114',
            'materialized_physical_reference_id' => $referenceId,
            'public_note' => 'Synthetic pending physical note',
            'assigned_pages' => '7-9',
            'item_status' => 'pending',
        ])->execute();
        $itemId = (int)\Yii::$app->db->getLastInsertID();

        $this->request($I, 'POST', 'workflow-claim/claim', [], ['kind' => 'reuse', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'public_note' => 'Synthetic corrected physical note',
            'assigned_pages' => '10-12',
        ], ['kind' => 'reuse', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);

        $live = \Yii::$app->db->createCommand(
            'SELECT public_note, assigned_pages, start_visibility, end_visibility, use_visibility '
            . 'FROM physical_resource_references WHERE reference_id = :id',
            [':id' => $referenceId]
        )->queryOne();
        Assert::assertSame('Synthetic existing physical note', $live['public_note']);
        Assert::assertSame('2-4', $live['assigned_pages']);
        Assert::assertSame('2026-09-01', $live['start_visibility']);
        Assert::assertSame('2026-12-01', $live['end_visibility']);
        Assert::assertSame(1, (int)$live['use_visibility']);
        $this->request($I, 'GET', 'workflow-publication/state', [], ['kind' => 'reuse', 'id' => $itemId]);
        Assert::assertFalse($this->response($I)['publication']['actions']['can_publish']);
    }

    public function testEmptyChildCollectionsAndExplicitBibliographicClearStayFrozen(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $resourceId = $this->createSource($ebookId);
        \Yii::$app->db->createCommand()->update('resources', [
            'external_note' => 'Synthetic note from another course entry',
            'assigned_pages' => '1-2',
        ], ['resource_id' => $resourceId])->execute();
        \Yii::$app->db->createCommand()->insert('resource_metadata', [
            'resource_id' => $resourceId,
            'field_name' => 'pages',
            'field_value' => '1-10',
        ])->execute();
        $submissionId = $this->createSubmission('empty-child-clear');
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $item = SubmissionNewResource::findOne($itemId);
        $item->material_type_id = $ebookId;
        $item->source_resource_id = (string)$resourceId;
        $item->resource_data = json_encode([
            'title' => 'Synthetic pending item',
            'pages' => null,
        ], JSON_UNESCAPED_SLASHES);
        Assert::assertTrue($item->save());

        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $before = $this->response($I)['projection']['copy_inputs'];
        Assert::assertSame([], $before['additional_links'], 'An empty source collection means no copied children.');
        Assert::assertArrayHasKey('pages', $before['bibliographic_metadata']);
        Assert::assertNull($before['bibliographic_metadata']['pages'], 'An explicit clear must not fall back to source metadata.');
        Assert::assertNull($this->response($I)['projection']['inputs']['public_note']);
        Assert::assertNull($this->response($I)['projection']['inputs']['assigned_pages']);

        $resource = Resources::findOne($resourceId);
        $resource->name = 'Synthetic changed source after explicit clear';
        Assert::assertTrue($resource->save());
        \Yii::$app->db->createCommand()->update('resource_metadata', [
            'field_value' => '11-20',
        ], ['resource_id' => $resourceId, 'field_name' => 'pages'])->execute();
        \Yii::$app->db->createCommand()->insert('resource_links', [
            'resource_id' => $resourceId,
            'url' => 'https://links.example.test/added-after-clear',
            'title' => 'Synthetic later child',
        ])->execute();

        $this->request($I, 'GET', 'workflow-publication/projection', [], ['kind' => 'new', 'id' => $itemId]);
        $after = $this->response($I)['projection']['copy_inputs'];
        Assert::assertSame($before, $after, 'Cleared fields and empty children must not be resurrected from current source rows.');
    }

    private function addSourceChildren($resourceId)
    {
        $db = \Yii::$app->db;
        foreach ([
            ['title', 'Synthetic source metadata title'], ['authors', 'Synthetic author'],
            ['publisher', 'Synthetic press'], ['publicationYear', '2025'], ['isbn', 'Synthetic ISBN'],
            ['issn', 'Synthetic ISSN'], ['doi', '10.0000/api114'], ['journalTitle', 'Synthetic journal'],
            ['volume', '4'], ['issue', '2'], ['edition', 'Third'], ['pages', '1-9'],
            ['internal_note', 'Synthetic private metadata'], ['custom_private_key', 'Synthetic private metadata'],
        ] as $field) {
            $db->createCommand()->insert('resource_metadata', [
                'resource_id' => $resourceId, 'field_name' => $field[0], 'field_value' => $field[1],
            ])->execute();
        }
        foreach ([
            [
                'url' => 'https://links.example.test/first', 'title' => 'Synthetic first link', 'order' => 2,
                'use_proxy' => 1, 'use_link_visibility' => 1, 'start_visibility' => '2027-02-01',
            ],
            [
                'url' => 'https://links.example.test/second', 'title' => 'Synthetic second link', 'order' => 8,
                'use_proxy' => 0, 'use_link_visibility' => 0,
            ],
        ] as $link) {
            $db->createCommand()->insert('resource_links', array_merge(['resource_id' => $resourceId], $link))->execute();
        }
        $db->createCommand()->update('resources', [
            'use_proxy' => 0,
            'use_primary_link_visibility' => 0,
            'primary_link_start_visibility' => '2026-08-01',
            'primary_link_end_visibility' => '2026-12-31',
        ], ['resource_id' => $resourceId])->execute();
    }

    private function addConflictingOtherCourseLinkSettings($resourceId)
    {
        $db = \Yii::$app->db;
        $uuid = $this->uuid();
        $db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $uuid,
            'course_name' => 'Synthetic unrelated API-114 course',
            'course_number' => 'TST-114-' . substr(str_replace('-', '', $uuid), 0, 8),
        ])->execute();
        $courseId = (int)$db->getLastInsertID();
        $this->courseIds[] = $courseId;
        $db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $courseId,
            'folio_course_id' => 'api114-other-listing-' . bin2hex(random_bytes(3)),
            'term_id' => 'api114-other-term-' . bin2hex(random_bytes(3)),
            'term_name' => 'Synthetic unrelated term',
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)$db->getLastInsertID();
        $this->offeringIds[] = $offeringId;
        $db->createCommand()->insert('course_resources', [
            'offering_id' => $offeringId,
            'resource_id' => $resourceId,
            'use_primary_link_visibility' => 1,
            'primary_link_start_visibility' => '2026-01-01',
            'primary_link_end_visibility' => '2026-06-01',
        ])->execute();
    }

    private function insertPhysicalDestination($offeringId)
    {
        \Yii::$app->db->createCommand()->insert('physical_resource_references', [
            'external_resource_id' => 'API114-PHYSICAL-DRAFT-BARCODE',
            'folio_instance_id' => '00000000-0000-4000-8000-000000000114',
            'legacy_identifier' => 'API114-PHYSICAL-DRAFT-BARCODE',
            'legacy_identifier_type' => 'barcode',
            'identity_status' => 'verified',
            'identity_provenance_json' => json_encode(['outcome' => 'verified']),
            'resource_type' => 'physical',
            'display_name' => 'Synthetic existing physical title',
            'offering_id' => $offeringId,
            'order' => 3,
            'public_note' => 'Synthetic existing physical note',
            'assigned_pages' => '2-4',
            'start_visibility' => '2026-09-01',
            'end_visibility' => '2026-12-01',
            'use_visibility' => 1,
        ])->execute();
    }

    private function insertSyntheticCourse($suffix)
    {
        $db = \Yii::$app->db;
        $uuid = $this->uuid();
        $db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $uuid,
            'course_name' => 'Synthetic API-114 ' . $suffix,
            'course_number' => 'TST-114-' . substr(str_replace('-', '', $uuid), 0, 8),
        ])->execute();
        $courseId = (int)$db->getLastInsertID();
        $this->courseIds[] = $courseId;
        return $courseId;
    }

    private function insertSyntheticOffering($courseId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $courseId,
            'folio_course_id' => 'api114-listing-' . bin2hex(random_bytes(3)),
            'term_id' => 'api114-term-' . bin2hex(random_bytes(3)),
            'term_name' => 'Synthetic API-114 term',
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)$db->getLastInsertID();
        $this->offeringIds[] = $offeringId;
        return $offeringId;
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
