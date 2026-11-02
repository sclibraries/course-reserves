<?php

use PHPUnit\Framework\Assert;
use app\services\Transactional;

class Api116ADestinationErrorPrecedenceCest extends Api116ADestinationRegistryTestBase
{
    public function testServiceErrorPrecedenceUsesTheFullOrderedContract(FunctionalTester $I)
    {
        // Missing and retired are mutually exclusive for one destination id.
        $missingId = $this->nextDestinationId();
        $ownedPointer = $this->fixtures->createElectronicDestination($this->offering, 'precedence-owned');
        $this->insertDestination($ownedPointer, [
            'owner_item_kind' => $this->owner['kind'],
            'owner_item_id' => $this->owner['id'],
            'owner_live' => 1,
            'ownership_source' => 'published',
        ]);
        $this->assertError(Transactional::run(function () use ($missingId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->owner), $missingId);
        }), 'destination_missing');

        // The nulled pointer is an implicit retirement until API-116B wires deletion paths.
        $retired = $this->insertDestination([
            'destination_kind' => 'electronic',
            'offering_id' => $this->otherOffering,
            'origin_offering_id' => $this->offering,
        ]);
        $this->assertError(Transactional::run(function () use ($retired) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->owner), $retired);
        }), 'destination_retired');

        $unverifiedPointer = $this->fixtures->createPhysicalDestination(
            $this->otherOffering,
            'precedence-unresolved',
            '00000000-0000-4000-8000-000000001175',
            'unverified'
        );
        $mismatchedPhysical = $this->insertDestination($unverifiedPointer, ['offering_id' => $this->offering]);
        $this->assertError(Transactional::run(function () use ($mismatchedPhysical) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->otherItem), $mismatchedPhysical);
        }), 'offering_mismatch');
        $mismatchItem = $this->fixtures->createItem('precedence-mismatch-item', $this->otherOffering);
        $this->assertError(Transactional::run(function () use ($mismatchedPhysical, $mismatchItem) {
            return $this->registry()->attach(Api116AFixture::itemKey($mismatchItem), $mismatchedPhysical);
        }), 'offering_mismatch');

        $unresolved = $this->fixtures->createPhysicalDestination(
            $this->offering,
            'precedence-unverified',
            '00000000-0000-4000-8000-000000001176',
            'unverified'
        );
        $unresolvedId = $this->insertDestination($unresolved);
        $ambiguousIdentity = '00000000-0000-4000-8000-000000001177';
        $this->setIdentity($this->attached, $ambiguousIdentity);
        $this->fixtures->createPhysicalDestination($this->offering, 'precedence-ambiguous-a', $ambiguousIdentity);
        $this->fixtures->createPhysicalDestination($this->offering, 'precedence-ambiguous-b', $ambiguousIdentity);
        $alreadyAttachedPointer = $this->fixtures->createElectronicDestination(
            $this->offering,
            'precedence-item-attached'
        );
        $alreadyAttachedId = $this->insertDestination($alreadyAttachedPointer);
        $this->insertAttachment($alreadyAttachedId, $this->attached);
        $this->assertError(Transactional::run(function () use ($unresolvedId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $unresolvedId);
        }), 'destination_unresolved');

        $ambiguous = $this->fixtures->createPhysicalDestination(
            $this->offering,
            'precedence-ambiguous-target-a',
            $ambiguousIdentity
        );
        $this->fixtures->createPhysicalDestination(
            $this->offering,
            'precedence-ambiguous-target-b',
            $ambiguousIdentity
        );
        $ambiguousId = $this->insertDestination($ambiguous);
        $this->setIdentity($this->owner, $ambiguousIdentity);
        $this->assertError(Transactional::run(function () use ($ambiguousId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->owner), $ambiguousId);
        }), 'destination_ambiguous');

        $plainPointer = $this->fixtures->createElectronicDestination($this->offering, 'precedence-plain');
        $plainId = $this->insertDestination($plainPointer);
        $this->assertError(Transactional::run(function () use ($plainId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->owner), $plainId);
        }), 'item_already_owns');

        $ownedTargetPointer = $this->fixtures->createElectronicDestination(
            $this->offering,
            'precedence-item-owned'
        );
        $ownedTargetId = $this->insertDestination($ownedTargetPointer, [
            'owner_item_kind' => $this->otherItem['kind'],
            'owner_item_id' => $this->otherItem['id'],
            'owner_live' => 1,
            'ownership_source' => 'published',
        ]);
        $this->assertError(Transactional::run(function () use ($ownedTargetId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->owner), $ownedTargetId);
        }), 'item_already_owns');

        $neutralItem = $this->fixtures->createItem('precedence-neutral', $this->offering);
        $this->assertError(Transactional::run(function () use ($ownedTargetId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $ownedTargetId);
        }), 'item_already_attached');

        $occupiedPointer = $this->fixtures->createElectronicDestination($this->offering, 'precedence-occupied');
        $destinationOwner = $this->fixtures->createItem('precedence-destination-owner', $this->offering);
        $occupiedAttachmentItem = $this->fixtures->createItem('precedence-occupied-attachment', $this->offering);
        $occupiedId = $this->insertDestination($occupiedPointer, [
            'owner_item_kind' => 'new',
            'owner_item_id' => $destinationOwner['id'],
            'owner_live' => 1,
            'ownership_source' => 'published',
        ]);
        $this->insertAttachment($occupiedId, $occupiedAttachmentItem);
        $this->success(Transactional::run(function () use ($occupiedId, $neutralItem) {
            return $this->registry()->attach(Api116AFixture::itemKey($neutralItem), $occupiedId);
        }));

        $attachmentsTargetPointer = $this->fixtures->createElectronicDestination(
            $this->offering,
            'precedence-has-attachments'
        );
        $attachmentsTargetId = $this->insertDestination($attachmentsTargetPointer);
        $attachmentSourceItem = $this->fixtures->createItem('precedence-attached-source', $this->offering);
        $this->insertAttachment($attachmentsTargetId, $attachmentSourceItem);
        $freshOwnerA = $this->fixtures->createItem('precedence-fresh-a', $this->offering);
        $this->assertError(Transactional::run(function () use ($attachmentsTargetId, $attachmentsTargetPointer, $freshOwnerA) {
            return $this->registry()->registerOwned(
                Api116AFixture::itemKey($freshOwnerA),
                $attachmentsTargetPointer
            );
        }), 'destination_has_attachments');

        $unregisteredLivePointer = $this->fixtures->createElectronicDestination(
            $this->offering,
            'precedence-unregistered-live'
        );
        $freshOwnerB = $this->fixtures->createItem('precedence-fresh-b', $this->offering);
        $this->success(Transactional::run(function () use ($unregisteredLivePointer, $freshOwnerB) {
            return $this->registry()->registerOwned(
                Api116AFixture::itemKey($freshOwnerB),
                $unregisteredLivePointer
            );
        }));
        $registered = $this->registryRowForCourseResource($unregisteredLivePointer['course_resource_id']);
        Assert::assertSame('new', $registered['owner_item_kind']);
        Assert::assertSame((string)$freshOwnerB['id'], $registered['owner_item_id']);
        Assert::assertSame('1', $registered['owner_live']);
        Assert::assertSame('published', $registered['ownership_source']);
    }
}
