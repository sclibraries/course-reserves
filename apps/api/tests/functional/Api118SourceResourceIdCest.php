<?php

require_once __DIR__ . '/../_support/Api109FunctionalCest.php';

use PHPUnit\Framework\Assert;
use app\models\Resources;
use app\models\SubmissionNewResource;
use app\models\SubmissionReuseResource;
use app\services\EffectiveMaterialType;
use app\services\ItemClaimListRepository;
use app\services\ItemClaimRepository;
use app\services\ResourceMutationService;
use app\services\SubmissionItemMaterializationService;
use app\services\SubmissionPublicationInvalidator;
use app\services\SubmissionSourceSnapshot;

/** Protects local-resource lookups from FOLIO UUID coercion in every runtime path. */
class Api118SourceResourceIdCest extends Api109FunctionalCest
{
    private $originalUrlManager;
    private $originalResourcesAutoIncrement;
    private $submissionIds = [];
    private $courseIds = [];
    private $offeringIds = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $db = \Yii::$app->db;
        $this->originalResourcesAutoIncrement = (int)$db->createCommand(
            'SELECT AUTO_INCREMENT FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "resources"'
        )->queryScalar();
        $this->originalUrlManager = \Yii::$app->get('urlManager');
        $webConfig = require codecept_root_dir('config/web.php');
        $urlManagerConfig = $webConfig['components']['urlManager'];
        $urlManagerConfig['class'] = \yii\web\UrlManager::class;
        \Yii::$app->set('urlManager', $urlManagerConfig);
        \Yii::$app->urlManager->showScriptName = false;
    }

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        try {
            foreach ($this->resourceIds as $resourceId) {
                $db->createCommand()->delete('resource_links', ['resource_id' => $resourceId])->execute();
                $db->createCommand()->delete('resource_metadata', ['resource_id' => $resourceId])->execute();
                $db->createCommand()->delete('course_resources', ['resource_id' => $resourceId])->execute();
            }
            foreach ($this->submissionIds as $submissionId) {
                $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionId])->execute();
                $db->createCommand()->delete('submission_publication_state', ['submission_id' => $submissionId])->execute();
                foreach (['submission_new_resources' => 'new', 'submission_reuse_resources' => 'reuse'] as $table => $kind) {
                    $ids = $db->createCommand(
                        'SELECT id FROM ' . $table . ' WHERE submission_id = :id', [':id' => $submissionId]
                    )->queryColumn();
                    if ($ids) {
                        $db->createCommand()->delete('item_flow_runs', [
                            'and', ['item_kind' => $kind], ['item_id' => $ids],
                        ])->execute();
                    }
                }
            }
        } finally {
            try {
                parent::_after($I);
            } finally {
                try {
                    foreach ($this->offeringIds as $offeringId) {
                        $db->createCommand()->delete('course_resources', ['offering_id' => $offeringId])->execute();
                        $db->createCommand()->delete('course_offerings', ['offering_id' => $offeringId])->execute();
                    }
                    foreach ($this->courseIds as $courseId) {
                        $db->createCommand()->delete('courses', ['course_id' => $courseId])->execute();
                    }
                } finally {
                    try {
                        if ($this->originalResourcesAutoIncrement > 0) {
                            $db->createCommand()->execute('ALTER TABLE resources AUTO_INCREMENT = '
                                . (int)$this->originalResourcesAutoIncrement);
                        }
                    } finally {
                        if ($this->originalUrlManager !== null) {
                            \Yii::$app->set('urlManager', $this->originalUrlManager);
                            $this->originalUrlManager = null;
                        }
                        $this->submissionIds = [];
                        $this->courseIds = [];
                        $this->offeringIds = [];
                    }
                }
            }
        }
    }

    public function testUuidPrefixesNeverResolveThroughSnapshotClaimsProjectionOrCopyRefresh(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $this->createCoercionTargets($ebookId);
        $items = $this->createUuidItems('runtime-lookups');
        $repository = new ItemClaimRepository();
        $queue = new ItemClaimListRepository($repository);

        foreach ($items as $item) {
            $uuid = $item['source_resource_id'];
            Assert::assertNull(SubmissionSourceSnapshot::capture($uuid), 'UUIDs are not local source ids.');

            $model = SubmissionNewResource::findOne($item['id']);
            Assert::assertNull(EffectiveMaterialType::modelId($model));
            Assert::assertTrue($model->save(), 'The synthetic UUID-only item should remain saveable.');
            $stored = $this->row($item['id']);
            Assert::assertNull($stored['source_snapshot_json']);
            Assert::assertNull($stored['material_type_id']);

            $claim = $repository->find('new', $item['id']);
            Assert::assertNull($claim['source_resource_found']);
            Assert::assertNull($claim['source_resource_title']);
            $queued = $this->findById($queue->queuePage('Fall 2027', 'new', 1, 5000), $item['id']);
            Assert::assertNotNull($queued, 'The synthetic item should remain in the staff queue.');
            Assert::assertNull($queued['source_resource_title']);
            Assert::assertNull($queued['material_type_id']);

            $this->setClaimedByStaff($item['id']);
            $status = $I->sendApiRequest(
                'GET', '/workflow/item/new/' . $item['id'] . '/projection', $this->staffToken
            );
            Assert::assertSame(200, $status);
            $projection = $I->grabJsonResponse()['projection'];
            Assert::assertNull($projection['source']['resource_id']);
            Assert::assertNotContains('source_resource_missing', $projection['blockers']);
            Assert::assertNotContains('copy_inputs_incomplete', $projection['blockers']);

            $status = $I->sendApiRequest(
                'POST', '/workflow/item/new/' . $item['id'] . '/refresh-copy-inputs', $this->staffToken
            );
            Assert::assertSame(409, $status);
            Assert::assertSame(
                'copy_input_refresh_requires_local_electronic_source',
                $I->grabJsonResponse()['error_code']
            );
            Assert::assertNull($this->row($item['id'])['source_snapshot_json']);
        }
    }

    public function testProtectionCanonicalIdsStillWorkInAllThreeItemRepresentations(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $sourceId = $this->createSource($ebookId);
        $submissionId = $this->createTrackedSubmission('canonical-representations');
        $new = SubmissionNewResource::find()->where(['submission_id' => $submissionId])->one();
        $new->material_type_id = null;
        $new->source_resource_id = (string)$sourceId;
        $new->resource_data = json_encode(['title' => 'Synthetic canonical new item', 'materialType' => 'ebook']);
        Assert::assertTrue($new->save());

        $newReuse = new SubmissionNewResource();
        $newReuse->submission_id = $submissionId;
        $newReuse->material_type_id = null;
        $newReuse->is_reuse = 1;
        $newReuse->source_resource_id = (string)$sourceId;
        $newReuse->resource_data = json_encode(['title' => 'Synthetic canonical new-table reuse']);
        Assert::assertTrue($newReuse->save());

        $legacyReuse = new SubmissionReuseResource();
        $legacyReuse->submission_id = $submissionId;
        $legacyReuse->material_type_id = null;
        $legacyReuse->source_resource_id = $sourceId;
        Assert::assertTrue($legacyReuse->save());

        foreach ([['new', $new->id], ['new', $newReuse->id], ['reuse', $legacyReuse->id]] as $ref) {
            $row = (new ItemClaimRepository())->find($ref[0], $ref[1]);
            Assert::assertSame((string)$sourceId, (string)$row['source_resource_found']);
            Assert::assertSame('Synthetic API-109 source', $row['source_resource_title']);
            $status = $I->sendApiRequest(
                'GET', '/workflow/item/' . $ref[0] . '/' . $ref[1] . '/projection', $this->staffToken
            );
            Assert::assertSame(200, $status);
            Assert::assertSame(
                (string)$sourceId,
                $I->grabJsonResponse()['projection']['source']['resource_id']
            );
        }
        foreach ([$new, $newReuse, $legacyReuse] as $model) {
            Assert::assertSame($ebookId, EffectiveMaterialType::modelId($model));
            Assert::assertNotNull($model->source_snapshot_json);
        }
        Assert::assertSame((string)$sourceId, (string)$this->row($new->id)['source_resource_id']);
        $this->setClaimedByStaff($new->id);
        Assert::assertSame(
            200,
            $I->sendApiRequest(
                'POST', '/workflow/item/new/' . $new->id . '/refresh-copy-inputs', $this->staffToken
            )
        );

        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM resources WHERE resource_id = 2147483647'
        )->queryScalar());
        \Yii::$app->db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submissionId,
            'material_type_id' => $ebookId,
            'source_resource_id' => '2147483647',
            'resource_data' => json_encode(['title' => 'Synthetic dangling canonical source']),
            'item_status' => 'pending',
        ])->execute();
        $danglingId = (int)\Yii::$app->db->getLastInsertID();
        $status = $I->sendApiRequest(
            'GET', '/workflow/item/new/' . $danglingId . '/projection', $this->staffToken
        );
        Assert::assertSame(200, $status);
        $dangling = $I->grabJsonResponse()['projection'];
        Assert::assertContains('source_resource_missing', $dangling['blockers']);
        Assert::assertSame('2147483647', $dangling['source']['resource_id']);
    }

    public function testUuidRowsDoNotEnterMaterialTypeOrUnpinnedFlowInvalidation(FunctionalTester $I)
    {
        $bookId = $this->materialTypeId('book');
        $this->createCoercionTargets($bookId);
        $items = $this->createUuidItems('no-uuid-invalidation');
        $db = \Yii::$app->db;
        $db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $items[0]['submission_id'],
            'source_resource_id' => '81390788',
            'resource_data' => json_encode(['title' => 'Synthetic canonical dependent']),
            'item_status' => 'pending',
        ])->execute();
        $canonicalItem = ['id' => (int)$db->getLastInsertID()];
        $allItems = $items;
        $allItems[] = $canonicalItem;
        $this->mapTypesToSameFlow([$bookId]);

        $readinessContext = ['synthetic' => 'API-118 invalidation readiness'];
        $seedReady = function ($itemId) use ($db, $readinessContext) {
            return $db->createCommand()->update('submission_publication_state', [
                'state' => 'ready',
                'readiness_source' => 'manual',
                'readiness_reason' => 'Synthetic API-118 readiness',
                'readiness_revision' => 1,
                'readiness_context_json' => json_encode($readinessContext),
            ], ['item_kind' => 'new', 'item_id' => $itemId])->execute();
        };
        $assertReadiness = function ($itemId, $ready) use ($db, $readinessContext) {
            $state = $db->createCommand(
                'SELECT state, draft_revision, readiness_source, readiness_reason, readiness_revision, '
                . 'readiness_context_json FROM submission_publication_state '
                . 'WHERE item_kind = "new" AND item_id = :id', [':id' => $itemId]
            )->queryOne();
            Assert::assertNotFalse($state);
            Assert::assertSame($ready ? 'ready' : 'pending', $state['state']);
            Assert::assertSame(1, (int)$state['draft_revision']);
            Assert::assertSame($ready ? 'manual' : null, $state['readiness_source']);
            Assert::assertSame($ready ? 'Synthetic API-118 readiness' : null, $state['readiness_reason']);
            Assert::assertSame($ready ? 1 : null, $state['readiness_revision'] === null
                ? null : (int)$state['readiness_revision']);
            Assert::assertSame(
                $ready ? $readinessContext : null,
                json_decode($state['readiness_context_json'] ?: 'null', true)
            );
        };

        foreach ($allItems as $item) {
            $this->setClaimedByStaff($item['id']);
            $this->publicationRevisionFromRoute($I, $item['id']);
            Assert::assertSame(1, $seedReady($item['id']));
            $assertReadiness($item['id'], true);
        }

        $invalidator = new SubmissionPublicationInvalidator();
        $invalidator->materialTypes([$bookId]);
        foreach ($items as $item) {
            $assertReadiness($item['id'], true);
        }
        $assertReadiness($canonicalItem['id'], false);

        Assert::assertSame(1, $seedReady($canonicalItem['id']));
        $assertReadiness($canonicalItem['id'], true);
        $invalidator->unpinnedFlowItems($this->flowId);
        foreach ($items as $item) {
            $assertReadiness($item['id'], true);
        }
        $assertReadiness($canonicalItem['id'], false);
    }

    public function testProtectionUuidRowsIgnoreSourceSaveDeleteAndChildLinkInvalidation(FunctionalTester $I)
    {
        $bookId = $this->materialTypeId('book');
        $this->createCoercionTargets($bookId);
        $items = $this->createUuidItems('source-mutations');
        $revisions = [];
        foreach ($items as $item) {
            $this->setClaimedByStaff($item['id']);
            $this->publicationRevisionFromRoute($I, $item['id']);
            $revisions[$item['id']] = (int)$this->publicationRevision('new', $item['id']);
        }

        $mutation = new ResourceMutationService();
        foreach ($this->resourceIds as $resourceId) {
            $resource = Resources::findOne($resourceId);
            $resource->name .= ' updated';
            Assert::assertTrue($resource->save());
            $link = $mutation->addLink($resourceId, [
                'url' => 'https://links.example.test/api118-' . $resourceId,
                'title' => 'Synthetic API-118 link',
            ]);
            Assert::assertInstanceOf(\app\models\ResourceLinks::class, $link);
            Assert::assertSame(['success' => true], $mutation->deleteLink($link->link_id));
            Assert::assertSame(1, $resource->delete());
            $this->assertRevisionsUnchanged($I, $items, $revisions);
        }
    }

    public function testMaterializationRejectsUuidAndExponentIdsButKeepsCanonicalNumericId(FunctionalTester $I)
    {
        $ebookId = $this->materialTypeId('ebook');
        $this->createCoercionTargets($ebookId);
        $submissionId = $this->createTrackedSubmission('materialization');
        $courseId = $this->insertCourse();
        $offeringId = $this->insertOffering($courseId);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'offering_id' => $offeringId,
            'folio_course_listing_id' => 'api118-listing-' . $offeringId,
        ], ['submission_id' => $submissionId])->execute();

        $cases = [
            ['81390788-f8c0-4000-8000-000000000118', 81390788, 'Synthetic digit-led UUID materialization'],
            ['4e5a0000-0000-4000-8000-000000000118', 400000, 'Synthetic exponent-led UUID materialization'],
            ['4e5', 400000, 'Synthetic exponent source materialization'],
        ];
        foreach ($cases as $index => $case) {
            $itemId = $this->insertMaterializationItem($submissionId, $ebookId, $case[0], $case[2]);
            $result = (new SubmissionItemMaterializationService())->completeProcessing(
                SubmissionNewResource::findOne($itemId), 'synthetic-api118-staff'
            );
            Assert::assertNotSame($case[1], $result['materialized_resource_id'], $case[0]);
            Assert::assertSame($case[0], $this->row($itemId)['source_resource_id']);
            $this->resourceIds[] = (int)$result['materialized_resource_id'];
        }

        $canonicalId = $this->insertMaterializationItem(
            $submissionId, $ebookId, '400000', 'Synthetic canonical numeric source materialization'
        );
        $canonicalResult = (new SubmissionItemMaterializationService())->completeProcessing(
            SubmissionNewResource::findOne($canonicalId), 'synthetic-api118-staff'
        );
        Assert::assertSame(400000, $canonicalResult['materialized_resource_id']);
    }

    protected function createSubmission($suffix)
    {
        $submissionId = parent::createSubmission($suffix);
        $this->submissionIds[] = $submissionId;
        return $submissionId;
    }

    private function createTrackedSubmission($suffix)
    {
        return $this->createSubmission($suffix);
    }

    private function createCoercionTargets($materialTypeId)
    {
        Assert::assertGreaterThan(0, $materialTypeId);
        $this->insertResourceAt(81390788, $materialTypeId);
        $this->insertResourceAt(400000, $materialTypeId);
    }

    private function insertResourceAt($resourceId, $materialTypeId)
    {
        $db = \Yii::$app->db;
        Assert::assertSame(0, (int)$db->createCommand(
            'SELECT COUNT(*) FROM resources WHERE resource_id = :id', [':id' => $resourceId]
        )->queryScalar(), 'Coercion fixture resource ids must be unused.');
        $db->createCommand()->insert('resources', [
            'resource_id' => $resourceId,
            'name' => 'Synthetic API-118 source ' . $resourceId,
            'item_url' => 'https://source.example.test/api118/' . $resourceId,
            'description' => 'Synthetic API-118 source description',
            'material_type_id' => $materialTypeId,
            'use_proxy' => 0,
        ])->execute();
        $this->resourceIds[] = $resourceId;
    }

    private function createUuidItems($suffix)
    {
        $submissionId = $this->createTrackedSubmission($suffix);
        $db = \Yii::$app->db;
        $db->createCommand()->delete('submission_new_resources', ['submission_id' => $submissionId])->execute();
        $items = [];
        foreach ([
            ['81390788-f8c0-4000-8000-000000000118', 0],
            ['4e5a0000-0000-4000-8000-000000000118', 1],
        ] as $index => $value) {
            $db->createCommand()->insert('submission_new_resources', [
                'submission_id' => $submissionId,
                'material_type_id' => null,
                'is_reuse' => $value[1],
                'source_resource_id' => $value[0],
                'resource_data' => json_encode([
                    'title' => 'Synthetic API-118 UUID item ' . $index,
                    'materialType' => 'ebook',
                ]),
                'item_status' => 'pending',
                'source_snapshot_json' => null,
            ])->execute();
            $items[] = [
                'id' => (int)$db->getLastInsertID(),
                'source_resource_id' => $value[0],
                'submission_id' => $submissionId,
            ];
        }
        return $items;
    }

    private function insertMaterializationItem($submissionId, $materialTypeId, $sourceId, $title)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submissionId,
            'material_type_id' => $materialTypeId,
            'source_resource_id' => $sourceId,
            'resource_data' => json_encode([
                'title' => $title,
                'url' => 'https://new.example.test/api118/' . rawurlencode($title),
                'materialType' => 'ebook',
            ]),
            'item_status' => 'pending',
        ])->execute();
        return (int)$db->getLastInsertID();
    }

    private function insertCourse()
    {
        $uuid = $this->uuidForFixture();
        \Yii::$app->db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $uuid,
            'course_name' => $this->prefix . 'API-118 materialization course',
            'course_number' => 'TST-118-' . substr(str_replace('-', '', $uuid), 0, 8),
        ])->execute();
        $courseId = (int)\Yii::$app->db->getLastInsertID();
        $this->courseIds[] = $courseId;
        return $courseId;
    }

    private function insertOffering($courseId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuidForFixture(),
            'course_id' => $courseId,
            'folio_course_id' => 'api118-listing-' . bin2hex(random_bytes(3)),
            'term_id' => 'api118-term-' . bin2hex(random_bytes(3)),
            'term_name' => 'Synthetic API-118 term',
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)$db->getLastInsertID();
        $this->offeringIds[] = $offeringId;
        return $offeringId;
    }

    private function setClaimedByStaff($itemId)
    {
        $now = date('Y-m-d H:i:s');
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $this->prefix . 'staff',
            'claimed_at' => $now,
            'last_activity_at' => $now,
        ], ['id' => $itemId])->execute();
    }

    private function uuidForFixture()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    private function publicationRevisionFromRoute(FunctionalTester $I, $itemId)
    {
        $status = $I->sendApiRequest(
            'GET', '/workflow/item/new/' . $itemId . '/publication', $this->staffToken
        );
        Assert::assertSame(200, $status);
        $response = $I->grabJsonResponse();
        Assert::assertArrayHasKey('publication', $response);
    }

    private function assertRevisionsUnchanged(FunctionalTester $I, array $items, array $revisions)
    {
        foreach ($items as $item) {
            $this->publicationRevisionFromRoute($I, $item['id']);
            Assert::assertSame($revisions[$item['id']], (int)$this->publicationRevision('new', $item['id']));
        }
    }

    private function row($itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT id, source_resource_id, material_type_id, source_snapshot_json '
            . 'FROM submission_new_resources WHERE id = :id', [':id' => $itemId]
        )->queryOne();
    }

    private function findById(array $rows, $itemId)
    {
        foreach ($rows as $row) {
            if ((int)$row['id'] === (int)$itemId) {
                return $row;
            }
        }
        return null;
    }
}
