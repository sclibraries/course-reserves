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

    public function testAttachPointerCreatesAnUnownedRegistryRowAndLiveAttachment(FunctionalTester $I)
    {
        $item = $this->fixtures->createItem('attach-pointer-item', $this->offering);
        $pointer = $this->fixtures->createElectronicDestination($this->offering, 'attach-pointer-live');

        $this->success(Transactional::run(function () use ($item, $pointer) {
            return $this->registry()->attach(Api116AFixture::itemKey($item), $pointer);
        }));

        $destination = $this->registryRowForCourseResource($pointer['course_resource_id']);
        Assert::assertNotFalse($destination);
        $this->destinationIds[] = (int)$destination['id'];
        Assert::assertSame('none', $destination['ownership_source']);
        Assert::assertNull($destination['owner_item_kind']);
        Assert::assertNull($destination['owner_item_id']);
        Assert::assertNull($destination['owner_live']);
        $attachment = $this->attachmentRows($item)[0];
        Assert::assertSame($destination['id'], $attachment['destination_id']);
        Assert::assertSame('1', $attachment['live']);
        $snapshot = json_decode($attachment['attached_snapshot_json'], true);
        Assert::assertSame($pointer['course_resource_id'], $snapshot['course_resource_id']);
        Assert::assertSame($pointer['resource_id'], $snapshot['resource_id']);

        $registeredPointer = $this->fixtures->createElectronicDestination($this->offering, 'attach-pointer-existing');
        $registeredDestinationId = $this->insertDestination($registeredPointer);
        $registeredItem = $this->fixtures->createItem('attach-pointer-existing-item', $this->offering);
        $this->success(Transactional::run(function () use ($registeredItem, $registeredPointer) {
            return $this->registry()->attach(Api116AFixture::itemKey($registeredItem), $registeredPointer);
        }));
        Assert::assertSame(
            $registeredDestinationId,
            (int)$this->attachmentRows($registeredItem)[0]['destination_id']
        );
    }

    public function testAttachIdenticalRaceReturnsWinningAttachmentUsingCurrentRead(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $item = $this->fixtures->createItem('attach-race-item', $this->offering);
        $pointer = $this->fixtures->createElectronicDestination($this->offering, 'attach-race-live');
        $destinationId = $this->insertDestination($pointer);
        $otherDb = new \yii\db\Connection([
            'dsn' => $db->dsn,
            'username' => $db->username,
            'password' => $db->password,
            'charset' => $db->charset,
        ]);
        $outer = null;
        try {
            $otherDb->open();
            $outer = $db->beginTransaction();
            $db->createCommand(
                'SELECT id FROM publication_attachments WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryAll();
            $otherDb->createCommand()->insert('publication_attachments', [
                'destination_id' => $destinationId,
                'item_kind' => $item['kind'],
                'item_id' => $item['id'],
                'attached_snapshot_json' => '{"destination_kind":"electronic","name":"Synthetic race winner"}',
                'live' => 1,
            ])->execute();
            $winningId = (int)$otherDb->getLastInsertID();

            $result = $this->registry()->attach(Api116AFixture::itemKey($item), $destinationId);

            $this->success($result);
            Assert::assertSame($winningId, (int)$result['body']['attachment']['id']);
            Assert::assertSame('Synthetic race winner', json_decode(
                $result['body']['attachment']['attached_snapshot_json'],
                true
            )['name']);
        } finally {
            if ($outer && $outer->isActive) {
                $outer->rollBack();
            }
            $otherDb->close();
        }
    }

    public function testRegisterOwnedIdenticalRaceReturnsWinningDestinationUsingCurrentRead(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $item = $this->fixtures->createItem('register-race-item', $this->offering);
        $pointer = $this->fixtures->createElectronicDestination($this->offering, 'register-race-live');
        $otherDb = new \yii\db\Connection([
            'dsn' => $db->dsn,
            'username' => $db->username,
            'password' => $db->password,
            'charset' => $db->charset,
        ]);
        $outer = null;
        try {
            $otherDb->open();
            $outer = $db->beginTransaction();
            $db->createCommand(
                'SELECT id FROM publication_destinations WHERE course_resource_id = :id',
                [':id' => $pointer['course_resource_id']]
            )->queryAll();
            $otherDb->createCommand()->insert('publication_destinations', [
                'destination_kind' => 'electronic',
                'course_resource_id' => $pointer['course_resource_id'],
                'physical_reference_id' => null,
                'offering_id' => $this->offering,
                'origin_offering_id' => $this->offering,
                'owner_item_kind' => $item['kind'],
                'owner_item_id' => $item['id'],
                'owner_live' => 1,
                'ownership_source' => 'published',
            ])->execute();
            $winningId = (int)$otherDb->getLastInsertID();
            $this->destinationIds[] = $winningId;

            $result = $this->registry()->registerOwned(Api116AFixture::itemKey($item), $pointer);

            $this->success($result);
            Assert::assertSame($winningId, (int)$result['body']['destination']['id']);
            Assert::assertSame('1', $result['body']['destination']['owner_live']);
        } finally {
            if ($outer && $outer->isActive) {
                $outer->rollBack();
            }
            $otherDb->close();
        }
    }

    public function testAttachPointerRollsBackItsRegistryRowAndPropagatesNonDuplicateIntegrityException(FunctionalTester $I)
    {
        $pointer = $this->fixtures->createElectronicDestination($this->offering, 'attach-integrity-error');
        $item = $this->fixtures->createItem('attach-integrity-error-item', $this->offering);
        $outer = \Yii::$app->db->getTransaction();
        if ($outer !== null && $outer->isActive) {
            $outer->commit();
        }
        \Yii::$app->db->createCommand(
            'CREATE TRIGGER ' . $this->triggerName . ' BEFORE INSERT ON publication_attachments '
            . 'FOR EACH ROW SIGNAL SQLSTATE "23000" SET MYSQL_ERRNO = 1452, '
            . 'MESSAGE_TEXT = "Synthetic API-116A unrelated integrity error"'
        )->execute();
        try {
            try {
                $this->registry()->attach(Api116AFixture::itemKey($item), $pointer);
                Assert::fail('A non-duplicate integrity error must propagate.');
            } catch (\yii\db\IntegrityException $exception) {
                Assert::assertStringContainsString('Synthetic API-116A unrelated integrity error', $exception->getMessage());
            }
        } finally {
            \Yii::$app->db->createCommand('DROP TRIGGER IF EXISTS ' . $this->triggerName)->execute();
        }
        Assert::assertFalse($this->registryRowForCourseResource($pointer['course_resource_id']));
        Assert::assertSame([], $this->attachmentRows($item));
    }

    public function testElectronicSnapshotUsesCourseAssociationFolderAndVisibility(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $folderAutoIncrement = (int)$db->createCommand(
            'SELECT AUTO_INCREMENT FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "folders"'
        )->queryScalar();
        $pointer = $this->fixtures->createElectronicDestination($this->offering, 'snapshot-course-fields');
        $resourceFolderId = null;
        $associationFolderId = null;
        try {
            $db->createCommand()->insert('folders', ['name' => 'Synthetic resource folder'])->execute();
            $resourceFolderId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('folders', ['name' => 'Synthetic association folder'])->execute();
            $associationFolderId = (int)$db->getLastInsertID();
            $db->createCommand()->update('resources', [
                'folder_id' => $resourceFolderId,
                'start_visibility' => '2026-01-02',
                'end_visibility' => '2026-02-03',
            ], ['resource_id' => $pointer['resource_id']])->execute();
            $db->createCommand()->update('course_resources', [
                'folder_id' => $associationFolderId,
                'start_visibility' => '2027-03-04',
                'end_visibility' => '2027-04-05',
                'use_resource_visibility' => 1,
                'primary_link_start_visibility' => '2027-05-06',
                'primary_link_end_visibility' => '2027-06-07',
                'use_primary_link_visibility' => 1,
            ], ['course_resource_id' => $pointer['course_resource_id']])->execute();
            $destinationId = $this->insertDestination($pointer);
            $item = $this->fixtures->createItem('snapshot-course-fields-item', $this->offering);
            $this->success(Transactional::run(function () use ($item, $destinationId) {
                return $this->registry()->attach(Api116AFixture::itemKey($item), $destinationId);
            }));

            $snapshot = json_decode($this->attachmentRows($item)[0]['attached_snapshot_json'], true);
            Assert::assertSame($associationFolderId, (int)$snapshot['folder_id']);
            Assert::assertSame('Synthetic association folder', $snapshot['folder_name']);
            Assert::assertSame('2027-03-04', $snapshot['start_visibility']);
            Assert::assertSame('2027-04-05', $snapshot['end_visibility']);
            Assert::assertSame('1', $snapshot['use_resource_visibility']);
            Assert::assertSame('2027-05-06', $snapshot['primary_link_start_visibility']);
            Assert::assertSame('2027-06-07', $snapshot['primary_link_end_visibility']);
            Assert::assertSame('1', $snapshot['use_primary_link_visibility']);
        } finally {
            $folderIds = array_values(array_filter([$resourceFolderId, $associationFolderId]));
            if ($folderIds) {
                $db->createCommand()->delete('folders', ['folder_id' => $folderIds])->execute();
            }
            if ($folderAutoIncrement > 0) {
                $db->createCommand('ALTER TABLE folders AUTO_INCREMENT = ' . $folderAutoIncrement)->execute();
            }
        }
    }
}
