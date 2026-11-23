<?php

use app\models\FacultySubmission;
use app\services\FacultyItemLockPredicate;

class FacultyItemLockPredicateTest extends \Codeception\Test\Unit
{
    /**
     * @dataProvider cases
     */
    public function testEvaluatesLockAndCapabilities(
        $now,
        array $submissionOverrides,
        $kind,
        array $itemOverrides,
        array $evidenceOverrides,
        $ambiguousFolder,
        array $expected
    ) {
        $submission = new FacultySubmission(array_replace([
            'status' => FacultySubmission::STATUS_SUBMITTED,
            'is_locked' => 0,
        ], $submissionOverrides));
        $item = array_replace([
            'claimed_by' => null,
            'claimed_at' => null,
            'last_activity_at' => null,
            'assigned_group_id' => null,
            'locked_for_faculty_at' => null,
        ], $itemOverrides);
        $evidence = array_replace([
            'open_run' => false,
            'publication_history' => false,
            'published' => false,
            'open_review' => false,
        ], $evidenceOverrides);

        $predicate = new FacultyItemLockPredicate($now);

        $this->assertSame($expected, $predicate->evaluate(
            $submission,
            $kind,
            $item,
            $evidence,
            $ambiguousFolder
        ));
    }

    public function cases()
    {
        $now = date('Y-m-d H:i:s');
        $activeClaimAt = date('Y-m-d H:i:s', strtotime($now) - 3600);
        $dueClaimAt = date('Y-m-d H:i:s', strtotime($now) - (72 * 3600));
        $activeClaim = [
            'claimed_by' => 17,
            'claimed_at' => $activeClaimAt,
            'last_activity_at' => $activeClaimAt,
        ];

        return [
            'unlocked' => [
                $now, [], 'new', [], [], false,
                self::expected(false, null, null, self::capabilities(true, true, true, true)),
            ],
            'active claim' => [
                $now, [], 'new', $activeClaim, [], false,
                self::expected(true, 'in_progress', 'The library is working on this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'claim exactly 72 hours old is due' => [
                $now, [], 'new', [
                    'claimed_by' => 17,
                    'claimed_at' => $dueClaimAt,
                    'last_activity_at' => $dueClaimAt,
                ], [], false,
                self::expected(false, null, null, self::capabilities(true, true, true, true)),
            ],
            'group with open run' => [
                $now, [], 'new', ['assigned_group_id' => 3], ['open_run' => true], false,
                self::expected(true, 'in_progress', 'The library is working on this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'group without open run' => [
                $now, [], 'new', ['assigned_group_id' => 3], [], false,
                self::expected(false, null, null, self::capabilities(true, true, true, true)),
            ],
            'latch is finished' => [
                $now, [], 'new', ['locked_for_faculty_at' => $now], [], false,
                self::expected(true, 'finished', 'The library has finished this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'history only is finished' => [
                $now, [], 'new', [], ['publication_history' => true], false,
                self::expected(true, 'finished', 'The library has finished this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'currently published' => [
                $now, [], 'new', [], ['publication_history' => true, 'published' => true], false,
                self::expected(true, 'published', 'This item is on your course page. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'reuse kind is legacy' => [
                $now, [], 'reuse', [], [], false,
                self::expected(true, 'legacy', "This item can't be changed here. To change it, send a message.",
                    self::capabilities(false, false, false, true)),
            ],
            'new row with reuse flag is not legacy' => [
                $now, [], 'new', ['is_reuse' => 1], [], false,
                self::expected(false, null, null, self::capabilities(true, true, true, true)),
            ],
            'new item with open review' => [
                $now, [], 'new', [], ['open_review' => true], false,
                self::expected(true, 'review', 'The library is checking this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'reviewed only' => [
                $now, [], 'new', [], [], false,
                self::expected(false, null, null, self::capabilities(true, true, true, true)),
            ],
            'reviewed with active claim' => [
                $now, [], 'new', $activeClaim, [], false,
                self::expected(true, 'in_progress', 'The library is working on this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'reviewed with latch' => [
                $now, [], 'new', ['locked_for_faculty_at' => $now], [], false,
                self::expected(true, 'finished', 'The library has finished this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'latch and claim and review is finished' => [
                $now, [], 'new', array_replace($activeClaim, ['locked_for_faculty_at' => $now]),
                ['open_review' => true], false,
                self::expected(true, 'finished', 'The library has finished this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'published beats claim' => [
                $now, [], 'new', $activeClaim, ['publication_history' => true, 'published' => true], false,
                self::expected(true, 'published', 'This item is on your course page. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'reuse beats claim' => [
                $now, [], 'reuse', $activeClaim, [], false,
                self::expected(true, 'legacy', "This item can't be changed here. To change it, send a message.",
                    self::capabilities(false, false, false, true)),
            ],
            'latch beats reuse' => [
                $now, [], 'reuse', ['locked_for_faculty_at' => $now], [], false,
                self::expected(true, 'finished', 'The library has finished this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'claim beats review' => [
                $now, [], 'new', $activeClaim, ['open_review' => true], false,
                self::expected(true, 'in_progress', 'The library is working on this item. To change it, send a message.',
                    self::capabilities(false, false, false, true)),
            ],
            'ambiguous folder disables move and reorder' => [
                $now, [], 'new', [], [], true,
                self::expected(false, null, null, self::capabilities(true, true, false, false)),
            ],
            'ambiguous folder and item lock' => [
                $now, [], 'new', $activeClaim, [], true,
                self::expected(true, 'in_progress', 'The library is working on this item. To change it, send a message.',
                    self::capabilities(false, false, false, false)),
            ],
            'draft skips item locks' => [
                $now, ['status' => 'draft'], 'reuse', array_replace($activeClaim, [
                    'assigned_group_id' => 3,
                    'locked_for_faculty_at' => $now,
                ]), ['open_run' => true, 'published' => true, 'publication_history' => true, 'open_review' => true], false,
                self::expected(false, null, null, self::capabilities(true, true, true, true)),
            ],
            'draft still respects ambiguous folder' => [
                $now, ['status' => 'draft'], 'new', [], [], true,
                self::expected(false, null, null, self::capabilities(true, true, false, false)),
            ],
            'course lock beats every item reason, including on a draft' => [
                $now, ['status' => 'draft', 'is_locked' => 1], 'reuse', array_replace($activeClaim, [
                    'assigned_group_id' => 3,
                    'locked_for_faculty_at' => $now,
                ]), ['open_run' => true, 'publication_history' => true, 'published' => true, 'open_review' => true], true,
                self::expected(true, null, 'This course is locked by the library. To change it, send a message.',
                    self::capabilities(false, false, false, false)),
            ],
            'complete submission has no capabilities' => [
                $now, ['status' => 'complete'], 'new', [], [], false,
                self::expected(false, null, null, self::capabilities(false, false, false, false)),
            ],
            'canceled submission has no capabilities' => [
                $now, ['status' => 'canceled'], 'new', [], [], false,
                self::expected(false, null, null, self::capabilities(false, false, false, false)),
            ],
        ];
    }

    private static function expected($locked, $lock, $message, array $capabilities)
    {
        return [
            'locked' => $locked,
            'lock' => $lock,
            'message' => $message,
            'capabilities' => $capabilities,
        ];
    }

    private static function capabilities($edit, $delete, $move, $reorder)
    {
        return [
            'edit' => $edit,
            'delete' => $delete,
            'move' => $move,
            'reorder' => $reorder,
        ];
    }
}
