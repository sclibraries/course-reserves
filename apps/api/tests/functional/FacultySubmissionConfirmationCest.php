<?php

use PHPUnit\Framework\Assert;

class FacultySubmissionConfirmationCest extends BaseFunctionalCest
{
    private $facultyId = 'test-api032-confirmation-faculty';
    private $smithId = '999000132';

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        \Yii::$container->set(
            \app\services\FolioService::class,
            new TestFacultySubmissionConfirmationFolioStub()
        );
        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => $this->smithId,
        ])->execute();
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => 'AP_209909',
            'course_id' => 'TST-032-01-209909',
            'course_title' => 'Synthetic API-032 roster course',
            'smith_id' => $this->smithId,
            'role' => 'Instructor',
        ])->execute();
        $this->removeTestSubmissions();
    }

    public function _after(FunctionalTester $I)
    {
        $this->removeTestSubmissions();
        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => $this->smithId,
        ])->execute();
        \Yii::$container->clear(\app\services\FolioService::class);
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
            'internal_id' => $this->smithId,
        ];
        $token = \Firebase\JWT\JWT::encode($payload, getenv('JWT_SECRET_KEY'), 'HS256');

        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonPost('faculty-submission/submit-complete', [
            'courseInfo' => [
                'courseCode' => 'TST 032',
                'courseTitle' => 'Confirmation State Test',
                'section' => '01',
                'term' => 'Fall 2099',
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

class TestFacultySubmissionConfirmationFolioStub
{
    public function searchTerms()
    {
        return [
            [
                'id' => 'test-api032-fall-2099',
                'name' => 'Fall 2099',
                'startDate' => '2099-08-01',
                'endDate' => '2099-12-31',
            ],
        ];
    }

    public function searchCourses($query)
    {
        return null;
    }
}
