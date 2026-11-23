<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';
require_once __DIR__ . '/../_support/Api119A2ChecklistFixture.php';

use Firebase\JWT\JWT;
use PHPUnit\Framework\Assert;

/** Covers the atomic single-item history-review route. */
class Api119CHistoryReviewCest extends Api109FunctionalCest
{
    protected $prefix = 'test-api119c2-';

    private $reviewerToken;
    private $adminToken;
    private $facultyToken;
    private $createdUuids = [];

    public function _before(FunctionalTester $I)
    {
        $this->createdUuids = [];
        parent::_before($I);
        $this->reviewerToken = $this->tokenWithIdentity($this->prefix . 'staff', 'staff', 'token-reviewer-id');
        $this->adminToken = $this->tokenWithIdentity($this->prefix . 'admin', 'admin', 'token-admin-id');
        $this->facultyToken = $this->tokenWithIdentity($this->prefix . 'faculty', 'faculty', $this->prefix . 'faculty');
    }

    public function singleItemReviewValidatesAccessAndPreservesOtherState(FunctionalTester $I)
    {
        $cases = [
            ['finished', null, 'unlinked', $this->reviewerToken],
            ['finished', $this->past(), 'linked', $this->reviewerToken],
            ['not_finished', null, 'linked', $this->adminToken],
            ['not_finished', $this->past(), 'linked', $this->reviewerToken],
        ];
        $reviewed = [];
        foreach ($cases as $index => $case) {
            list($decision, $latch, $linkState, $token) = $case;
            $fixture = $this->createReviewFixture('valid-' . $index, $latch, $linkState);
            if ($index === 0) {
                \Yii::$app->db->createCommand()->update('submission_new_resources', [
                    'claimed_by' => $this->prefix . 'other-holder',
                    'claimed_at' => $this->past(),
                    'last_activity_at' => $this->past(),
                ], ['id' => $fixture['item_id']])->execute();
            }
            $before = $this->snapshot($fixture['item_id']);
            $reason = '  Synthetic history review ' . $index . '  ';
            $this->postWithToken($I, $token, $fixture['item_id'], [
                'decision' => $decision,
                'reason' => $reason,
            ]);
            $I->seeResponseCodeIs(200);
            $response = $this->response($I);
            Assert::assertSame([
                'item_id' => $fixture['item_id'],
                'submission_id' => $fixture['submission_id'],
                'decision' => $decision,
                'reviewed_at' => $response['reviewed_at'],
            ], $response);
            Assert::assertRegExp('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $response['reviewed_at']);

            $after = $this->snapshot($fixture['item_id']);
            $expectedItem = $before['item'];
            if ($decision === 'finished' && $latch === null) {
                $expectedItem['locked_for_faculty_at'] = $response['reviewed_at'];
                unset($expectedItem['updated_at'], $after['item']['updated_at']);
            }
            Assert::assertSame($expectedItem, $after['item']);
            $expectedReview = $before['review'];
            $expectedReview['reviewed_at'] = $response['reviewed_at'];
            $expectedReview['reviewed_by_staff_id'] = $token === $this->adminToken
                ? 'token-admin-id' : 'token-reviewer-id';
            $expectedReview['decision'] = $decision;
            $expectedReview['reason'] = trim($reason);
            Assert::assertSame($expectedReview, $after['review']);
            Assert::assertCount(1, $after['events']);
            $event = $after['events'][0];
            Assert::assertSame('history_reviewed', $event['event_type']);
            Assert::assertSame('new', $event['item_kind']);
            Assert::assertSame($fixture['submission_id'], (int)$event['submission_id']);
            Assert::assertSame($fixture['item_id'], (int)$event['item_id']);
            Assert::assertSame($token === $this->adminToken ? $this->prefix . 'admin' : $this->prefix . 'staff',
                $event['actor_username']);
            Assert::assertSame($token === $this->adminToken ? 'admin' : 'staff', $event['actor_role']);
            Assert::assertSame(trim($reason), $event['reason']);
            $beforeEvent = json_decode($event['before_json'], true);
            $afterEvent = json_decode($event['after_json'], true);
            Assert::assertSame([
                'decision' => null,
                'locked_for_faculty_at' => $latch,
            ], $beforeEvent);
            Assert::assertSame([
                'decision' => $decision,
                'locked_for_faculty_at' => $decision === 'finished' ? ($latch ?: $response['reviewed_at']) : $latch,
            ], $afterEvent);
            Assert::assertArrayNotHasKey('status', $beforeEvent);
            Assert::assertArrayNotHasKey('status', $afterEvent);
            $reviewed[] = $fixture;
        }

        $this->getFacultySubmission($I, $reviewed[0]['uuid']);
        $I->seeResponseCodeIs(200);
        $facultyBody = $this->response($I);
        Assert::assertStringNotContainsString('history_review', json_encode($facultyBody));
        Assert::assertStringNotContainsString('Synthetic history review 0', json_encode($facultyBody));

        $fixture = $this->createReviewFixture('validation', null, 'linked');
        $before = $this->snapshot($fixture['item_id']);
        $invalid = [
            [['decision' => 'finished'], 'invalid_review_reason'],
            [['decision' => 'finished', 'reason' => '   '], 'invalid_review_reason'],
            [['decision' => 'finished', 'reason' => ['wrong type']], 'invalid_review_reason'],
            [['decision' => 'complete', 'reason' => 'A reason'], 'invalid_review_decision'],
            [['decision' => 'finished', 'reason' => str_repeat('a', 65536)], 'review_reason_too_long'],
        ];
        foreach ($invalid as $case) {
            $this->postWithToken($I, $this->reviewerToken, $fixture['item_id'], $case[0]);
            $this->assertError($I, 422, $case[1]);
            Assert::assertSame($before, $this->snapshot($fixture['item_id']));
        }

        $atLimit = $this->createReviewFixture('max-reason', null, 'linked');
        $maxReason = str_repeat('a', 65533) . 'é';
        Assert::assertSame(65535, strlen($maxReason));
        $this->postWithToken($I, $this->reviewerToken, $atLimit['item_id'], [
            'decision' => 'not_finished', 'reason' => $maxReason,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($maxReason, $this->snapshot($atLimit['item_id'])['review']['reason']);

        $missingReview = $this->createSubmissionFixture('missing-review', 'submitted', 'linked');
        $missingBefore = $this->snapshot($missingReview['item_id']);
        $this->postWithToken($I, $this->reviewerToken, $missingReview['item_id'], [
            'decision' => 'finished', 'reason' => 'Synthetic missing review',
        ]);
        $this->assertError($I, 404, 'history_review_not_found');
        Assert::assertSame($missingBefore, $this->snapshot($missingReview['item_id']));

        $draft = $this->createReviewFixture('draft', null, 'linked', 'draft');
        $before = $this->snapshot($draft['item_id']);
        $this->postWithToken($I, $this->reviewerToken, $draft['item_id'], [
            'decision' => 'finished', 'reason' => 'Synthetic draft review',
        ]);
        $this->assertError($I, 409, 'submission_not_submitted');
        Assert::assertSame($before, $this->snapshot($draft['item_id']));

        $duplicate = $this->createReviewFixture('duplicate', null, 'linked', 'submitted', [
            'reviewed_at' => $this->past(), 'reviewed_by_staff_id' => 'existing-reviewer',
            'decision' => 'not_finished', 'reason' => 'Existing synthetic review',
        ]);
        $before = $this->snapshot($duplicate['item_id']);
        $this->postWithToken($I, $this->reviewerToken, $duplicate['item_id'], [
            'decision' => 'finished', 'reason' => 'Synthetic duplicate review',
        ]);
        $this->assertError($I, 409, 'already_reviewed');
        Assert::assertSame($before, $this->snapshot($duplicate['item_id']));

        $mismatched = $this->createSubmissionFixture('mismatched-review', 'submitted', 'linked');
        $other = $this->createSubmissionFixture('other-submission', 'submitted', 'linked');
        $this->insertReview($mismatched['item_id'], $other['submission_id']);
        $before = $this->snapshot($mismatched['item_id']);
        $this->postWithToken($I, $this->reviewerToken, $mismatched['item_id'], [
            'decision' => 'finished', 'reason' => 'Synthetic association mismatch',
        ]);
        $this->assertError($I, 404, 'history_review_not_found');
        Assert::assertSame($before, $this->snapshot($mismatched['item_id']));

        $authFixture = $this->createReviewFixture('auth', null, 'linked');
        $route = 'workflow-history-review/options';
        $authBefore = $this->snapshot($authFixture['item_id']);
        $I->sendJsonRequest('OPTIONS', $route, []);
        $I->seeResponseCodeIs(204);
        $I->haveHttpHeader('Authorization', '');
        $I->sendJsonRequest('POST', 'workflow-history-review/review-item', [
            'decision' => 'finished', 'reason' => 'Synthetic auth',
        ], ['id' => $authFixture['item_id']]);
        $I->seeResponseCodeIs(401);
        foreach (['faculty', 'employee'] as $role) {
            $token = $this->tokenWithIdentity($this->prefix . $role, $role, $this->prefix . $role);
            $this->postWithToken($I, $token, $authFixture['item_id'], [
                'decision' => 'finished', 'reason' => 'Synthetic denied review',
            ]);
            $I->seeResponseCodeIs(403);
        }
        Assert::assertSame($authBefore, $this->snapshot($authFixture['item_id']));

        $this->postWithToken($I, $this->reviewerToken, $this->nextMissingItemId(), [
            'decision' => 'finished', 'reason' => 'Synthetic missing item',
        ]);
        $this->assertError($I, 404, 'item_not_found');
    }

    public function committedEventFailureRetriesAndExhaustsWithoutPartialWrites(FunctionalTester $I)
    {
        $restore = Api116B1CommittedConnection::swap();
        $originalCommandClass = \Yii::$app->db->commandClass;
        \Yii::$app->db->commandClass = Api119A2FailingCommand::class;
        Api119A2FailingCommand::clearConfiguration();
        try {
            $retry = $this->createReviewFixture('retry', null, 'unlinked');
            Api119A2FailingCommand::resetQueries();
            Api119A2FailingCommand::failNext('/INSERT INTO `?workflow_events`?/i', 2, true);
            $this->postWithToken($I, $this->reviewerToken, $retry['item_id'], [
                'decision' => 'finished', 'reason' => 'Synthetic retry review',
            ]);
            $I->seeResponseCodeIs(200);
            Assert::assertSame(2, Api119A2FailingCommand::matches());
            Assert::assertSame(0, Api119A2FailingCommand::remaining());
            Assert::assertSame(1, count($this->snapshot($retry['item_id'])['events']));
            $this->assertReviewLockOrder(Api119A2FailingCommand::queries());

            $exhausted = $this->createReviewFixture('exhausted', null, 'unlinked');
            $before = $this->snapshot($exhausted['item_id']);
            Api119A2FailingCommand::resetQueries();
            Api119A2FailingCommand::failNext('/INSERT INTO `?workflow_events`?/i', 3, true);
            $this->postWithToken($I, $this->reviewerToken, $exhausted['item_id'], [
                'decision' => 'finished', 'reason' => 'Synthetic exhausted review',
            ]);
            $I->seeResponseCodeIs(409);
            Assert::assertSame(['error_code', 'reference'], array_keys($this->response($I)));
            Assert::assertSame('item_contention', $this->response($I)['error_code']);
            Assert::assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/', $this->response($I)['reference']);
            Assert::assertSame(3, Api119A2FailingCommand::matches());
            Assert::assertSame($before, $this->snapshot($exhausted['item_id']));
        } finally {
            Api119A2FailingCommand::clearConfiguration();
            \Yii::$app->db->commandClass = $originalCommandClass;
            $this->cleanupCommittedFixtures();
            call_user_func($restore);
        }
    }

    private function createReviewFixture($suffix, $latch, $linkState, $status = 'submitted', array $review = [])
    {
        $fixture = $this->createSubmissionFixture($suffix, $status, $linkState);
        $this->insertReview($fixture['item_id'], $fixture['submission_id'], $review);
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'locked_for_faculty_at' => $latch,
        ], ['id' => $fixture['item_id']])->execute();
        return $fixture;
    }

    private function createSubmissionFixture($suffix, $status, $linkState)
    {
        $submissionId = $this->createSubmission($suffix);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'status' => $status,
            'submitted_at' => date('Y-m-d H:i:s', time() - 300),
            'link_state' => $linkState,
        ], ['submission_id' => $submissionId])->execute();
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $uuid = (string)\Yii::$app->db->createCommand(
            'SELECT submission_uuid FROM faculty_submissions WHERE submission_id = :id',
            [':id' => $submissionId]
        )->queryScalar();
        $this->createdUuids[] = $uuid;
        return ['submission_id' => $submissionId, 'item_id' => $itemId, 'uuid' => $uuid];
    }

    private function insertReview($itemId, $submissionId, array $review = [])
    {
        \Yii::$app->db->createCommand()->insert('item_history_review', array_merge([
            'item_id' => $itemId,
            'submission_id' => $submissionId,
            'trace' => 'none',
            'flagged_at' => $this->past(),
            'reviewed_at' => null,
            'reviewed_by_staff_id' => null,
            'decision' => null,
            'reason' => null,
        ], $review))->execute();
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

    private function postWithToken(FunctionalTester $I, $token, $itemId, array $payload)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonRequest('POST', 'workflow-history-review/review-item', $payload, ['id' => $itemId]);
    }

    private function getFacultySubmission(FunctionalTester $I, $uuid)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->facultyToken);
        $I->sendJsonRequest('GET', 'faculty-submission/view', [], ['id' => $uuid]);
    }

    private function assertError(FunctionalTester $I, $status, $code)
    {
        $I->seeResponseCodeIs($status);
        $body = $this->response($I);
        Assert::assertSame(['error_code', 'message', 'reference'], array_keys($body));
        Assert::assertSame($code, $body['error_code']);
        Assert::assertSame('The item history review could not be completed.', $body['message']);
        Assert::assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/', $body['reference']);
    }

    private function assertReviewLockOrder(array $queries)
    {
        $locks = array_values(array_filter($queries, function ($sql) {
            return preg_match('/\bFOR UPDATE\b/i', $sql);
        }));
        foreach ([
            '/FROM `?faculty_submissions`?.*FOR UPDATE/i',
            '/FROM `?submission_new_resources`?.*FOR UPDATE/i',
            '/FROM `?item_history_review`?.*FOR UPDATE/i',
        ] as $index => $pattern) {
            Assert::assertRegExp($pattern, $locks[$index] ?? '');
        }
    }

    private function nextMissingItemId()
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT GREATEST(COALESCE((SELECT MAX(id) FROM submission_new_resources), 0), '
            . 'COALESCE((SELECT MAX(id) FROM submission_reuse_resources), 0)) + 1000'
        )->queryScalar();
    }

    private function cleanupCommittedFixtures()
    {
        $db = \Yii::$app->db;
        foreach ($this->createdUuids as $uuid) {
            $submissionId = $db->createCommand(
                'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
                [':uuid' => $uuid]
            )->queryScalar();
            if ($submissionId) {
                $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionId])->execute();
                $db->createCommand()->delete('submission_publication_state', [
                    'submission_id' => $submissionId,
                ])->execute();
                TestSubmissionFixture::delete($uuid);
            }
        }
        $this->createdUuids = [];
    }

    private function tokenWithIdentity($username, $role, $id)
    {
        return JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $id,
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function past()
    {
        return date('Y-m-d H:i:s', time() - 300);
    }
}
