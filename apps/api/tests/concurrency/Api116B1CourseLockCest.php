<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';

use PHPUnit\Framework\Assert;

/** C1, C5, C6, C8: the course lock (or, without a course, the first row lock) comes first and serializes. */
class Api116B1CourseLockCest extends Api116B1ConcurrencyCase
{
    /** C1 retire first. Primary offering: the destination's offering ($this->offering) for both operations. */
    public function testC1RetireHoldsTheCourseLockThenNumericAttachSeesDestinationRetired(ConcurrencyTester $I)
    {
        $run = $this->runAttachVersusRetire(true);
        $this->assertStatus($run['retire'], 200);
        $this->assertStatus($run['attach'], 409, 'destination_retired');
        Assert::assertSame($run['destination_after_a'], $this->destinationRow($run['destination_id']));
        Assert::assertNotNull($run['destination_after_a']['retired_at']);
        Assert::assertSame([], $this->attachmentRows($run['item']));
        $this->assertHistory('c1-retire', $this->attempt(1));
        $this->assertHistory('c1-attach', $this->attempt(1));
    }

    /** C1 attach first. Primary offering: the destination's offering ($this->offering) for both operations. */
    public function testC1NumericAttachHoldsTheCourseLockThenRetireDetachesTheNewAttachment(ConcurrencyTester $I)
    {
        $run = $this->runAttachVersusRetire(false);
        $this->assertStatus($run['attach'], 200);
        $this->assertStatus($run['retire'], 200);
        $rows = $this->attachmentRows($run['item']);
        Assert::assertCount(1, $rows);
        $attached = $run['attachments_after_a'][0];
        Assert::assertNull($rows[0]['live']);
        Assert::assertNotNull($rows[0]['detached_at']);
        Assert::assertSame(
            array_diff_key($attached, array_flip(['live', 'detached_at', 'updated_at'])),
            array_diff_key($rows[0], array_flip(['live', 'detached_at', 'updated_at']))
        );
        $destination = $this->destinationRow($run['destination_id']);
        Assert::assertNull($destination['course_resource_id']);
        Assert::assertNotNull($destination['retired_at']);
        $this->assertHistory('c1-attach', $this->attempt(1, ['attach']));
        $this->assertHistory('c1-retire', $this->attempt(1));
    }

    /** C5: course-lock independence only (C7 shows whole transactions in different courses can still interact). */
    public function testC5AnOperationOnAnotherCourseCompletesWhileTheFirstCourseIsLocked(ConcurrencyTester $I)
    {
        $first = $this->item('c5-first');
        $firstDestination = $this->tracker->insertDestination($this->electronic('c5-first-entry'));
        $second = $this->item('c5-second', $this->otherOffering);
        $secondPointer = $this->electronic('c5-second-entry', $this->otherOffering);
        $secondDestination = $this->tracker->insertDestination($secondPointer);

        $this->pauseAt('c5-a', 'attach_by_id', ['item' => $first, 'destination_id' => $firstDestination], 'locked');
        $this->assertContended($this->lockProbe('offering', $this->offering));
        $b = $this->runOperation('c5-b', 'attach_by_id', ['item' => $second, 'destination_id' => $secondDestination]);
        $this->assertStatus($b, 200);
        Assert::assertSame('acquired', $this->lockProbe('offering', $this->otherOffering)['outcome']);
        $this->supervisor->release('c5-a', 'locked', 1);
        $this->assertStatus($this->supervisor->complete('c5-a'), 200);

        Assert::assertSame((string)$secondDestination, $this->attachmentRows($second)[0]['destination_id']);
        Assert::assertSame((string)$firstDestination, $this->attachmentRows($first)[0]['destination_id']);
        $this->assertHistory('c5-a', $this->attempt(1, ['attach']));
        $this->assertHistory('c5-b', $this->attempt(1, ['attach']));
    }

