<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';

use PHPUnit\Framework\Assert;

/**
 * C7: a real gap-lock deadlock between two courses is detected (1213) and the victim's whole transaction is retried.
 * C10: a locking read on a missing key makes a direct, non-compliant insert of that key wait (exactly 1205 in 1 s).
 */
class Api116B1DeadlockCest extends Api116B1ConcurrencyCase
{
    /** The registry keys expected just below and above the contended gap; null bounds mean infimum or supremum. */
    private $gapBounds = [null, null];

    public function testC7BoundedGapDeadlockIsRetriedAndBothAttachmentsCommit(ConcurrencyTester $I)
    {
        $this->assertDeadlockRetried(true);
    }

    public function testC7SupremumGapDeadlockIsRetriedAndBothAttachmentsCommit(ConcurrencyTester $I)
    {
        $this->assertDeadlockRetried(false);
    }

    /** Both contenders are nested in callers that wrote a row; the victim's caller is rolled back, the survivor's commits. */
    public function testC7NestedDeadlockVictimRaisesRestartRequiredAndLosesItsCallersRow(ConcurrencyTester $I)
    {
        $pair = $this->gapPair(true);
        $callers = ['c7-a' => $this->tracker->callerName('c7-a'), 'c7-b' => $this->tracker->callerName('c7-b')];
        $run = $this->runDeadlock($pair, function ($label) use ($callers) {
            return ['nest' => 1, 'caller_write' => $callers[$label]];
        });
        $victim = $run['victim'];
        $survivor = $run['survivor'];
        Assert::assertSame(
            ['restart_required' => true, 'cause_code' => 1213, 'level_at_restart' => 0],
            $run['results'][$victim]['result']
        );
        $this->assertStatus($run['results'][$survivor], 200);
        Assert::assertSame([], $this->tracker->callerRows($callers[$victim]));
        Assert::assertSame([$callers[$survivor] . '-L1'], $this->tracker->callerRows($callers[$survivor]));
        Assert::assertSame([], $this->attachmentRows($pair[$victim]['item']));
        Assert::assertSame([], $this->rowsForPointer($pair[$victim]['pointer']));
        $this->assertAttachedTo($pair[$survivor]);
        $this->assertHistory($victim, $this->failedAttempt(1, ['dest'], 1213));
        $this->assertHistory($survivor, $this->attempt(1, ['dest', 'attach'], false));
    }

    public function testC10LockedMissingCourseResourceKeyMakesADirectInsertWait(ConcurrencyTester $I)
    {
        $this->fences();
        $item = $this->item('c10-electronic');
        $pointer = $this->electronic('c10-electronic-entry');
        $this->assertCompetingInsertWaits('attach_by_pointer', ['item' => $item, 'pointer' => $pointer], ['dest'], 'publication_destinations', $this->competingDestination([
            'course_resource_id' => $pointer['course_resource_id'],
        ]));
        Assert::assertSame([], $this->rowsForPointer($pointer));
        Assert::assertSame([], $this->attachmentRows($item));
    }

    public function testC10LockedMissingPhysicalReferenceKeyMakesADirectInsertWait(ConcurrencyTester $I)
    {
        $this->fences();
        $item = $this->item('c10-physical');
        $instance = $this->instanceId();
        $this->setIdentity($item, $instance);
        $pointer = $this->physical('c10-physical-entry', $instance);
        $this->assertCompetingInsertWaits('attach_by_pointer', ['item' => $item, 'pointer' => $pointer], ['dest'], 'publication_destinations', $this->competingDestination([
            'destination_kind' => 'physical', 'physical_reference_id' => $pointer['physical_reference_id'],
        ]));
        Assert::assertSame([], $this->rowsForPointer($pointer));
    }

    public function testC10LockedMissingOwnerLiveKeyMakesADirectInsertWait(ConcurrencyTester $I)
    {
        $this->fences();
        $item = $this->item('c10-owner');
        $pointer = $this->electronic('c10-owner-entry');
        $this->assertCompetingInsertWaits('register_owned', ['item' => $item, 'pointer' => $pointer], ['dest'], 'publication_destinations', $this->competingDestination([
            'owner_item_kind' => $item['kind'], 'owner_item_id' => $item['id'], 'owner_live' => 1, 'ownership_source' => 'published',
        ]));
        Assert::assertSame([], $this->rowsForPointer($pointer));
    }

