<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';

use PHPUnit\Framework\Assert;

/** C2, C3, C4: same-course races run one at a time and the second sees the first's committed result. */
class Api116B1RaceCest extends Api116B1ConcurrencyCase
{
    /** C2 lazy pointer. Primary offering: the pointer's offering ($this->offering) for both workers. */
    public function testC2IdenticalLazyPointerAttachReturnsOneUnchangedWinner(ConcurrencyTester $I)
    {
        $this->runIdenticalRace('attach_by_pointer', true);
    }

    /** C2 existing registry row. Primary offering: the destination's offering ($this->offering) for both. */
    public function testC2IdenticalExistingRegistryAttachReturnsOneUnchangedWinner(ConcurrencyTester $I)
    {
        $this->runIdenticalRace('attach_by_id', false);
    }

    /** C3 on a committed unregistered entry. Primary offering: the pointer's offering ($this->offering). */
    public function testC3IdenticalRegisterOwnedReturnsOneUnchangedWinner(ConcurrencyTester $I)
    {
        $this->runIdenticalRace('register_owned', true);
    }

    /** C4 attach first. Primary offering: the destination's offering ($this->offering) for both. */
    public function testC4AttachFirstThenFollowRefreshesTheNewAttachment(ConcurrencyTester $I)
    {
        $this->runFollowVersusAttach(true);
    }

    /** C4 follow first. Primary offering: the destination's offering ($this->offering) for both. */
    public function testC4FollowFirstThenAttachTakesTheNewSnapshot(ConcurrencyTester $I)
    {
        $this->runFollowVersusAttach(false);
    }

    private function runIdenticalRace($operation, $lazy)
    {
        $item = $this->item('race-' . $operation);
        $pointer = $this->electronic('race-entry-' . $operation);
        $destinationBefore = $lazy ? null : $this->destinationRow($this->tracker->insertDestination($pointer));
        $this->tracker->insertPublicationState($item);
        $stateBefore = $this->stateRow($item);
        $payload = ['item' => $item] + ($operation === 'attach_by_id'
            ? ['destination_id' => (int)$destinationBefore['id']] : ['pointer' => $pointer]);
        $aReady = $this->startOperation('race-a', $operation, $payload + ['session_timestamp' => 1793360000]);
        $bReady = $this->startOperation('race-b', $operation, $payload + ['session_timestamp' => 1793440000]);
        Assert::assertCount(3, array_unique([$this->parentConnectionId, $aReady['connection_id'], $bReady['connection_id']]));
        $this->supervisor->advanceToPhase('race-a', 'discovered');
        $this->supervisor->advanceToPhase('race-b', 'discovered');
        $this->supervisor->release('race-a', 'discovered', 1);
        $this->supervisor->awaitPhase('race-a', 'locked', 1);
        $this->supervisor->release('race-b', 'discovered', 1);
        $this->supervisor->release('race-a', 'locked', 1);
        $this->supervisor->advanceToPhase('race-a', 'committed');

        $winner = $this->rowsForPointer($pointer);
        Assert::assertCount(1, $winner);
        $winner = $winner[0];
        if ($lazy) {
            Assert::assertSame([$aReady['session_time'], $aReady['session_time']], [$winner['created_at'], $winner['updated_at']]);
        } else {
            Assert::assertSame($destinationBefore, $winner);
        }
        $attachments = $this->attachmentRows($item);
        if ($operation !== 'register_owned') {
            Assert::assertCount(1, $attachments);
            Assert::assertSame($aReady['session_time'], $attachments[0]['attached_at']);
            Assert::assertSame($aReady['session_time'], $attachments[0]['updated_at']);
        }

        $this->supervisor->release('race-a', 'committed', 1);
        $a = $this->supervisor->complete('race-a');
        $b = $this->supervisor->complete('race-b');
        $this->assertStatus($a, 200);
        $this->assertStatus($b, 200);
        $key = $operation === 'register_owned' ? 'destination' : 'attachment';
        $winnerId = (int)($operation === 'register_owned' ? $winner['id'] : $attachments[0]['id']);
        Assert::assertSame($winnerId, (int)$a['result']['body'][$key]['id']);
        Assert::assertSame($winnerId, (int)$b['result']['body'][$key]['id']);
        Assert::assertSame([$winner], $this->rowsForPointer($pointer));
        Assert::assertSame($attachments, $this->attachmentRows($item));
        Assert::assertSame($stateBefore, $this->stateRow($item));
        $inserts = ['register_owned' => ['dest'], 'attach_by_pointer' => ['dest', 'attach'], 'attach_by_id' => ['attach']];
        $this->assertHistory('race-a', $this->attempt(1, $inserts[$operation]));
        $this->assertHistory('race-b', $this->attempt(1));
    }

    private function runFollowVersusAttach($attachFirst)
    {
        $existing = $this->item('c4-existing');
        $newcomer = $this->item('c4-newcomer', $this->offering, 'legacy_reuse');
        $destinationId = $this->tracker->insertDestination($this->electronic('c4-old'));
        $this->tracker->insertAttachment($destinationId, $existing, ['destination_kind' => 'electronic', 'name' => 'old']);
        $replacement = $this->electronic('c4-new');
        $operations = [
            'c4-attach' => ['attach_by_id', ['item' => $newcomer, 'destination_id' => $destinationId]],
            'c4-follow' => ['follow', ['destination_id' => $destinationId, 'pointer' => $replacement]],
        ];
        list($a, $b) = $attachFirst ? ['c4-attach', 'c4-follow'] : ['c4-follow', 'c4-attach'];
        $this->pauseAt($a, $operations[$a][0], $operations[$a][1], 'locked');
        $this->pauseAt($b, $operations[$b][0], $operations[$b][1], 'discovered');
        $this->releaseIntoBlock($b);
        $this->supervisor->release($a, 'locked', 1);
        $this->assertStatus($this->supervisor->complete($a), 200);
        $this->assertStatus($this->supervisor->complete($b), 200);

        $destination = $this->destinationRow($destinationId);
        Assert::assertSame((string)$replacement['course_resource_id'], $destination['course_resource_id']);
        foreach ([$existing, $newcomer] as $item) {
            $rows = $this->attachmentRows($item);
            Assert::assertCount(1, $rows);
            Assert::assertSame('1', (string)$rows[0]['live']);
            Assert::assertSame((string)$destinationId, $rows[0]['destination_id']);
            $this->assertElectronicSnapshot($rows[0], $replacement, $this->tracker->fixture()->electronicResourceName('c4-new'));
        }
        $this->assertHistory('c4-attach', $this->attempt(1, ['attach']));
        $this->assertHistory('c4-follow', $this->attempt(1, ['dest']));
    }
}
