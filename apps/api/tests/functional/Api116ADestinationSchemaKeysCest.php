<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationSchemaKeysCest extends Api116ADestinationSchemaTestBase
{
    public function testSchemaRejectsInvalidOfferingDestinationAndAttachmentForeignKeys(FunctionalTester $I)
    {
        $this->assertRejected(function () {
            $this->insertDestination([
                'course_resource_id' => $this->electronic['course_resource_id'],
                'offering_id' => 2147483000,
                'origin_offering_id' => 2147483000,
            ]);
        }, 'Unknown live offering must violate the offering foreign key.');

        $this->assertRejected(function () {
            $this->insertDestination([
                'course_resource_id' => 2147483000,
                'offering_id' => $this->offeringId,
                'origin_offering_id' => $this->offeringId,
            ]);
        }, 'Unknown course resource must violate the pointer foreign key.');

        $this->assertRejected(function () {
            $this->insertDestination([
                'destination_kind' => 'physical',
                'physical_reference_id' => 2147483000,
                'offering_id' => $this->offeringId,
                'origin_offering_id' => $this->offeringId,
            ]);
        }, 'Unknown physical reference must violate the pointer foreign key.');

        $destinationId = $this->insertDestination([
            'course_resource_id' => $this->electronic['course_resource_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
        ]);
        $this->assertRejected(function () {
            \Yii::$app->db->createCommand()->insert('publication_attachments', [
                'destination_id' => 2147483000,
                'item_kind' => 'new',
                'item_id' => 2147483000,
                'attached_snapshot_json' => '{}',
                'live' => 1,
            ])->execute();
        }, 'Unknown destination must violate the attachment foreign key.');
        Assert::assertGreaterThan(0, $destinationId);
    }

    public function testSchemaRejectsDuplicateElectronicAndPhysicalDestinationPointers(FunctionalTester $I)
    {
        $this->insertDestination([
            'course_resource_id' => $this->electronic['course_resource_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
        ]);
        $this->assertRejected(function () {
            $this->insertDestination([
                'course_resource_id' => $this->electronic['course_resource_id'],
                'offering_id' => $this->offeringId,
                'origin_offering_id' => $this->offeringId,
            ]);
        }, 'A course-resource row can have only one registry row.');

        $this->insertDestination([
            'destination_kind' => 'physical',
            'physical_reference_id' => $this->physical['physical_reference_id'],
            'offering_id' => $this->offeringId,
            'origin_offering_id' => $this->offeringId,
        ]);
        $this->assertRejected(function () {
            $this->insertDestination([
                'destination_kind' => 'physical',
                'physical_reference_id' => $this->physical['physical_reference_id'],
                'offering_id' => $this->offeringId,
                'origin_offering_id' => $this->offeringId,
            ]);
        }, 'A physical reference row can have only one registry row.');
    }
}
