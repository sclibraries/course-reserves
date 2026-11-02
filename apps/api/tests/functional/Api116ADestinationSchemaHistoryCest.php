<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationSchemaHistoryCest extends Api116ADestinationSchemaTestBase
{
    public function testSchemaAllowsRepeatedAttachmentHistoryButOnlyOneLiveRowPerItem(FunctionalTester $I)
    {
        $first = $this->insertDestination([
            'course_resource_id' => $this->electronic['course_resource_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
        ]);
        $secondEntry = $this->fixtures->createElectronicDestination($this->offeringId, 'schema-second');
        $second = $this->insertDestination([
            'course_resource_id' => $secondEntry['course_resource_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
        ]);

        $this->insertAttachment($first, 1);
        $this->assertRejected(function () use ($second) {
            $this->insertAttachment($second, 1);
        }, 'One item cannot have two live attachments.');
        \Yii::$app->db->createCommand()->update('publication_attachments', [
            'live' => null,
            'detached_at' => '2026-11-02 12:00:00',
        ], ['destination_id' => $first])->execute();
        $this->insertAttachment($second, 1);
        $this->insertAttachment($first, null, '2026-11-02 12:01:00');

        $rows = \Yii::$app->db->createCommand(
            'SELECT destination_id, live, detached_at FROM publication_attachments '
            . 'WHERE item_kind = "new" AND item_id = :item_id ORDER BY id',
            [':item_id' => $this->item['id']]
        )->queryAll();
        Assert::assertSame([
            ['destination_id' => (string)$first, 'live' => null, 'detached_at' => '2026-11-02 12:00:00'],
            ['destination_id' => (string)$second, 'live' => '1', 'detached_at' => null],
            ['destination_id' => (string)$first, 'live' => null, 'detached_at' => '2026-11-02 12:01:00'],
        ], $rows, 'Detached rows remain as history while exactly one row is live.');
    }

    public function testSchemaAllowsRepeatedOwnershipHistoryButOnlyOneLiveOwnerPerItem(FunctionalTester $I)
    {
        $first = $this->insertDestination([
            'course_resource_id' => $this->electronic['course_resource_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
            'owner_item_kind' => 'new',
            'owner_item_id' => $this->item['id'],
            'owner_live' => 1,
            'ownership_source' => 'published',
        ]);
        $secondEntry = $this->fixtures->createElectronicDestination($this->offeringId, 'owner-second');
        $this->assertRejected(function () use ($secondEntry) {
            $this->insertDestination([
                'course_resource_id' => $secondEntry['course_resource_id'],
                'offering_id' => $this->offeringId,
                'origin_offering_id' => $this->offeringId,
                'owner_item_kind' => 'new',
                'owner_item_id' => $this->item['id'],
                'owner_live' => 1,
                'ownership_source' => 'published',
            ]);
        }, 'One item cannot own two live destinations.');

        \Yii::$app->db->createCommand()->update('publication_destinations', [
            'owner_live' => null,
            'ownership_source' => 'released',
        ], ['id' => $first])->execute();
        $second = $this->insertDestination([
            'course_resource_id' => $secondEntry['course_resource_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
            'owner_item_kind' => 'new',
            'owner_item_id' => $this->item['id'],
            'owner_live' => 1,
            'ownership_source' => 'published',
        ]);
        $this->insertDestination([
            'course_resource_id' => $this->fixtures->createElectronicDestination(
                $this->offeringId,
                'owner-third'
            )['course_resource_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
            'owner_item_kind' => 'new',
            'owner_item_id' => $this->item['id'],
            'owner_live' => null,
            'ownership_source' => 'released',
        ]);

        $rows = \Yii::$app->db->createCommand(
            'SELECT id, owner_item_kind, owner_item_id, owner_live, ownership_source '
            . 'FROM publication_destinations WHERE owner_item_id = :item_id ORDER BY id',
            [':item_id' => $this->item['id']]
        )->queryAll();
        Assert::assertSame(3, count($rows));
        Assert::assertSame('released', $rows[0]['ownership_source']);
        Assert::assertNull($rows[0]['owner_live']);
        Assert::assertSame((string)$second, $rows[1]['id']);
        Assert::assertSame('1', $rows[1]['owner_live']);
        Assert::assertSame('released', $rows[2]['ownership_source']);
    }
}
