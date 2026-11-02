<?php

use PHPUnit\Framework\Assert;
use app\services\Transactional;

class Api116ADestinationRegistryOperationsCest extends Api116ADestinationRegistryTestBase
{
    public function testRegisterOwnedReadAndAttachRetriesKeepRowsAndSnapshotsStable(FunctionalTester $I)
    {
        $beforeOwnerState = $this->stateRow($this->owner);
        $beforeOwnerItem = $this->fixtures->itemRow($this->owner);
        $pointer = null;
        $beforeLiveRows = null;
        $this->success(Transactional::run(function () use (&$pointer, &$beforeLiveRows) {
            $pointer = $this->fixtures->createElectronicDestination($this->offering, 'owned-live');
            $beforeLiveRows = $this->electronicLiveRows($pointer);
            return $this->registry()->registerOwned(Api116AFixture::itemKey($this->owner), $pointer);
        }));
        $ownerDestinationId = $this->destinationIdForCourseResource($pointer['course_resource_id']);
        $ownerRow = $this->destinationRow($ownerDestinationId);
        Assert::assertSame('new', $ownerRow['owner_item_kind']);
        Assert::assertSame((string)$this->owner['id'], $ownerRow['owner_item_id']);
        Assert::assertSame('1', $ownerRow['owner_live']);
        Assert::assertSame('published', $ownerRow['ownership_source']);
        Assert::assertSame((string)$this->offering, $ownerRow['origin_offering_id']);
        Assert::assertSame($beforeOwnerState, $this->stateRow($this->owner));
        Assert::assertSame($beforeOwnerItem, $this->fixtures->itemRow($this->owner));
        Assert::assertSame(0, $this->workflowEventCount($this->owner));
        Assert::assertSame($beforeLiveRows, $this->electronicLiveRows($pointer));

        $beforeOwnerRetry = $this->destinationRow($ownerDestinationId);
        $this->success(Transactional::run(function () use ($pointer) {
            return $this->registry()->registerOwned(Api116AFixture::itemKey($this->owner), $pointer);
        }));
        Assert::assertSame($beforeOwnerRetry, $this->destinationRow($ownerDestinationId));
        $read = $this->registry()->read($ownerDestinationId);
        $this->success($read);
        Assert::assertSame($ownerDestinationId, (int)$read['body']['destination']['id']);

        $beforeAttachedState = $this->stateRow($this->attached);
        $beforeAttachedItem = $this->fixtures->itemRow($this->attached);
        $this->success(Transactional::run(function () use ($ownerDestinationId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $ownerDestinationId);
        }));
        $attachment = $this->attachmentRows($this->attached)[0];
        Assert::assertSame($ownerDestinationId, (int)$attachment['destination_id']);
        Assert::assertSame('1', $attachment['live']);
        $snapshot = json_decode($attachment['attached_snapshot_json'], true);
        Assert::assertSame('electronic', $snapshot['destination_kind']);
        Assert::assertSame($pointer['offering_id'], $snapshot['offering_id']);
        Assert::assertSame($pointer['course_resource_id'], $snapshot['course_resource_id']);
        Assert::assertSame($pointer['resource_id'], $snapshot['resource_id']);
        Assert::assertSame($this->fixtures->electronicResourceName('owned-live'), $snapshot['name']);
        Assert::assertSame('Synthetic public note owned-live', $snapshot['external_note']);
        Assert::assertSame('Synthetic public metadata owned-live', $snapshot['metadata'][0]['field_value']);
        Assert::assertSame('Synthetic public link owned-live', $snapshot['links'][0]['title']);
        Assert::assertStringNotContainsString('Synthetic private note', json_encode($snapshot));
        Assert::assertSame($beforeAttachedState, $this->stateRow($this->attached));
        Assert::assertSame($beforeAttachedItem, $this->fixtures->itemRow($this->attached));
        Assert::assertSame(0, $this->workflowEventCount($this->attached));
        Assert::assertSame($beforeLiveRows, $this->electronicLiveRows($pointer));