    /** C6: every operation with a known course takes the course lock before any other locking statement. */
    public function testC6EveryOperationWithACourseLocksItFirst(ConcurrencyTester $I)
    {
        $owner = $this->item('c6-owner');
        $attachItem = $this->item('c6-attach-id');
        $pointerItem = $this->item('c6-attach-pointer');
        $followItem = $this->item('c6-follow-item');
        $attachDestination = $this->tracker->insertDestination($this->electronic('c6-attach-entry'));
        $followDestination = $this->tracker->insertDestination($this->electronic('c6-follow-old'));
        $this->tracker->insertAttachment($followDestination, $followItem, ['destination_kind' => 'electronic']);
        $followPointer = $this->electronic('c6-follow-new');
        $runs = [
            ['c6-register', 'register_owned', ['item' => $owner, 'pointer' => $this->electronic('c6-owned')], ['dest']],
            ['c6-attach-id', 'attach_by_id', ['item' => $attachItem, 'destination_id' => $attachDestination], ['attach']],
            ['c6-attach-pointer', 'attach_by_pointer', [
                'item' => $pointerItem, 'pointer' => $this->electronic('c6-lazy'),
            ], ['dest', 'attach']],
            ['c6-release', 'release', ['item' => $owner], []],
            ['c6-retire', 'retire', ['destination_id' => $attachDestination], []],
            ['c6-detach', 'detach', ['item' => $pointerItem], []],
            ['c6-follow', 'follow', ['destination_id' => $followDestination, 'pointer' => $followPointer], ['dest']],
        ];
        foreach ($runs as list($label, $operation, $payload, $inserts)) {
            $result = $this->runOperation($label, $operation, $payload);
            $this->assertStatus($result, 200);
            $this->assertHistory($label, $this->attempt(1, $inserts));
            $this->assertCourseLockFirst($label, $result, [$this->offering]);
        }
    }

    /** C6 / #3b: an orphan destination's row, or an unlinked item's row, is the first lock. */
    public function testC6NoCoursePathsLockTheDestinationOrItemRowFirst(ConcurrencyTester $I)
    {
        $attached = $this->item('c6-orphan-attached');
        $owner = $this->item('c6-orphan-owner');
        $orphan = $this->orphanDestination();
        $this->tracker->insertAttachment($orphan, $attached, ['destination_kind' => 'electronic']);
        $owned = $this->orphanDestination(['owner_item_kind' => 'new', 'owner_item_id' => $owner['id'], 'owner_live' => 1]);
        $unlinked = $this->item('c6-unlinked');
        \Yii::$app->db->createCommand()->update('faculty_submissions', ['offering_id' => null], [
            'submission_id' => $unlinked['submission_id'],
        ])->execute();
        $runs = [
            ['c6-orphan-detach', 'detach', ['item' => $attached], ['publication_destinations', 'id', $orphan]],
            ['c6-orphan-retire', 'retire', ['destination_id' => $orphan], ['publication_destinations', 'id', $orphan]],
            ['c6-orphan-release', 'release', ['item' => $owner], ['publication_destinations', 'id', $owned]],
            ['c6-unlinked-detach', 'detach', ['item' => $unlinked], ['submission_new_resources', 'id', $unlinked['id']]],
            ['c6-unlinked-release', 'release', ['item' => $unlinked], ['submission_new_resources', 'id', $unlinked['id']]],
        ];
        foreach ($runs as list($label, $operation, $payload, $lock)) {
            $result = $this->runOperation($label, $operation, $payload);
            $this->assertStatus($result, 200);
            $this->assertHistory($label, $this->attempt(1));
            $this->assertRowLockFirst($label, $result, ...$lock);
        }
        Assert::assertNull($this->attachmentRows($attached)[0]['live']);
        Assert::assertNotNull($this->destinationRow($orphan)['retired_at']);
        Assert::assertNull($this->destinationRow($owned)['owner_live']);
    }

