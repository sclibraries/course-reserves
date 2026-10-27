<?php

use PHPUnit\Framework\Assert;

/** Covers newest-first ordering of the staff submissions queue. */
class Api101PendingSubmissionOrderCest extends BaseFunctionalCest
{
    private $prefix = 'test-api101-';

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    public function submittedAndDraftRowsUseTheirNewestEffectiveDate(FunctionalTester $I)
    {
        $older = $this->createSubmission(1, 'submitted', '2037-03-01 12:00:00');
        $middle = $this->createSubmission(2, 'submitted', '2037-03-03 12:00:00');
        $draft = $this->createSubmission(3, 'draft', '2037-03-04 12:00:00');
        $newer = $this->createSubmission(4, 'submitted', '2037-03-05 12:00:00');

        $this->getPending($I);

        $I->seeResponseCodeIs(200);
        Assert::assertSame([$newer, $draft, $middle, $older], $this->submissionIds($I));
    }

    public function tiedSubmissionDatesUseHigherIdFirst(FunctionalTester $I)
    {
        $date = '2037-04-01 12:00:00';
        $lowerId = $this->createSubmission(5, 'submitted', $date);
        $higherId = $this->createSubmission(6, 'submitted', $date);

        $this->getPending($I);

        $I->seeResponseCodeIs(200);
        Assert::assertSame([$higherId, $lowerId], $this->submissionIds($I));
    }

    public function pageTwoContinuesTheSameNewestFirstOrder(FunctionalTester $I)
    {
        $ids = [];
        for ($index = 1; $index <= 22; $index++) {
            $date = '2037-05-01 00:00:' . str_pad((string)$index, 2, '0', STR_PAD_LEFT);
            $ids[$index] = $this->createSubmission(6 + $index, 'submitted', $date);
        }

        $this->getPending($I);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(array_reverse(array_slice($ids, 2, 20, true)), $this->submissionIds($I));

        $this->getPending($I, ['page' => 2]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame([$ids[2], $ids[1]], array_slice($this->submissionIds($I), 0, 2));
    }

    private function createSubmission($index, $status, $effectiveDate)
    {
        $uuid = '10101010-1010-4010-8010-' . str_pad(dechex($index), 12, '0', STR_PAD_LEFT);
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'API101-' . $index,
            'section' => '01',
            'course_title' => 'Synthetic API-101 ordering fixture ' . $index,
            'status' => $status,
        ]);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'submitted_at' => $status === 'draft' ? null : $effectiveDate,
            'updated_at' => $effectiveDate,
        ], ['submission_id' => $submissionId])->execute();
        return $submissionId;
    }

    private function getPending(FunctionalTester $I, array $params = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token());
        $I->sendJsonRequest('GET', 'submission-workflow/pending-submissions', [], $params);
    }

    private function submissionIds(FunctionalTester $I)
    {
        $response = $I->grabJsonResponse();
        $items = isset($response['items']) ? $response['items'] : $response;
        return array_map('intval', array_column($items, 'submission_id'));
    }

    private function token()
    {
        $now = time();
        return \Firebase\JWT\JWT::encode([
            'iat' => $now,
            'exp' => $now + 3600,
            'username' => $this->prefix . 'staff',
            'role' => 'staff',
            'id' => $this->prefix . 'staff',
            'full_name' => 'Synthetic API-101 Staff',
            'email' => $this->prefix . 'staff@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function cleanup()
    {
        for ($index = 1; $index <= 28; $index++) {
            TestSubmissionFixture::delete(
                '10101010-1010-4010-8010-' . str_pad(dechex($index), 12, '0', STR_PAD_LEFT)
            );
        }
    }
}
