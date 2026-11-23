<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';
require_once __DIR__ . '/../_support/Api119A2ChecklistFixture.php';

use PHPUnit\Framework\Assert;

/** Proves competing single and submission history reviews serialize on the submission row. */
class Api119CHistoryReviewCest extends Api116B1ConcurrencyCase
{
    private $fixture;
    private $prefix;

    public function _before(ConcurrencyTester $I)
    {
        parent::_before($I);
        $this->prefix = 'test-api119c4-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        $this->fixture = new Api119A2ChecklistFixture($this->prefix);
    }

    public function _after(ConcurrencyTester $I)
    {
        $this->supervisor->stopAll();
        $this->fixture->cleanup();
        parent::_after($I);
    }

    public function singleAndSubmissionReviewsSerializeInBothOrders(ConcurrencyTester $I)
    {
        $this->reviewRace('single-first', false);
        $this->reviewRace('submission-first', true);
    }

    private function reviewRace($suffix, $submissionFirst)
    {
        $fixture = $this->reviewFixture($suffix);
        $before = [
            $this->snapshot($fixture['first_item_id']),
            $this->snapshot($fixture['second_item_id']),
        ];
        $single = [
            'review_type' => 'item',
            'item_id' => $fixture['first_item_id'],
            'actor' => $this->prefix . 'single',
            'reviewer_id' => $this->prefix . 'single-id',
            'decision' => $submissionFirst ? 'not_finished' : 'finished',
            'reason' => 'Synthetic single ' . $suffix,
        ];
        $bulk = [
            'review_type' => 'submission',
            'submission_id' => $fixture['submission_id'],
            'actor' => $this->prefix . 'bulk',
            'reviewer_id' => $this->prefix . 'bulk-id',
            'decision' => $submissionFirst ? 'finished' : 'not_finished',
            'reason' => 'Synthetic submission ' . $suffix,
        ];

        if (!$submissionFirst) {
            $this->startReviewWorker('single-' . $suffix, 'item_lock_history_single', $single + [
                'pause_points' => ['review_written'],
            ]);
            $written = $this->supervisor->awaitPhase('single-' . $suffix, 'locked', 1);
            Assert::assertRegExp('/^UPDATE `?item_history_review`?/i', $written['context']['sql']);

            $this->startReviewWorker('bulk-' . $suffix, 'item_lock_history_submission', $bulk + [
                'pause_points' => ['before_action'],
            ]);
            $this->supervisor->awaitPhase('bulk-' . $suffix, 'discovered', 1);
            $this->releaseIntoSubmissionWait('bulk-' . $suffix, 'discovered', $fixture['submission_id']);
            $this->supervisor->release('single-' . $suffix, 'locked', 1);
            $singleResult = $this->supervisor->complete('single-' . $suffix);
            $bulkResult = $this->supervisor->complete('bulk-' . $suffix);

            $this->assertServiceStatus($singleResult, 200);
            $this->assertServiceStatus($bulkResult, 200);
            Assert::assertSame([
                'submission_id' => $fixture['submission_id'],
                'decision' => 'not_finished',
                'reviewed_count' => 1,
            ], $bulkResult['result']['body']);
            $singleAt = $singleResult['result']['body']['reviewed_at'];
            $this->assertReviewAfterRace($fixture, $before, 0, $single, $singleAt);
            $this->assertReviewAfterRace($fixture, $before, 1, $bulk, null);
            return;
        }

        $this->startReviewWorker('single-' . $suffix, 'item_lock_history_single', $single + [
            'pause_points' => ['discovered'],
        ]);
        $discovered = $this->supervisor->awaitPhase('single-' . $suffix, 'discovered', 1);
        Assert::assertRegExp('/SELECT submission_id FROM submission_new_resources WHERE id\s*=/',
            $discovered['context']['sql']);
        $this->startReviewWorker('bulk-' . $suffix, 'item_lock_history_submission', $bulk + [
            'pause_points' => ['review_written'],
        ]);
        $this->supervisor->awaitPhase('bulk-' . $suffix, 'locked', 1);
        $this->releaseIntoSubmissionWait('single-' . $suffix, 'discovered', $fixture['submission_id']);
        $this->supervisor->release('bulk-' . $suffix, 'locked', 1);
        $bulkResult = $this->supervisor->complete('bulk-' . $suffix);
        $singleResult = $this->supervisor->complete('single-' . $suffix);

        $this->assertServiceStatus($bulkResult, 200);
        Assert::assertSame(2, $bulkResult['result']['body']['reviewed_count']);
        $this->assertServiceStatus($singleResult, 409, 'already_reviewed');
        $this->assertReviewAfterRace($fixture, $before, 0, $bulk, null);
        $this->assertReviewAfterRace($fixture, $before, 1, $bulk, null);
        Assert::assertSame(1, count($this->queriesMatching(
            $singleResult['queries'], '/SELECT submission_id FROM submission_new_resources WHERE id\s*=/i'
        )));
        $bulkLocks = $this->queriesMatching($bulkResult['queries'], '/\bFOR UPDATE\b/i');
        Assert::assertRegExp('/FROM faculty_submissions WHERE submission_id = .*FOR UPDATE/i', $bulkLocks[0]);
        Assert::assertSame(
            $this->snapshot($fixture['first_item_id'])['review']['reviewed_at'],
            $this->snapshot($fixture['second_item_id'])['review']['reviewed_at']
        );
        $itemLockIds = [];
        foreach ($this->queriesMatching(
            $bulkResult['queries'],
            '/FROM `?submission_new_resources`? WHERE `?id`? = .*FOR UPDATE/i'
        ) as $sql) {
            preg_match('/WHERE `?id`? = (\d+)/i', $sql, $match);
            $itemLockIds[] = (int)$match[1];
        }
        Assert::assertSame([$fixture['first_item_id'], $fixture['second_item_id']], $itemLockIds);
    }

