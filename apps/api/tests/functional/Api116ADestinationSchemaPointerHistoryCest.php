<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationSchemaPointerHistoryCest extends Api116ADestinationSchemaTestBase
{
    public function testSchemaRejectsBothSetPointersAndAllowsNullPointerInterimRows(FunctionalTester $I)
    {
        $orphanHistoryId = $this->insertDestination([
            'offering_id' => null,
            'origin_offering_id' => $this->offeringId,
        ]);
        $interimRow = \Yii::$app->db->createCommand(
            'SELECT course_resource_id, physical_reference_id, retired_at '
            . 'FROM publication_destinations WHERE id = :id',
            [':id' => $orphanHistoryId]
        )->queryOne();
        Assert::assertNull($interimRow['course_resource_id']);
        Assert::assertNull($interimRow['physical_reference_id']);
        Assert::assertNull($interimRow['retired_at'], 'A nulled pointer without retired_at is read as retired until API-116B.');

        $this->assertRejected(function () {
            $this->insertDestination([
                'course_resource_id' => $this->electronic['course_resource_id'],
                'physical_reference_id' => $this->physical['physical_reference_id'],
                'offering_id' => $this->offeringId,
                'origin_offering_id' => $this->offeringId,
            ]);
        }, 'A live destination cannot point to both destination kinds.');
    }

    public function testOfferingForeignKeySetsNullWhileOriginOfferingRemains(FunctionalTester $I)
    {
        $destinationId = $this->insertDestination([
            'course_resource_id' => $this->electronic['course_resource_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
        ]);
        \Yii::$app->db->createCommand()->delete('course_offerings', [
            'offering_id' => $this->offeringId,
        ])->execute();
        $row = \Yii::$app->db->createCommand(
            'SELECT offering_id, origin_offering_id, course_resource_id, retired_at '
            . 'FROM publication_destinations WHERE id = :id',
            [':id' => $destinationId]
        )->queryOne();
        Assert::assertNull($row['offering_id']);
        Assert::assertSame((string)$this->offeringId, $row['origin_offering_id']);
        Assert::assertNull($row['course_resource_id']);
        Assert::assertNull($row['retired_at']);

        $orphanHistoryId = $this->insertDestination([
            'offering_id' => null,
            'origin_offering_id' => 2147483000,
            'retired_at' => '2026-11-02 12:00:00',
        ]);
        Assert::assertSame('2147483000', (string)\Yii::$app->db->createCommand(
            'SELECT origin_offering_id FROM publication_destinations WHERE id = :id',
            [':id' => $orphanHistoryId]
        )->queryScalar(), 'origin_offering_id is retained history, without a foreign key.');
    }

    public function testDeletedPhysicalPointerSetsNullAndPreservesDestinationHistory(FunctionalTester $I)
    {
        $destinationId = $this->insertDestination([
            'destination_kind' => 'physical',
            'physical_reference_id' => $this->physical['physical_reference_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
        ]);
        \Yii::$app->db->createCommand()->delete('physical_resource_references', [
            'reference_id' => $this->physical['physical_reference_id'],
        ])->execute();
        $row = \Yii::$app->db->createCommand(
            'SELECT offering_id, origin_offering_id, physical_reference_id, retired_at '
            . 'FROM publication_destinations WHERE id = :id',
            [':id' => $destinationId]
        )->queryOne();
        Assert::assertSame((string)$this->offeringId, $row['offering_id']);
        Assert::assertSame((string)$this->offeringId, $row['origin_offering_id']);
        Assert::assertNull($row['physical_reference_id']);
        Assert::assertNull($row['retired_at'], 'A null live pointer is interpreted as retired until API-116B wires lifecycle.');
    }
}
