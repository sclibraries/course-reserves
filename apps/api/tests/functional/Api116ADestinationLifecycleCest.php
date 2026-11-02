<?php

use PHPUnit\Framework\Assert;
use app\services\Transactional;

class Api116ADestinationLifecycleCest extends Api116ADestinationRegistryTestBase
{
    public function testReleaseDetachRetireAndRepublishCyclesRetainLifecycleHistory(FunctionalTester $I)
    {
        $ownerItemBefore = $this->fixtures->itemRow($this->owner);
        $attachedItemBefore = $this->fixtures->itemRow($this->attached);
        $ownerStateBefore = $this->stateRow($this->owner);
        $attachedStateBefore = $this->stateRow($this->attached);
        $firstPointer = $this->registerOwner('cycle-first');
        $firstId = $this->destinationIdForCourseResource($firstPointer['course_resource_id']);
        $this->success(Transactional::run(function () use ($firstId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $firstId);
        }));

        $this->success(Transactional::run(function () {
            return $this->registry()->release(Api116AFixture::itemKey($this->owner));
        }));
        $released = $this->destinationRow($firstId);
        Assert::assertSame('new', $released['owner_item_kind']);
        Assert::assertSame((string)$this->owner['id'], $released['owner_item_id']);
        Assert::assertNull($released['owner_live']);
        Assert::assertSame('released', $released['ownership_source']);
        $this->success(Transactional::run(function () {
            return $this->registry()->release(Api116AFixture::itemKey($this->owner));
        }));
        Assert::assertSame($released, $this->destinationRow($firstId), 'Release retry preserves ownership history timestamps.');

        $this->success(Transactional::run(function () {
            return $this->registry()->detach(Api116AFixture::itemKey($this->attached));
        }));
        $detached = $this->attachmentRows($this->attached);
        Assert::assertCount(1, $detached);
        Assert::assertNull($detached[0]['live']);
        Assert::assertNotNull($detached[0]['detached_at']);
        $this->success(Transactional::run(function () {
            return $this->registry()->detach(Api116AFixture::itemKey($this->attached));
        }));
        Assert::assertSame($detached, $this->attachmentRows($this->attached), 'Detach retry preserves history timestamps.');