    public function testC10LockedMissingAttachmentItemLiveKeyMakesADirectInsertWait(ConcurrencyTester $I)
    {
        $this->fences();
        $item = $this->item('c10-attachment');
        $destinationId = $this->tracker->insertDestination($this->electronic('c10-attachment-entry'));
        // A registry row above the target that already has an attachment keeps the competing row out of any
        // destination_id gap the operation may hold.
        $above = $this->tracker->insertDestination($this->electronic('c10-attachment-above'));
        $this->tracker->insertAttachment($above, $this->item('c10-attachment-above-item'), ['destination_kind' => 'electronic']);
        $this->assertCompetingInsertWaits('attach_by_id', ['item' => $item, 'destination_id' => $destinationId], ['attach'], 'publication_attachments', [
            'destination_id' => $above, 'item_kind' => $item['kind'], 'item_id' => $item['id'],
            'attached_snapshot_json' => '{}', 'live' => 1,
        ]);
        Assert::assertSame([], $this->attachmentRows($item));
    }

    private function assertDeadlockRetried($bounded)
    {
        $this->assertGapLockingDatabase();
        $pair = $this->gapPair($bounded);
        $run = $this->runDeadlock($pair, function () {
            return [];
        });
        foreach ($pair as $label => $side) {
            $this->assertStatus($run['results'][$label], 200);
            $this->assertAttachedTo($side);
            $this->assertCourseLockFirst($label, $run['results'][$label], [$side['offering']]);
        }
        $this->assertHistory($run['victim'], array_merge(
            $this->failedAttempt(1, ['dest'], 1213),
            $this->attempt(2, ['dest', 'attach'])
        ));
        $this->assertHistory($run['survivor'], $this->attempt(1, ['dest', 'attach']));
    }

    /**
     * Two courses attach lazy pointers whose course_resource ids sit in one registry index gap. Both pause before
     * inserting; A is released and proven blocked on B's gap lock, then B is released into the deadlock. The victim
     * is held at attempt_failed (after its rollback) until the survivor has committed.
     */
    private function runDeadlock(array $pair, callable $extra)
    {
        foreach ($pair as $label => $side) {
            $frame = $this->pauseAt($label, 'attach_by_pointer', [
                'item' => $side['item'], 'pointer' => $side['pointer'],
            ] + call_user_func($extra, $label), 'before_insert');
            Assert::assertSame('publication_destinations', $frame['context']['table']);
        }
        $this->assertGapIsEmpty($pair);
        $this->supervisor->release('c7-a', 'before_insert', 1);
        $this->supervisor->assertSilent('c7-a', 1.0);
        $this->supervisor->release('c7-b', 'before_insert', 1);

        $results = [];
        $victim = null;
        $held = null;
        while (count($results) < 2) {
            if ($held !== null && count($results) === 1) {
                $this->supervisor->release($victim, 'attempt_failed', $held['attempt']);
                $held = null;
            }
            $open = array_values(array_diff(array_keys($pair), array_keys($results), $held ? [$victim] : []));
            list($label, $frame) = $this->supervisor->nextAny($open);
            if ($frame['phase'] === 'result') {
                $results[$label] = $this->supervisor->finish($label, $frame);
            } elseif ($frame['phase'] === 'attempt_failed') {
                Assert::assertNull($victim, 'Only one deadlock victim is scheduled.');
                Assert::assertSame(1213, (int)$frame['context']['mysql_code']);
                list($victim, $held) = [$label, $frame];
            } else {
                $this->supervisor->release($label, $frame['phase'], $frame['attempt']);
            }
        }
        Assert::assertNotNull($victim, 'MariaDB must pick a deadlock victim.');
        return ['results' => $results, 'victim' => $victim, 'survivor' => $victim === 'c7-a' ? 'c7-b' : 'c7-a'];
    }

