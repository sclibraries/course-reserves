<?php

use PHPUnit\Framework\Assert;

class FacultySubmissionConfirmationCest extends BaseFunctionalCest
{
    private $facultyId = 'test-api032-confirmation-faculty';

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->removeTestSubmissions();
    }

    public function _after(FunctionalTester $I)
    {
        $this->removeTestSubmissions();
    }

    public function requestedConfirmationIsReturnedAsPending(FunctionalTester $I)
    {
        $response = $this->submit($I, 'API032-REQ', true);

        Assert::assertSame('requested', $response['submission']['email_confirmation_status']);
        Assert::assertSame(0, (int) $response['submission']['email_confirmation_sent']);
        Assert::assertNotEmpty($response['submission']['email_confirmation_requested_at']);
        Assert::assertNull($response['submission']['email_confirmation_sent_at']);
    }

    public function unrequestedConfirmationIsReturnedAsNotRequested(FunctionalTester $I)
    {
        $response = $this->submit($I, 'API032-NO', false);

        Assert::assertSame('not_requested', $response['submission']['email_confirmation_status']);
        Assert::assertSame(0, (int) $response['submission']['email_confirmation_sent']);
        Assert::assertNull($response['submission']['email_confirmation_requested_at']);
    }

    private function submit(FunctionalTester $I, $courseCode, $requested)
    {
        $issuedAt = time();
        $payload = [
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => $this->facultyId,
            'role' => 'faculty',
            'id' => 0,
            'full_name' => 'Test Faculty',
            'email' => $this->facultyId . '@example.test',
            'institution' => 'SM',
        ];
        $token = \Firebase\JWT\JWT::encode($payload, getenv('JWT_SECRET_KEY'), 'HS256');

        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonPost('faculty-submission/submit-complete', [
            'courseInfo' => [
                'courseCode' => $courseCode,
                'courseTitle' => 'Confirmation State Test',
                'section' => '01',
                'term' => '2026FA',
                'instructors' => 'Test Faculty',
            ],
            'resources' => [],
            'folders' => [],
            'displayOrder' => [],
            'metadata' => [
                'emailConfirmation' => $requested,
            ],
        ]);
        $I->seeResponseCodeIs(200);

        $response = $I->grabJsonResponse();
        Assert::assertIsArray($response);
        Assert::assertArrayHasKey('submission', $response);
        Assert::assertArrayHasKey('email_confirmation_status', $response['submission']);

        return $response;
    }

    private function removeTestSubmissions()
    {
        \Yii::$app->db->createCommand()
            ->delete('faculty_submissions', ['shibboleth_user_id' => $this->facultyId])
            ->execute();
    }
}
