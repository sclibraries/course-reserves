<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';

use PHPUnit\Framework\Assert;

/**
 * C9: B commits a change after A's discovery and before A's locking reads. A validates fresh locking reads on its
 * first attempt and returns the current contract error or snapshot; discovery values are never reused.
 */
class Api116B1StaleViewCest extends Api116B1ConcurrencyCase
{
    public function testC9ChangedSubmissionOfferingReturnsCurrentMismatch(ConcurrencyTester $I)
    {
        $item = $this->item('c9-offering');
        $destinationId = $this->tracker->insertDestination($this->electronic('c9-offering-entry'));
        $this->tracker->insertPublicationState($item);
        $stateBefore = $this->stateRow($item);
        $result = $this->runAfterChange('c9-offering', 'attach_by_id', ['item' => $item, 'destination_id' => $destinationId], function () use ($item) {
            $this->moveSubmission($item, $this->otherOffering);
        });
        $this->assertStatus($result, 409, 'offering_mismatch');
        $this->assertHistory('c9-offering', $this->attempt(1));
        Assert::assertSame($stateBefore, $this->stateRow($item));
        Assert::assertSame([], $this->attachmentRows($item));
    }

    public function testC9ChangedItemIdentityReturnsCurrentUnresolved(ConcurrencyTester $I)
    {
        $item = $this->item('c9-identity');
        $instance = $this->instanceId();
        $this->setIdentity($item, $instance);
        $destinationId = $this->tracker->insertDestination($this->physical('c9-identity-physical', $instance));
        $result = $this->runAfterChange('c9-identity', 'attach_by_id', ['item' => $item, 'destination_id' => $destinationId], function () use ($item) {
            $this->setIdentity($item, $this->instanceId());
        });
        $this->assertStatus($result, 409, 'destination_unresolved');
        $this->assertHistory('c9-identity', $this->attempt(1));
        Assert::assertSame([], $this->attachmentRows($item));
    }

    public function testC9OwnerCommittedAfterDiscoveryReturnsItemAlreadyOwns(ConcurrencyTester $I)
    {
        $item = $this->item('c9-owner');
        $mine = $this->electronic('c9-owner-a');
        $theirs = $this->electronic('c9-owner-b');
        $winner = null;
        $result = $this->runAfterChange('c9-owner', 'register_owned', ['item' => $item, 'pointer' => $mine], function () use ($item, $theirs, &$winner) {
            $winner = $this->runOperation('c9-owner-winner', 'register_owned', ['item' => $item, 'pointer' => $theirs]);
        });
        $this->assertStatus($winner, 200);
        $this->assertStatus($result, 409, 'item_already_owns');
        Assert::assertSame([], $this->rowsForPointer($mine));
        Assert::assertSame((int)$winner['result']['body']['destination']['id'], (int)$this->rowsForPointer($theirs)[0]['id']);
        $this->assertHistory('c9-owner', $this->attempt(1));
        $this->assertHistory('c9-owner-winner', $this->attempt(1, ['dest']));
    }

    public function testC9AttachmentCommittedAfterDiscoveryReturnsItemAlreadyAttached(ConcurrencyTester $I)
    {
        $item = $this->item('c9-attached');
        $mine = $this->tracker->insertDestination($this->electronic('c9-attached-a'));
        $theirs = $this->tracker->insertDestination($this->electronic('c9-attached-b'));
        $result = $this->runAfterChange('c9-attached', 'attach_by_id', ['item' => $item, 'destination_id' => $mine], function () use ($item, $theirs) {
            $this->assertStatus($this->runOperation('c9-attached-winner', 'attach_by_id', [
                'item' => $item, 'destination_id' => $theirs,
            ]), 200);
        });
        $this->assertStatus($result, 409, 'item_already_attached');
        $rows = $this->attachmentRows($item);
        Assert::assertCount(1, $rows);
        Assert::assertSame((string)$theirs, $rows[0]['destination_id']);
        $this->assertHistory('c9-attached', $this->attempt(1));
        $this->assertHistory('c9-attached-winner', $this->attempt(1, ['attach']));
    }

    public function testC9ChangedResourceLinksMetadataAndFolderGiveTheCurrentSnapshot(ConcurrencyTester $I)
    {
        $item = $this->item('c9-content');
        $pointer = $this->electronic('c9-content-entry');
        $folderId = $this->folderFor($pointer);
        $result = $this->runAfterChange('c9-content', 'attach_by_pointer', ['item' => $item, 'pointer' => $pointer], function () use ($pointer, $folderId) {
            $this->changeContent($pointer, $folderId);
        });
        $this->assertStatus($result, 200);
        $this->assertCurrentContent($this->attachmentRows($item)[0], $pointer);
        $this->assertHistory('c9-content', $this->attempt(1, ['dest', 'attach']));
    }