    private function reviewFixture($suffix)
    {
        $submission = $this->fixture->submission($suffix);
        $db = \Yii::$app->db;
        $db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submission['submission_id'],
            'resource_data' => json_encode(['title' => 'Synthetic second item ' . $suffix]),
            'item_status' => 'pending',
        ])->execute();
        $secondItemId = (int)$db->getLastInsertID();
        foreach ([$submission['item_id'], $secondItemId] as $itemId) {
            $db->createCommand()->insert('item_history_review', [
                'item_id' => $itemId,
                'submission_id' => $submission['submission_id'],
                'trace' => 'none',
                'flagged_at' => date('Y-m-d H:i:s', time() - 300),
                'reviewed_at' => null,
                'reviewed_by_staff_id' => null,
                'decision' => null,
                'reason' => null,
            ])->execute();
        }
        return [
            'submission_id' => $submission['submission_id'],
            'first_item_id' => $submission['item_id'],
            'second_item_id' => $secondItemId,
        ];
    }

    private function startReviewWorker($label, $operation, array $request)
    {
        $this->supervisor->start($label, ['op' => $operation] + $request);
        $ready = $this->supervisor->awaitPhase($label, 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, (int)$ready['connection_id']);
        Assert::assertSame('reserves_test', $ready['database']);
        Assert::assertSame('REPEATABLE-READ', $ready['isolation_level']);
        $this->connections[$label] = (int)$ready['connection_id'];
        $this->supervisor->release($label, 'ready', 0);
        return $ready;
    }

    private function releaseIntoSubmissionWait($label, $phase, $submissionId)
    {
        $this->releaseIntoWait($label, $phase, function () use ($submissionId) {
            return $this->lockProbe('submission', $submissionId);
        }, '/FROM\s+`?faculty_submissions`?\s+WHERE\s+`?submission_id`?.*FOR UPDATE/i');
    }

    private function assertReviewAfterRace(array $fixture, array $before, $index, array $expected, $reviewedAt)
    {
        $itemId = $index === 0 ? $fixture['first_item_id'] : $fixture['second_item_id'];
        $after = $this->snapshot($itemId);
        $actualReviewedAt = $reviewedAt === null ? $after['review']['reviewed_at'] : $reviewedAt;
        $expectedReview = $before[$index]['review'];
        $expectedReview['reviewed_at'] = $actualReviewedAt;
        $expectedReview['reviewed_by_staff_id'] = $expected['reviewer_id'];
        $expectedReview['decision'] = $expected['decision'];
        $expectedReview['reason'] = $expected['reason'];
        Assert::assertSame($expectedReview, $after['review']);

        $expectedItem = $before[$index]['item'];
        if ($expected['decision'] === 'finished') {
            $expectedItem['locked_for_faculty_at'] = $actualReviewedAt;
            unset($expectedItem['updated_at'], $after['item']['updated_at']);
        }
        Assert::assertSame($expectedItem, $after['item']);
        Assert::assertCount(1, $after['events']);
        $event = $after['events'][0];
        Assert::assertSame($fixture['submission_id'], (int)$event['submission_id']);
        Assert::assertSame($itemId, (int)$event['item_id']);
        Assert::assertSame('history_reviewed', $event['event_type']);
        Assert::assertSame($expected['actor'], $event['actor_username']);
        Assert::assertSame('staff', $event['actor_role']);
        Assert::assertSame($expected['reason'], $event['reason']);
        Assert::assertSame(['decision' => null, 'locked_for_faculty_at' => null], json_decode($event['before_json'], true));
        Assert::assertSame([
            'decision' => $expected['decision'],
            'locked_for_faculty_at' => $expected['decision'] === 'finished' ? $actualReviewedAt : null,
        ], json_decode($event['after_json'], true));
    }

    private function assertServiceStatus(array $frame, $status, $errorCode = null)
    {
        Assert::assertTrue($frame['ok'], $frame['error'] ?? 'Worker failed');
        Assert::assertSame($status, $frame['result']['status']);
        if ($errorCode !== null) {
            Assert::assertSame($errorCode, $frame['result']['body']['error_code']);
        }
    }

    private function snapshot($itemId)
    {
        $db = \Yii::$app->db;
        return [
            'item' => $db->createCommand(
                'SELECT * FROM submission_new_resources WHERE id = :id', [':id' => $itemId]
            )->queryOne(),
            'review' => $db->createCommand(
                'SELECT * FROM item_history_review WHERE item_id = :id', [':id' => $itemId]
            )->queryOne(),
            'events' => $db->createCommand(
                'SELECT * FROM workflow_events WHERE item_kind = "new" AND item_id = :id ORDER BY id',
                [':id' => $itemId]
            )->queryAll(),
        ];
    }

    private function queriesMatching(array $queries, $pattern)
    {
        return array_values(array_filter($queries, function ($sql) use ($pattern) {
            return preg_match($pattern, $sql);
        }));
    }
}