        $this->success(Transactional::run(function () use ($firstId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $firstId);
        }));
        Assert::assertCount(2, $this->attachmentRows($this->attached));
        Assert::assertNull($this->attachmentRows($this->attached)[0]['live']);
        Assert::assertSame('1', $this->attachmentRows($this->attached)[1]['live']);

        $secondPointer = $this->registerOwner('cycle-second');
        $secondId = $this->destinationIdForCourseResource($secondPointer['course_resource_id']);
        $secondOwner = $this->destinationRow($secondId);
        Assert::assertSame((string)$this->owner['id'], $secondOwner['owner_item_id']);
        Assert::assertSame('1', $secondOwner['owner_live']);
        $this->success(Transactional::run(function () use ($firstId) {
            return $this->registry()->retire($firstId);
        }));
        $retired = $this->destinationRow($firstId);
        Assert::assertNotNull($retired['retired_at']);
        Assert::assertNull($retired['course_resource_id']);
        Assert::assertNull($retired['physical_reference_id']);
        Assert::assertNull($retired['owner_live']);
        Assert::assertSame('released', $retired['ownership_source']);
        foreach ($this->attachmentRows($this->attached) as $row) {
            if ((int)$row['destination_id'] === $firstId) {
                Assert::assertNull($row['live']);
                Assert::assertNotNull($row['detached_at']);
            }
        }
        $this->success(Transactional::run(function () use ($firstId) {
            return $this->registry()->retire($firstId);
        }));
        Assert::assertSame($retired, $this->destinationRow($firstId), 'Retire retry changes no registry timestamp.');
        $this->success(Transactional::run(function () {
            return $this->registry()->release(Api116AFixture::itemKey($this->owner));
        }));
        $thirdPointer = $this->registerOwner('cycle-third');
        $thirdId = $this->destinationIdForCourseResource($thirdPointer['course_resource_id']);
        Assert::assertNotSame($firstId, $thirdId);
        Assert::assertSame((string)$this->offering, $this->destinationRow($thirdId)['origin_offering_id']);
        Assert::assertSame('1', $this->destinationRow($thirdId)['owner_live']);
        Assert::assertSame($ownerItemBefore, $this->fixtures->itemRow($this->owner));
        Assert::assertSame($attachedItemBefore, $this->fixtures->itemRow($this->attached));
        Assert::assertSame($ownerStateBefore, $this->stateRow($this->owner));
        Assert::assertSame($attachedStateBefore, $this->stateRow($this->attached));
        Assert::assertSame(0, $this->workflowEventCount($this->owner));
        Assert::assertSame(0, $this->workflowEventCount($this->attached));
    }

    public function testFollowChangesDestinationKindWithStableIdAndLeavesFrozenInputsUntouched(FunctionalTester $I)
    {
        $instanceId = '00000000-0000-4000-8000-000000001173';
        $this->setIdentity($this->owner, $instanceId);
        $this->setIdentity($this->attached, $instanceId);
        $ownerItemBefore = $this->fixtures->itemRow($this->owner);
        $attachedItemBefore = $this->fixtures->itemRow($this->attached);
        $this->insertPublicationState($this->owner);
        $this->insertPublicationState($this->attached);
        $ownerStateBefore = $this->stateRow($this->owner);
        $attachedStateBefore = $this->stateRow($this->attached);

        $electronic = $this->registerOwner('follow-electronic');
        $destinationId = $this->destinationIdForCourseResource($electronic['course_resource_id']);
        $this->success(Transactional::run(function () use ($destinationId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $destinationId);
        }));
        $beforeAttachment = $this->attachmentRows($this->attached)[0];
        $physical = $this->fixtures->createPhysicalDestination($this->offering, 'follow-physical', $instanceId);
        $beforePhysicalReference = \Yii::$app->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE reference_id = :id',
            [':id' => $physical['physical_reference_id']]
        )->queryOne();
        $followResult = Transactional::run(function () use ($destinationId, $physical) {
            return $this->registry()->follow($destinationId, $physical);
        });
        $this->success($followResult);

        $destination = $this->destinationRow($destinationId);
        Assert::assertSame('physical', $destination['destination_kind']);
        Assert::assertNull($destination['course_resource_id']);
        Assert::assertSame((string)$physical['physical_reference_id'], $destination['physical_reference_id']);
        Assert::assertSame((string)$destinationId, $destination['id']);
        $afterAttachment = $this->attachmentRows($this->attached)[0];
        Assert::assertSame($beforeAttachment['attached_at'], $afterAttachment['attached_at']);
        Assert::assertSame('1', $afterAttachment['live']);
        $snapshot = json_decode($afterAttachment['attached_snapshot_json'], true);
        Assert::assertSame('physical', $snapshot['destination_kind']);
        Assert::assertSame($physical['physical_reference_id'], $snapshot['physical_reference_id']);
        Assert::assertSame($physical['offering_id'], $snapshot['offering_id']);
        Assert::assertSame($this->prefixFreePhysicalLabel('follow-physical'), $snapshot['display_name']);
        Assert::assertSame('test-api116a-registry-barcode-follow-physical', $snapshot['external_resource_id']);
        Assert::assertSame('Synthetic physical note follow-physical', $snapshot['public_note']);
        Assert::assertSame('Synthetic physical pages follow-physical', $snapshot['assigned_pages']);
        Assert::assertSame($instanceId, $snapshot['folio_instance_id']);
        Assert::assertArrayNotHasKey('course_resource_id', $snapshot);
        Assert::assertArrayNotHasKey('identity_provenance_json', $snapshot);
        Assert::assertSame($beforePhysicalReference, \Yii::$app->db->createCommand(
            'SELECT * FROM physical_resource_references WHERE reference_id = :id',
            [':id' => $physical['physical_reference_id']]
        )->queryOne());
        $beforeFollowDestination = $this->destinationRow($destinationId);
        $beforeFollowAttachment = $this->attachmentRows($this->attached);
        $this->success(Transactional::run(function () use ($destinationId, $physical) {
            return $this->registry()->follow($destinationId, $physical);
        }));
        Assert::assertSame($beforeFollowDestination, $this->destinationRow($destinationId));
        Assert::assertSame($beforeFollowAttachment, $this->attachmentRows($this->attached));
        Assert::assertSame($ownerItemBefore, $this->fixtures->itemRow($this->owner));
        Assert::assertSame($attachedItemBefore, $this->fixtures->itemRow($this->attached));
        Assert::assertSame($ownerStateBefore, $this->stateRow($this->owner));
        Assert::assertSame($attachedStateBefore, $this->stateRow($this->attached));
        Assert::assertSame(0, $this->workflowEventCount($this->owner));
        Assert::assertSame(0, $this->workflowEventCount($this->attached));
    }

    public function testFollowRollbackLeavesNoPartialPointerOrAttachmentChange(FunctionalTester $I)
    {
        $instanceId = '00000000-0000-4000-8000-000000001174';
        $this->setIdentity($this->owner, $instanceId);
        $this->setIdentity($this->attached, $instanceId);
        $electronic = $this->registerOwner('rollback-electronic');
        $destinationId = $this->destinationIdForCourseResource($electronic['course_resource_id']);
        $this->success(Transactional::run(function () use ($destinationId) {
            return $this->registry()->attach(Api116AFixture::itemKey($this->attached), $destinationId);
        }));
        $physical = $this->fixtures->createPhysicalDestination($this->offering, 'rollback-physical', $instanceId);
        $beforeDestination = $this->destinationRow($destinationId);
        $beforeAttachments = $this->attachmentRows($this->attached);
        \Yii::$app->db->createCommand(
            'CREATE TRIGGER ' . $this->triggerName . ' BEFORE UPDATE ON publication_attachments '
            . 'FOR EACH ROW SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "Synthetic API-116A rollback"'
        )->execute();
        try {
            try {
                Transactional::run(function () use ($destinationId, $physical) {
                    return $this->registry()->follow($destinationId, $physical);
                });
                Assert::fail('Injected attachment failure must abort the follow transaction.');
            } catch (\Throwable $exception) {
                Assert::assertStringContainsString('Synthetic API-116A rollback', $exception->getMessage());
            }
        } finally {
            \Yii::$app->db->createCommand('DROP TRIGGER IF EXISTS ' . $this->triggerName)->execute();
        }
        Assert::assertSame($beforeDestination, $this->destinationRow($destinationId));
        Assert::assertSame($beforeAttachments, $this->attachmentRows($this->attached));
    }
}