    /** C6 / #3b: missing input returns its contract error after the locking read that proves it missing. */
    public function testC6MissingInputIsProvedMissingByALockingRead(ConcurrencyTester $I)
    {
        $item = $this->item('c6-missing');
        $missing = (int)\Yii::$app->db->createCommand('SELECT COALESCE(MAX(id), 0) + 1000 FROM publication_destinations')
            ->queryScalar();
        foreach ([
            ['c6-missing-retire', 'retire', ['destination_id' => $missing]],
            ['c6-missing-attach', 'attach_by_id', ['item' => $item, 'destination_id' => $missing]],
        ] as list($label, $operation, $payload)) {
            $result = $this->runOperation($label, $operation, $payload);
            $this->assertStatus($result, 409, 'destination_missing');
            $this->assertHistory($label, $this->attempt(1));
            $this->assertRowLockFirst($label, $result, 'publication_destinations', 'id', $missing);
        }

        $missingEntry = (int)\Yii::$app->db->createCommand('SELECT MAX(course_resource_id) + 1000 FROM course_resources')
            ->queryScalar();
        $result = $this->runOperation('c6-missing-pointer', 'attach_by_pointer', ['item' => $item, 'pointer' => [
            'destination_kind' => 'electronic', 'course_resource_id' => $missingEntry,
        ]]);
        $this->assertStatus($result, 409, 'destination_missing');
        $this->assertHistory('c6-missing-pointer', $this->attempt(1));
        $proof = preg_grep(
            '/\bFROM\s+`?course_resources`?\b.*\bcourse_resource_id`?\s*=\s*\'?' . $missingEntry . '\'?(?!\d).*\bFOR\s+UPDATE\b/is',
            $this->attemptQueries('c6-missing-pointer', $result)[0]
        );
        Assert::assertNotEmpty($proof, 'The missing pointer entry must be proved missing by a locking read.');
        Assert::assertSame([], $this->attachmentRows($item));
    }

    /** C6: a call nested two levels deep in a caller's transaction is identified and checked the same way. */
    public function testC6NestedCallLocksItsCourseFirstAfterTheCallersWrites(ConcurrencyTester $I)
    {
        $item = $this->item('c6-nested');
        $destination = $this->tracker->insertDestination($this->electronic('c6-nested-entry'));
        $caller = $this->tracker->callerName('c6-nested');
        $result = $this->runOperation('c6-nested', 'attach_by_id', [
            'item' => $item, 'destination_id' => $destination, 'nest' => 2, 'caller_write' => $caller,
        ]);
        $this->assertStatus($result, 200);
        $this->assertHistory('c6-nested', $this->attempt(1, ['attach'], false));
        $started = array_values(array_filter($this->supervisor->history('c6-nested'), function ($frame) {
            return $frame['phase'] === 'attempt_started';
        }));
        Assert::assertSame([1, 2], [$started[0]['context']['call_id'], $started[0]['context']['depth']]);
        $this->assertCourseLockFirst('c6-nested', $result, [$this->offering]);
        Assert::assertSame([$caller . '-L1', $caller . '-L2'], $this->tracker->callerRows($caller));
    }

    /** C8: retire first on a destination whose course was deleted (offering_id NULL). */
    public function testC8OrphanRetireHoldsTheDestinationRowThenDetachSeesItDetached(ConcurrencyTester $I)
    {
        $run = $this->runOrphanRetireVersusDetach(true);
        $this->assertStatus($run['retire'], 200);
        $this->assertStatus($run['detach'], 200);
        Assert::assertFalse($run['detach']['result']['body']['detached']);
        Assert::assertNull($run['attachment']['live']);
        Assert::assertSame($run['attachment_after_a'], $run['attachment']);
        Assert::assertNotNull($this->destinationRow($run['destination_id'])['retired_at']);
    }

