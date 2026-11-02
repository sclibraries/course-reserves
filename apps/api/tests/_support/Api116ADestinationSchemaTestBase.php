<?php

use PHPUnit\Framework\Assert;
use yii\db\IntegrityException;

/** Defines the API-116A foreign-key and live-history database contract. */
class Api116ADestinationSchemaTestBase extends BaseFunctionalCest
{
    protected $fixtures;
    protected $offeringId;
    protected $item;
    protected $electronic;
    protected $physical;
    protected $destinationIds = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->fixtures = new Api116AFixture();
        $this->offeringId = $this->fixtures->createOffering('schema');
        $this->item = $this->fixtures->createItem('schema-item', $this->offeringId);
        $this->electronic = $this->fixtures->createElectronicDestination($this->offeringId, 'schema');
        $this->physical = $this->fixtures->createPhysicalDestination(
            $this->offeringId,
            'schema',
            '00000000-0000-4000-8000-000000001116'
        );
    }

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        if ($db->schema->getTableSchema('publication_attachments', true) && $this->destinationIds) {
            $db->createCommand()->delete('publication_attachments', [
                'destination_id' => $this->destinationIds,
            ])->execute();
        }
        if ($db->schema->getTableSchema('publication_destinations', true) && $this->destinationIds) {
            $db->createCommand()->delete('publication_destinations', ['id' => $this->destinationIds])->execute();
        }
        $this->fixtures->cleanup();
        $this->destinationIds = [];
    }

    protected function insertDestination(array $overrides)
    {
        $values = array_merge([
            'destination_kind' => 'electronic',
            'course_resource_id' => null,
            'physical_reference_id' => null,
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
            'owner_item_kind' => null,
            'owner_item_id' => null,
            'owner_live' => null,
            'ownership_source' => 'none',
            'retired_at' => null,
        ], $overrides);
        \Yii::$app->db->createCommand()->insert('publication_destinations', $values)->execute();
        $id = (int)\Yii::$app->db->getLastInsertID();
        $this->destinationIds[] = $id;
        return $id;
    }

    protected function insertAttachment($destinationId, $live, $detachedAt = null)
    {
        \Yii::$app->db->createCommand()->insert('publication_attachments', [
            'destination_id' => $destinationId,
            'item_kind' => $this->item['kind'],
            'item_id' => $this->item['id'],
            'attached_snapshot_json' => json_encode(['title' => 'Synthetic live snapshot']),
            'live' => $live,
            'detached_at' => $detachedAt,
        ])->execute();
    }

    protected function assertRejected(callable $operation, $message)
    {
        try {
            $operation();
            Assert::fail($message);
        } catch (IntegrityException $exception) {
            Assert::assertNotSame('', $exception->getMessage());
        }
    }
}