        $beforeAttachmentRetry = $this->attachmentRows($this->attached);
        $this->success(Transactional::run(function () use ($ownerDestinationId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $ownerDestinationId);
        }));
        Assert::assertSame($beforeAttachmentRetry, $this->attachmentRows($this->attached));
        Assert::assertSame(1, count($this->attachmentRows($this->attached)), 'Retry does not add history or change timestamps.');
    }

    public function testAttachRegisterOwnedAndPhysicalIdentityReturnTheContractConflictCodes(FunctionalTester $I)
    {
        $pointer = $this->fixtures->createElectronicDestination($this->offering, 'conflict-owned');
        $ownerDestination = $this->insertDestination($pointer, [
            'owner_item_kind' => 'new',
            'owner_item_id' => $this->owner['id'],
            'owner_live' => 1,
            'ownership_source' => 'published',
        ]);
        $secondPointer = $this->fixtures->createElectronicDestination($this->offering, 'conflict-second');
        $secondDestination = $this->insertDestination($secondPointer);
        $this->assertError(Transactional::run(function () use ($secondDestination) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->owner), $secondDestination);
        }), 'item_already_owns');
        $this->assertError(Transactional::run(function () use ($pointer) {
            return $this->registry()->registerOwned(Api116AFixture::itemKey($this->otherItem), $pointer);
        }), 'destination_already_owned');

        $attachedToPointer = $this->fixtures->createElectronicDestination($this->offering, 'conflict-attached-to');
        $attachedTo = $this->insertDestination($attachedToPointer);
        $this->insertAttachment($attachedTo, $this->attached);
        $thirdPointer = $this->fixtures->createElectronicDestination($this->offering, 'conflict-third');
        $thirdDestination = $this->insertDestination($thirdPointer);
        $this->assertError(Transactional::run(function () use ($thirdDestination) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $thirdDestination);
        }), 'item_already_attached');
        $ownedByAttachedPointer = $this->fixtures->createElectronicDestination($this->offering, 'conflict-attached-owner');
        $this->assertError(Transactional::run(function () use ($ownedByAttachedPointer) {
            return $this->registry()->registerOwned(
                Api116AFixture::itemKey($this->attached),
                $ownedByAttachedPointer
            );
        }), 'item_already_attached');

        $fourthPointer = $this->fixtures->createElectronicDestination($this->offering, 'conflict-fourth');
        $fourthDestination = $this->insertDestination($fourthPointer);
        $attachmentSource = $this->fixtures->createItem('conflict-attachment-source', $this->offering);
        $this->insertAttachment($fourthDestination, $attachmentSource);
        $unattachedItem = $this->fixtures->createItem('conflict-unattached', $this->offering);
        $this->assertError(Transactional::run(function () use ($fourthPointer, $unattachedItem) {
            return $this->registry()->registerOwned(
                Api116AFixture::itemKey($unattachedItem),
                $fourthPointer
            );
        }), 'destination_has_attachments');

        $unverified = $this->fixtures->createPhysicalDestination(
            $this->offering,
            'conflict-unverified',
            '00000000-0000-4000-8000-000000001171',
            'unverified'
        );
        $unverifiedDestination = $this->insertDestination($unverified);
        $this->assertError(Transactional::run(function () use ($unverifiedDestination) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->otherItem), $unverifiedDestination);
        }), 'destination_unresolved');

        $instanceId = '00000000-0000-4000-8000-000000001172';
        $this->setIdentity($this->otherItem, $instanceId);
        $wrongIdentity = $this->fixtures->createPhysicalDestination(
            $this->offering,
            'conflict-verified-wrong-identity',
            '00000000-0000-4000-8000-000000001170'
        );
        $wrongIdentityDestination = $this->insertDestination($wrongIdentity);
        $this->assertError(Transactional::run(function () use ($wrongIdentityDestination) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->otherItem), $wrongIdentityDestination);
        }), 'destination_unresolved');

        $verifiedItem = $this->fixtures->createItem('conflict-verified-item', $this->offering);
        $this->setIdentity($verifiedItem, $instanceId);
        $verifiedPhysical = $this->fixtures->createPhysicalDestination(
            $this->offering,
            'conflict-verified-match',
            $instanceId
        );
        $verifiedDestinationId = $this->insertDestination($verifiedPhysical);
        $this->success(Transactional::run(function () use ($verifiedItem, $verifiedDestinationId) {
            return $this->registry()->attach(Api116AFixture::itemKey($verifiedItem), $verifiedDestinationId);
        }));
        $verifiedSnapshot = json_decode($this->attachmentRows($verifiedItem)[0]['attached_snapshot_json'], true);
        Assert::assertSame('physical', $verifiedSnapshot['destination_kind']);
        Assert::assertSame($verifiedPhysical['physical_reference_id'], $verifiedSnapshot['physical_reference_id']);
        Assert::assertSame($instanceId, $verifiedSnapshot['folio_instance_id']);

        $ownedPhysicalIdentity = '00000000-0000-4000-8000-000000001180';
        $verifiedOwner = $this->fixtures->createItem('conflict-physical-owner', $this->offering);
        $this->setIdentity($verifiedOwner, $ownedPhysicalIdentity);
        $ownedPhysical = null;
        $this->success(Transactional::run(function () use (&$ownedPhysical, $verifiedOwner, $ownedPhysicalIdentity) {
            $ownedPhysical = $this->fixtures->createPhysicalDestination(
                $this->offering,
                'conflict-verified-owned',
                $ownedPhysicalIdentity
            );
            return $this->registry()->registerOwned(Api116AFixture::itemKey($verifiedOwner), $ownedPhysical);
        }));
        $ownedPhysicalRow = $this->destinationRowForItem($verifiedOwner);
        Assert::assertSame('physical', $ownedPhysicalRow['destination_kind']);
        Assert::assertSame('1', $ownedPhysicalRow['owner_live']);
        Assert::assertSame((string)$ownedPhysical['physical_reference_id'], $ownedPhysicalRow['physical_reference_id']);

        $ambiguous = $this->fixtures->createPhysicalDestination($this->offering, 'conflict-ambiguous', $instanceId);
        $this->fixtures->createPhysicalDestination($this->offering, 'conflict-ambiguous-duplicate', $instanceId);
        $ambiguousDestination = $this->insertDestination($ambiguous);
        $this->assertError(Transactional::run(function () use ($ambiguousDestination) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->otherItem), $ambiguousDestination);
        }), 'destination_ambiguous');

        Assert::assertNotFalse($this->destinationRow($ownerDestination));
    }
}
