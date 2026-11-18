<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';
require_once __DIR__ . '/../_support/Api116AFixture.php';

use PHPUnit\Framework\Assert;
use app\services\ItemAssociationChanged;
use app\services\ItemWriteLock;
use app\services\ItemWriteLockProjection;

class Api119A4ItemWriteLockCest extends BaseFunctionalCest
{
    private $restore;
    private $fixture;
    private $prefix;
    private $materialTypeIds = [];
    private $resourceIds = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->restore = Api116B1CommittedConnection::swap();
        $this->prefix = 'test-api119a4-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        $this->fixture = new Api116AFixture($this->prefix);
    }

    public function _after(FunctionalTester $I)
    {
        try {
            $this->fixture->cleanup();
            foreach ($this->resourceIds as $id) {
                \Yii::$app->db->createCommand()->delete('resources', ['resource_id' => $id])->execute();
            }
            foreach ($this->materialTypeIds as $id) {
                \Yii::$app->db->createCommand()->delete('material_types', ['material_type_id' => $id])->execute();
            }
        } finally {
            call_user_func($this->restore);
        }
    }

    public function stagedLockReturnsCompleteRowsAndLegacyProjectionForBothKinds(FunctionalTester $I)
    {
        $offeringId = $this->fixture->createOffering('lock');
        $new = $this->fixture->createItem('new', $offeringId);
        $reuse = $this->fixture->createItem('reuse', $offeringId, 'legacy_reuse');
        $invalidSource = $this->fixture->createItem('invalid-source', $offeringId);
        $sourceTypeId = $this->materialType('Synthetic source type');
        $overrideTypeId = $this->materialType('Synthetic override type');
        $resourceId = $this->resource('Synthetic canonical source', $sourceTypeId);
        $this->fixture->createFinishedRun($new, 'projection');
        $db = \Yii::$app->db;
        foreach ([$new, $reuse, $invalidSource] as $reference) {
            $db->createCommand()->update('faculty_submissions', [
                'status' => 'draft', 'link_state' => 'needs_linking',
            ], ['submission_id' => $reference['submission_id']])->execute();
        }
        $db->createCommand()->update('submission_new_resources', [
            'source_resource_id' => (string)$resourceId,
            'material_type_id' => null,
            'staff_material_type_id' => null,
            'item_status' => 'in_progress',
            'display_order' => 17,
            'public_note' => 'Synthetic locked new note',
            'claimed_by' => $this->prefix . 'staff',
            'claimed_at' => '2020-01-01 00:00:00',
            'last_activity_at' => '2020-01-01 00:00:00',
        ], ['id' => $new['id']])->execute();
        $db->createCommand()->update('submission_reuse_resources', [
            'source_resource_id' => $resourceId,
            'material_type_id' => $sourceTypeId,
            'staff_material_type_id' => $overrideTypeId,
            'item_status' => 'in_progress',
            'display_order' => 23,
            'public_note' => 'Synthetic locked reuse note',
        ], ['id' => $reuse['id']])->execute();
        $db->createCommand()->update('submission_new_resources', [
            'source_resource_id' => '0' . $resourceId,
            'material_type_id' => null,
            'staff_material_type_id' => null,
        ], ['id' => $invalidSource['id']])->execute();

        $reader = new ItemWriteLock();
        $projection = new ItemWriteLockProjection();
        try {
            $reader->lock('new', $new['id']);
            Assert::fail('Item locks require an active transaction.');
        } catch (\LogicException $exception) {
            Assert::assertSame('ItemWriteLock requires an active transaction.', $exception->getMessage());
        }

        foreach ([$new, $reuse] as $reference) {
            $transaction = $db->beginTransaction();
            try {
                $locked = $reader->lock($reference['kind'], $reference['id']);
                Assert::assertNull($locked['missing']);
                Assert::assertSame($reference['submission_id'], (int)$locked['submission_id']);
                Assert::assertSame(
                    'Synthetic locked ' . ($reference['kind'] === 'new' ? 'new' : 'reuse') . ' note',
                    $locked['item']->getOldAttribute('public_note')
                );
                if ($reference['kind'] === 'new') {
                    Assert::assertSame($this->prefix . 'staff', $locked['item']->claimed_by);
                    Assert::assertSame('2020-01-01 00:00:00', $locked['item']->claimed_at);
                }
                $view = $projection->project($locked);
                Assert::assertSame($reference['id'], (int)$view['id']);
                Assert::assertSame('in_progress', $view['status']);
                Assert::assertSame($reference['kind'] === 'new' ? 17 : 23, (int)$view['position']);
                Assert::assertSame((string)$resourceId, (string)$view['source_resource_found']);
                Assert::assertSame('Synthetic canonical source', $view['source_resource_title']);
                Assert::assertSame(
                    $reference['kind'] === 'new' ? $sourceTypeId : $overrideTypeId,
                    (int)$view['effective_material_type_id']
                );
                Assert::assertSame('draft', $view['submission_status']);
                Assert::assertSame('needs_linking', $view['link_state']);
                if ($reference['kind'] === 'new') {
                    Assert::assertSame('available_online', $view['flow_finish_state']);
                    Assert::assertNotEmpty($view['flow_steps_json']);
                    Assert::assertNull($view['default_material_type_id']);
                } else {
                    Assert::assertNull($view['resource_data']);
                    Assert::assertSame($sourceTypeId, (int)$view['default_material_type_id']);
                }
                $transaction->rollBack();
            } finally {
                if ($transaction->isActive) {
                    $transaction->rollBack();
                }
            }
        }

        $transaction = $db->beginTransaction();
        try {
            $view = $projection->project($reader->lock('new', $invalidSource['id']));
            Assert::assertNull($view['source_resource_found']);
            Assert::assertNull($view['effective_material_type_id']);
            Assert::assertSame('draft', $view['submission_status']);
            $missing = $reader->lock('new', 999999999);
            Assert::assertSame('item', $missing['missing']);
        } finally {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
        }

        $target = $this->fixture->createItem('association-target', $offeringId);
        $transaction = $db->beginTransaction();
        try {
            $candidate = $reader->discoverSubmissionId('new', $new['id']);
            $db->createCommand()->update('submission_new_resources', [
                'submission_id' => $target['submission_id'],
            ], ['id' => $new['id']])->execute();
            $reader->lockDiscovered('new', $new['id'], $candidate);
            Assert::fail('An item that moved after discovery must restart its owner.');
        } catch (ItemAssociationChanged $exception) {
            Assert::assertInstanceOf(ItemAssociationChanged::class, $exception);
        } finally {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
        }

        $transaction = $db->beginTransaction();
        try {
            $candidate = $reader->discoverSubmissionId('new', $invalidSource['id']);
            $db->createCommand()->delete('submission_new_resources', ['id' => $invalidSource['id']])->execute();
            Assert::assertSame('item', $reader->lockDiscovered('new', $invalidSource['id'], $candidate)['missing']);
        } finally {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
        }
    }

    private function materialType($label)
    {
        \Yii::$app->db->createCommand()->insert('material_types', ['name' => $this->prefix . $label])->execute();
        $id = (int)\Yii::$app->db->getLastInsertID();
        $this->materialTypeIds[] = $id;
        return $id;
    }

    private function resource($name, $materialTypeId)
    {
        \Yii::$app->db->createCommand()->insert('resources', [
            'name' => $name,
            'material_type_id' => $materialTypeId,
        ])->execute();
        $id = (int)\Yii::$app->db->getLastInsertID();
        $this->resourceIds[] = $id;
        return $id;
    }
}