    /** C8: detach first on the orphan destination, then retire finds nothing left to detach. */
    public function testC8OrphanDetachHoldsTheDestinationRowThenRetireLeavesTheDetachedRow(ConcurrencyTester $I)
    {
        $run = $this->runOrphanRetireVersusDetach(false);
        $this->assertStatus($run['detach'], 200);
        Assert::assertTrue($run['detach']['result']['body']['detached']);
        $this->assertStatus($run['retire'], 200);
        Assert::assertNull($run['attachment']['live']);
        Assert::assertSame($run['attachment_after_a'], $run['attachment']);
        Assert::assertNotNull($this->destinationRow($run['destination_id'])['retired_at']);
    }

    private function runAttachVersusRetire($retireFirst)
    {
        $item = $this->item('c1-item');
        $destinationId = $this->tracker->insertDestination($this->electronic('c1-entry'));
        $operations = [
            'c1-retire' => ['retire', ['destination_id' => $destinationId]],
            'c1-attach' => ['attach_by_id', ['item' => $item, 'destination_id' => $destinationId]],
        ];
        list($a, $b) = $retireFirst ? ['c1-retire', 'c1-attach'] : ['c1-attach', 'c1-retire'];
        $this->pauseAt($a, $operations[$a][0], $operations[$a][1], 'locked');
        $this->assertContended($this->lockProbe('offering', $this->offering));
        $this->pauseAt($b, $operations[$b][0], $operations[$b][1], 'discovered');
        $this->releaseIntoBlock($b, 'offering', $this->offering);
        $this->supervisor->release($a, 'locked', 1);
        $results = [$a => $this->supervisor->complete($a)];
        $afterA = ['destination_after_a' => $this->destinationRow($destinationId), 'attachments_after_a' => $this->attachmentRows($item)];
        $results[$b] = $this->supervisor->complete($b);
        return $afterA + [
            'retire' => $results['c1-retire'], 'attach' => $results['c1-attach'],
            'item' => $item, 'destination_id' => $destinationId,
        ];
    }

    private function runOrphanRetireVersusDetach($retireFirst)
    {
        $item = $this->item('c8-item');
        $orphan = $this->orphanDestination();
        $attachmentId = $this->tracker->insertAttachment($orphan, $item, ['destination_kind' => 'electronic']);
        $operations = [
            'c8-retire' => ['retire', ['destination_id' => $orphan]],
            'c8-detach' => ['detach', ['item' => $item]],
        ];
        list($a, $b) = $retireFirst ? ['c8-retire', 'c8-detach'] : ['c8-detach', 'c8-retire'];
        $this->pauseAt($a, $operations[$a][0], $operations[$a][1], 'locked');
        $this->assertContended($this->lockProbe('destination', $orphan));
        $this->pauseAt($b, $operations[$b][0], $operations[$b][1], 'discovered');
        $this->releaseIntoBlock($b, 'destination', $orphan);
        $this->supervisor->release($a, 'locked', 1);
        $results = [$a => $this->supervisor->complete($a)];
        $afterA = $this->row('publication_attachments', 'id = :id', [':id' => $attachmentId]);
        $results[$b] = $this->supervisor->complete($b);
        $this->assertHistory($a, $this->attempt(1));
        $this->assertHistory($b, $this->attempt(1));
        return [
            'retire' => $results['c8-retire'], 'detach' => $results['c8-detach'], 'destination_id' => $orphan,
            'attachment_after_a' => $afterA,
            'attachment' => $this->row('publication_attachments', 'id = :id', [':id' => $attachmentId]),
        ];
    }

    /** A live-looking registry row of a deleted course: offering_id NULL (FK SET NULL), pointer already nulled. */
    private function orphanDestination(array $values = [])
    {
        return $this->tracker->insertDestination(
            ['destination_kind' => 'electronic', 'offering_id' => null],
            array_merge(['origin_offering_id' => $this->offering], $values)
        );
    }
}