    /** Distinct offerings, items and resources; adjacent course_resource ids with no registry row between them. */
    private function gapPair($bounded)
    {
        $this->gapBounds = [null, null];
        $low = $bounded ? $this->electronic('c7-low') : null;
        $pair = [
            'c7-a' => ['offering' => $this->offering, 'item' => $this->item('c7-a'), 'pointer' => $this->electronic('c7-a-entry')],
            'c7-b' => [
                'offering' => $this->otherOffering,
                'item' => $this->item('c7-b', $this->otherOffering),
                'pointer' => $this->electronic('c7-b-entry', $this->otherOffering),
            ],
        ];
        if ($bounded) {
            $high = $this->electronic('c7-high');
            $this->tracker->insertDestination($low);
            $this->tracker->insertDestination($high);
            $this->gapBounds = [$low['course_resource_id'], $high['course_resource_id']];
        }
        return $pair;
    }

    private function assertGapIsEmpty(array $pair)
    {
        $keys = [$pair['c7-a']['pointer']['course_resource_id'], $pair['c7-b']['pointer']['course_resource_id']];
        $db = \Yii::$app->db;
        $below = $db->createCommand('SELECT MAX(course_resource_id) FROM publication_destinations WHERE course_resource_id < :k', [
            ':k' => min($keys),
        ])->queryScalar();
        $above = $db->createCommand('SELECT MIN(course_resource_id) FROM publication_destinations WHERE course_resource_id >= :k', [
            ':k' => min($keys),
        ])->queryScalar();
        Assert::assertSame(1, max($keys) - min($keys), 'The contended keys are adjacent.');
        Assert::assertSame($this->gapBounds[1], $above === null ? null : (int)$above, 'Nothing sits in the gap; expected upper bound.');
        if ($this->gapBounds[0] !== null) {
            Assert::assertSame($this->gapBounds[0], (int)$below, 'Expected lower bound of the gap.');
        }
    }

    private function assertAttachedTo(array $side)
    {
        $registry = $this->rowsForPointer($side['pointer']);
        Assert::assertCount(1, $registry);
        Assert::assertSame((string)$side['offering'], $registry[0]['offering_id']);
        Assert::assertNull($registry[0]['owner_live']);
        $rows = $this->attachmentRows($side['item']);
        Assert::assertCount(1, $rows);
        Assert::assertSame([$registry[0]['id'], '1'], [$rows[0]['destination_id'], (string)$rows[0]['live']]);
        $suffix = $side['offering'] === $this->offering ? 'c7-a-entry' : 'c7-b-entry';
        $this->assertElectronicSnapshot($rows[0], $side['pointer'], $this->tracker->fixture()->electronicResourceName($suffix));
    }

    /** Non-NULL entries below the tested keys keep the competing row's NULL index values outside any held gap. */
    private function fences()
    {
        $owner = $this->item('c10-fence-owner');
        return [
            $this->tracker->insertDestination($this->electronic('c10-fence-electronic'), [
                'owner_item_kind' => $owner['kind'], 'owner_item_id' => $owner['id'], 'owner_live' => 1, 'ownership_source' => 'published',
            ]),
            $this->tracker->insertDestination($this->physical('c10-fence-physical', $this->instanceId())),
        ];
    }

    private function competingDestination(array $values)
    {
        return array_merge([
            'destination_kind' => 'electronic', 'course_resource_id' => null, 'physical_reference_id' => null,
            'offering_id' => $this->otherOffering, 'origin_offering_id' => $this->otherOffering,
            'owner_item_kind' => null, 'owner_item_id' => null, 'owner_live' => null, 'ownership_source' => 'none',
        ], $values);
    }

    /** A holds its locking read at before_insert; the insert waits (1205); after A rolls back the same insert succeeds. */
    private function assertCompetingInsertWaits($operation, array $payload, array $inserts, $table, array $values)
    {
        $frame = $this->pauseAt('c10-a', $operation, $payload, 'before_insert');
        Assert::assertSame($table, $frame['context']['table']);
        $probe = ['table' => $table, 'values' => $values];
        $this->assertContended($this->runOperation('c10-insert', 'insert_probe', $probe)['result']);
        $this->supervisor->abort('c10-a');
        Assert::assertSame('acquired', $this->runOperation('c10-control', 'insert_probe', $probe)['result']['outcome']);
        $this->assertHistory('c10-a', $this->attempt(1, $inserts, false));
    }
}
