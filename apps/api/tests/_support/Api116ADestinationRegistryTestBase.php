<?php

use PHPUnit\Framework\Assert;
use app\services\PublicationDestinationLock;
use app\services\PublicationDestinationRegistry;
use app\services\Transactional;

/** Covers the API-116A registry service, lifecycle retries and contract conflicts. */
class Api116ADestinationRegistryTestBase extends Api109FunctionalCest
{
    protected $prefix = 'test-api116a-registry-';
    protected $fixtures;
    protected $offering;
    protected $otherOffering;
    protected $owner;
    protected $attached;
    protected $otherItem;
    protected $destinationIds = [];
    protected $triggerName = 'api116a_force_attachment_update_failure';

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->fixtures = new Api116AFixture('test-api116a-registry-');
        $this->offering = $this->fixtures->createOffering('registry-one');
        $this->otherOffering = $this->fixtures->createOffering('registry-other');
        $this->owner = $this->fixtures->createItem('registry-owner', $this->offering);
        $this->attached = $this->fixtures->createItem('registry-attached', $this->offering);
        $this->otherItem = $this->fixtures->createItem('registry-other-item', $this->offering);
    }

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->execute('DROP TRIGGER IF EXISTS ' . $this->triggerName);
        if ($db->schema->getTableSchema('publication_attachments', true) && $this->destinationIds) {
            $db->createCommand()->delete('publication_attachments', ['destination_id' => $this->destinationIds])->execute();
        }
        if ($db->schema->getTableSchema('publication_destinations', true) && $this->destinationIds) {
            $db->createCommand()->delete('publication_destinations', ['id' => $this->destinationIds])->execute();
        }
        $this->fixtures->cleanup();
        $this->destinationIds = [];
        parent::_after($I);
    }

    protected function registry()
    {
        return new PublicationDestinationRegistry();
    }

    protected function registerOwner($suffix)
    {
        $pointer = null;
        $this->success(Transactional::run(function () use (&$pointer, $suffix) {
            $pointer = $this->fixtures->createElectronicDestination($this->offering, $suffix);
            return $this->registry()->registerOwned(Api116AFixture::itemKey($this->owner), $pointer);
        }));
        return $pointer;
    }

    protected function insertDestination(array $pointer, array $values = [])
    {
        $pointer = array_intersect_key($pointer, array_flip([
            'destination_kind', 'course_resource_id', 'physical_reference_id', 'offering_id',
        ]));
        $row = array_merge([
            'destination_kind' => 'electronic',
            'course_resource_id' => null,
            'physical_reference_id' => null,
            'offering_id' => $this->offering,
            'origin_offering_id' => $this->offering,
            'owner_item_kind' => null,
            'owner_item_id' => null,
            'owner_live' => null,
            'ownership_source' => 'none',
            'retired_at' => null,
        ], $pointer, $values);
        \Yii::$app->db->createCommand()->insert('publication_destinations', $row)->execute();
        $id = (int)\Yii::$app->db->getLastInsertID();
        $this->destinationIds[] = $id;
        return $id;
    }

    protected function insertAttachment($destinationId, array $item)
    {
        \Yii::$app->db->createCommand()->insert('publication_attachments', [
            'destination_id' => $destinationId,
            'item_kind' => $item['kind'],
            'item_id' => $item['id'],
            'attached_snapshot_json' => '{"destination_kind":"electronic","name":"Synthetic prior snapshot"}',
            'live' => 1,
        ])->execute();
    }

    protected function destinationRow($id)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM publication_destinations WHERE id = :id', [':id' => $id]
        )->queryOne();
    }

    protected function destinationIdForCourseResource($courseResourceId)
    {
        $id = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM publication_destinations WHERE course_resource_id = :id',
            [':id' => $courseResourceId]
        )->queryScalar();
        $this->destinationIds[] = $id;
        return $id;
    }

    protected function destinationRowForItem(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM publication_destinations WHERE owner_item_kind = :kind AND owner_item_id = :id '
            . 'AND owner_live = 1',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryOne();
    }

    protected function attachmentRows(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM publication_attachments WHERE item_kind = :kind AND item_id = :id ORDER BY id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryAll();
    }

    protected function stateRow(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryOne();
    }

    protected function insertPublicationState(array $item)
    {
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => $item['kind'],
            'item_id' => $item['id'],
            'submission_id' => $item['submission_id'],
            'state' => 'published',
            'draft_revision' => 7,
            'published_revision' => 5,
            'pending_changes' => 'none',
            'published_destination_json' => '{"kind":"electronic","resource_id":116001}',
            'published_snapshot' => '{"resource":{"name":"Synthetic frozen publication"}}',
            'created_at' => '2026-10-04 10:00:00',
            'updated_at' => '2026-10-04 10:00:01',
        ])->execute();
    }

    protected function workflowEventCount(array $item)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE item_kind = :kind AND item_id = :id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryScalar();
    }

    protected function setIdentity(array $item, $instanceId)
    {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $column = $item['kind'] === 'new' ? 'resource_data' : 'source_snapshot_json';
        $frozenInput = [
            'version' => 1,
            'title' => 'Synthetic frozen input',
            'eds' => ['an' => Api116AFixture::accession($instanceId)],
        ];
        $values = [
            $column => json_encode($frozenInput),
            'staff_corrections_json' => '{"title":"Synthetic correction"}',
        ];
        if ($item['kind'] === 'new') {
            $values['resource_data'] = json_encode([
                'title' => 'Synthetic draft input',
                'eds' => ['an' => Api116AFixture::accession($instanceId)],
            ]);
            $values['source_snapshot_json'] = json_encode([
                'version' => 1,
                'title' => 'Synthetic frozen input',
            ]);
        }
        \Yii::$app->db->createCommand()->update($table, $values, ['id' => $item['id']])->execute();
    }

    protected function registryRowForCourseResource($courseResourceId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM publication_destinations WHERE course_resource_id = :id',
            [':id' => $courseResourceId]
        )->queryOne();
    }

    protected function assertSuccess(array $result)
    {
        Assert::assertSame(200, $result['status']);
    }

    protected function assertError(array $result, $errorCode)
    {
        Assert::assertSame(409, $result['status']);
        Assert::assertSame($errorCode, $result['body']['error_code']);
    }

    protected function success(array $result)
    {
        $this->assertSuccess($result);
    }

    protected function prefixFreePhysicalLabel($suffix)
    {
        return 'test-api116a-registry-live physical ' . $suffix;
    }

    protected function nextDestinationId()
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COALESCE(MAX(id), 0) + 100 FROM publication_destinations'
        )->queryScalar();
    }

    protected function electronicLiveRows(array $pointer)
    {
        $db = \Yii::$app->db;
        $resourceId = $pointer['resource_id'];
        return [
            'resource' => $db->createCommand(
                'SELECT * FROM resources WHERE resource_id = :id', [':id' => $resourceId]
            )->queryOne(),
            'course_resource' => $db->createCommand(
                'SELECT * FROM course_resources WHERE course_resource_id = :id',
                [':id' => $pointer['course_resource_id']]
            )->queryOne(),
            'metadata' => $db->createCommand(
                'SELECT * FROM resource_metadata WHERE resource_id = :id ORDER BY metadata_id',
                [':id' => $resourceId]
            )->queryAll(),
            'links' => $db->createCommand(
                'SELECT * FROM resource_links WHERE resource_id = :id ORDER BY link_id',
                [':id' => $resourceId]
            )->queryAll(),
        ];
    }

    protected function assertNoRegistryRowsForItem(array $item)
    {
        $db = \Yii::$app->db;
        if ($db->schema->getTableSchema('publication_destinations', true)) {
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM publication_destinations '
                . 'WHERE owner_item_kind = :kind AND owner_item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryScalar());
        }
        if ($db->schema->getTableSchema('publication_attachments', true)) {
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM publication_attachments WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryScalar());
        }
    }
}