    public function testC9NewPhysicalAmbiguityReturnsCurrentAmbiguous(ConcurrencyTester $I)
    {
        $item = $this->item('c9-ambiguous');
        $instance = $this->instanceId();
        $this->setIdentity($item, $instance);
        $destinationId = $this->tracker->insertDestination($this->physical('c9-ambiguous-one', $instance));
        $result = $this->runAfterChange('c9-ambiguous', 'attach_by_id', ['item' => $item, 'destination_id' => $destinationId], function () use ($instance) {
            $this->physical('c9-ambiguous-two', $instance);
        });
        $this->assertStatus($result, 409, 'destination_ambiguous');
        $this->assertHistory('c9-ambiguous', $this->attempt(1));
        Assert::assertSame([], $this->attachmentRows($item));
    }

    /** Nested: the caller's plain read fixed an old snapshot before B commits; the registry still uses current data. */
    public function testC9NestedCallerWithAnOldSnapshotStillGetsTheCurrentSnapshot(ConcurrencyTester $I)
    {
        $item = $this->item('c9-nested-content');
        $pointer = $this->electronic('c9-nested-content-entry');
        $folderId = $this->folderFor($pointer);
        $oldName = $this->tracker->fixture()->electronicResourceName('c9-nested-content-entry');
        $result = $this->runAfterChange('c9-nested-content', 'attach_by_pointer', [
            'item' => $item, 'pointer' => $pointer, 'nest' => 1,
            'caller_read' => ['sql' => 'SELECT name FROM resources WHERE resource_id = :id', 'params' => [':id' => $pointer['resource_id']]],
        ], function () use ($pointer, $folderId) {
            $this->changeContent($pointer, $folderId);
        });
        $this->assertStatus($result, 200);
        Assert::assertSame([$oldName, $oldName], [$result['result']['caller_read_before'], $result['result']['caller_read_after']]);
        $this->assertCurrentContent($this->attachmentRows($item)[0], $pointer);
        $this->assertHistory('c9-nested-content', $this->attempt(1, ['dest', 'attach'], false));
    }

    public function testC9NestedCallerWithAnOldSnapshotStillGetsTheCurrentOfferingMismatch(ConcurrencyTester $I)
    {
        $item = $this->item('c9-nested-offering');
        $destinationId = $this->tracker->insertDestination($this->electronic('c9-nested-offering-entry'));
        $result = $this->runAfterChange('c9-nested-offering', 'attach_by_id', [
            'item' => $item, 'destination_id' => $destinationId, 'nest' => 1,
            'caller_read' => [
                'sql' => 'SELECT offering_id FROM faculty_submissions WHERE submission_id = :id',
                'params' => [':id' => $item['submission_id']],
            ],
        ], function () use ($item) {
            $this->moveSubmission($item, $this->otherOffering);
        });
        $this->assertStatus($result, 409, 'offering_mismatch');
        $stale = (string)$this->offering;
        Assert::assertSame([$stale, $stale], [(string)$result['result']['caller_read_before'], (string)$result['result']['caller_read_after']]);
        Assert::assertSame([], $this->attachmentRows($item));
        $this->assertHistory('c9-nested-offering', $this->attempt(1, [], false));
    }

    /** A waits after discovery (plain reads only, no locks held), B's change commits, then A runs to its result. */
    private function runAfterChange($label, $operation, array $payload, callable $change)
    {
        $this->pauseAt($label, $operation, $payload, 'discovered');
        call_user_func($change);
        $this->supervisor->release($label, 'discovered', 1);
        return $this->supervisor->complete($label);
    }

    private function moveSubmission(array $item, $offeringId)
    {
        \Yii::$app->db->createCommand()->update('faculty_submissions', ['offering_id' => $offeringId], [
            'submission_id' => $item['submission_id'],
        ])->execute();
    }

    private function folderFor(array $pointer)
    {
        \Yii::$app->db->createCommand()->insert('folders', ['name' => 'Synthetic folder before change'])->execute();
        $folderId = (int)\Yii::$app->db->getLastInsertID();
        $this->tracker->trackFolder($folderId);
        \Yii::$app->db->createCommand()->update('resources', ['folder_id' => $folderId], [
            'resource_id' => $pointer['resource_id'],
        ])->execute();
        return $folderId;
    }

    private function changeContent(array $pointer, $folderId)
    {
        $db = \Yii::$app->db;
        $where = ['resource_id' => $pointer['resource_id']];
        $db->createCommand()->update('resources', [
            'name' => 'Synthetic changed live name', 'description' => 'Synthetic changed live description',
        ], $where)->execute();
        $db->createCommand()->update('resource_metadata', ['field_value' => 'Synthetic changed public metadata'], $where)->execute();
        $db->createCommand()->update('resource_links', ['title' => 'Synthetic changed public link'], $where)->execute();
        $db->createCommand()->update('folders', ['name' => 'Synthetic folder after change'], ['folder_id' => $folderId])->execute();
    }

    private function assertCurrentContent(array $attachment, array $pointer)
    {
        $this->assertElectronicSnapshot($attachment, $pointer, 'Synthetic changed live name');
        $snapshot = json_decode($attachment['attached_snapshot_json'], true);
        Assert::assertSame('Synthetic changed live description', $snapshot['description']);
        Assert::assertSame('Synthetic changed public metadata', $snapshot['metadata'][0]['field_value']);
        Assert::assertSame('Synthetic changed public link', $snapshot['links'][0]['title']);
        Assert::assertSame('Synthetic folder after change', $snapshot['folder_name']);
    }
}
