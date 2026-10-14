<?php

/**
 * Communication visibility regressions using the synthetic workflow submission.
 */
class FacultyCommunicationsCest extends BaseFunctionalCest
{
    private $submissionUuid = '11111111-1111-4111-8111-111111111111';
    private $otherSubmissionUuid = '33333333-3333-4333-8333-333333333333';
    private $submissionId;
    private $facultyToken;
    private $staffToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->submissionId = \Yii::$app->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $this->submissionUuid]
        )->queryScalar();

        $secretKey = getenv('JWT_SECRET_KEY');
        $issuedAt = time();
        $this->facultyToken = \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => 'sandbox.faculty@example.test',
            'role' => 'faculty',
            'id' => 0,
            'full_name' => 'Test Faculty',
            'email' => 'sandbox.faculty@example.test',
            'institution' => 'SM',
        ], $secretKey, 'HS256');
        $this->staffToken = \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => 'test-api030-staff',
            'role' => 'staff',
            'id' => 'test-api030-staff',
            'full_name' => 'Test Staff',
            'email' => 'test-api030-staff@example.test',
        ], $secretKey, 'HS256');
    }

    public function _after(FunctionalTester $I)
    {
        \Yii::$app->db->createCommand()->delete(
            'submission_communications',
            'message LIKE :prefix',
            [':prefix' => 'test-api030-%']
        )->execute();
        \Yii::$app->db->createCommand()->delete('faculty_submissions', [
            'submission_uuid' => $this->otherSubmissionUuid,
        ])->execute();
    }

    public function facultyDetailDoesNotSerializeStaffOnlyMessages(FunctionalTester $I)
    {
        $this->insertCommunication(
            'test-api030-private-detail',
            'all_staff'
        );
        $this->insertCommunication(
            'test-api030-public-detail',
            'faculty_visible'
        );

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->facultyToken);
        $I->amOnRoute('faculty-submission/view', ['id' => $this->submissionUuid]);
        $I->seeResponseCodeIs(200);

        $response = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertSame(JSON_ERROR_NONE, json_last_error());
        $messages = array_column($response['communications'], 'message');
        \PHPUnit\Framework\Assert::assertContains('test-api030-public-detail', $messages);
        \PHPUnit\Framework\Assert::assertNotContains('test-api030-private-detail', $messages);

        $I->amOnRoute('faculty-submission/index');
        $I->seeResponseCodeIs(200);
        $submissions = json_decode($I->grabPageSource(), true);
        $fixture = null;
        foreach ($submissions['items'] as $submission) {
            if ((int)$submission['submission_id'] === (int)$this->submissionId) {
                $fixture = $submission;
                break;
            }
        }
        \PHPUnit\Framework\Assert::assertNotNull($fixture);
        $messages = array_column($fixture['communications'], 'message');
        \PHPUnit\Framework\Assert::assertContains('test-api030-public-detail', $messages);
        \PHPUnit\Framework\Assert::assertNotContains('test-api030-private-detail', $messages);
    }

    public function facultyListFiltersRootsAndReplies(FunctionalTester $I)
    {
        $facultyRootId = $this->insertCommunication('test-api030-root-faculty', 'faculty_visible');
        $this->insertCommunication('test-api030-reply-faculty', 'faculty_visible', $facultyRootId);
        $this->insertCommunication('test-api030-reply-private', 'staff_only', $facultyRootId);
        $this->insertCommunication('test-api030-root-all-staff', 'all_staff');
        $this->insertCommunication('test-api030-root-staff-only', 'staff_only');
        $this->insertCommunication('test-api030-root-assigned', 'assigned_only');

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->facultyToken);
        $I->amOnRoute('faculty-submission/communications', ['id' => $this->submissionUuid]);
        $I->seeResponseCodeIs(200);
        $response = json_decode($I->grabPageSource(), true);
        $this->assertFacultyThreadOnlyContainsVisibleMessages($response['messages']);
    }

    public function facultyUpdateResponseFiltersCommunications(FunctionalTester $I)
    {
        $this->insertCommunication('test-api030-update-public', 'faculty_visible');
        $this->insertCommunication('test-api030-update-private', 'all_staff');

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->facultyToken);
        $this->sendRequest($I, 'PUT', 'faculty-submission/update', [
            'id' => $this->submissionUuid,
        ], [
            'submission_notes' => 'test-api030 safe update',
        ]);
        $I->seeResponseCodeIs(200);
        $response = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertNotFalse($response);
        \PHPUnit\Framework\Assert::assertStringNotContainsString(
            'test-api030-update-private',
            $I->grabPageSource()
        );
    }

    public function staffListAndDetailPreserveAllVisibilityLevels(FunctionalTester $I)
    {
        $facultyRootId = $this->insertCommunication('test-api030-staff-root-faculty', 'faculty_visible');
        $this->insertCommunication('test-api030-staff-reply-private', 'staff_only', $facultyRootId);
        $this->insertCommunication('test-api030-staff-root-all', 'all_staff');
        $this->insertCommunication('test-api030-staff-root-private', 'staff_only');
        $this->insertCommunication('test-api030-staff-root-assigned', 'assigned_only');

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->staffToken);
        $I->amOnRoute('submission-workflow/communications', ['id' => $this->submissionId]);
        $I->seeResponseCodeIs(200);
        $list = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertCount(4, $list['messages']);
        $rootMessages = array_column($list['messages'], 'message');
        \PHPUnit\Framework\Assert::assertContains('test-api030-staff-root-faculty', $rootMessages);
        \PHPUnit\Framework\Assert::assertContains('test-api030-staff-root-all', $rootMessages);
        \PHPUnit\Framework\Assert::assertContains('test-api030-staff-root-private', $rootMessages);
        \PHPUnit\Framework\Assert::assertContains('test-api030-staff-root-assigned', $rootMessages);
        foreach ($list['messages'] as $thread) {
            if ($thread['message'] === 'test-api030-staff-root-faculty') {
                \PHPUnit\Framework\Assert::assertSame(
                    ['test-api030-staff-reply-private'],
                    array_column($thread['replies'], 'message')
                );
            }
        }

        $I->amOnRoute('submission-workflow/view-submission', ['id' => $this->submissionId]);
        $I->seeResponseCodeIs(200);
        $detail = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertCount(5, $detail['communications']);

        $I->amOnRoute('submission-workflow/pending-submissions');
        $I->seeResponseCodeIs(200);
        $pending = json_decode($I->grabPageSource(), true);
        $fixture = null;
        foreach ($pending as $submission) {
            if ((int)$submission['submission_id'] === (int)$this->submissionId) {
                $fixture = $submission;
                break;
            }
        }
        \PHPUnit\Framework\Assert::assertNotNull($fixture, $I->grabPageSource());
        \PHPUnit\Framework\Assert::assertCount(5, $fixture['communications']);
    }

    public function facultyCannotReadEditOrDeleteHiddenMessage(FunctionalTester $I)
    {
        $messageId = $this->insertCommunication('test-api030-hidden-action', 'all_staff');
        $publicMessageId = $this->insertCommunication('test-api030-public-read', 'faculty_visible');
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->facultyToken);
        $this->sendRequest($I, 'POST', 'faculty-submission/mark-communication-read', [
            'id' => $this->submissionUuid,
            'messageId' => $publicMessageId,
        ]);
        $I->seeResponseCodeIs(200);

        $this->sendRequest($I, 'POST', 'faculty-submission/mark-communication-read', [
            'id' => $this->submissionUuid,
            'messageId' => $messageId,
        ]);
        $I->seeResponseCodeIs(404);

        $this->sendRequest($I, 'PUT', 'faculty-submission/update-communication', [
            'id' => $this->submissionUuid,
            'messageId' => $messageId,
        ], ['message' => 'test-api030 attempt edit']);
        $I->seeResponseCodeIs(404);

        $this->sendRequest($I, 'DELETE', 'faculty-submission/delete-communication', [
            'id' => $this->submissionUuid,
            'messageId' => $messageId,
        ]);
        $I->seeResponseCodeIs(404);
    }

    public function staffCreationDefaultsToStaffOnlyAndRepliesInherit(FunctionalTester $I)
    {
        $parentId = $this->insertCommunication('test-api030-assigned-parent', 'assigned_only');
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->staffToken);

        $this->sendRequest($I, 'POST', 'submission-workflow/create-communication', [
            'id' => $this->submissionId,
        ], [
            'message' => 'test-api030-default-root',
        ]);
        $I->seeResponseCodeIs(200);
        $createResponse = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertSame(
            'test-api030-default-root',
            $createResponse['communication']['message'] ?? null,
            json_encode($createResponse)
        );
        $defaultRow = $this->communicationByMessage('test-api030-default-root');
        \PHPUnit\Framework\Assert::assertSame('staff_only', $defaultRow['visibility']);

        $this->sendRequest($I, 'POST', 'submission-workflow/create-communication', [
            'id' => $this->submissionId,
        ], [
            'message' => 'test-api030-inherited-reply',
            'parent_message_id' => $parentId,
        ]);
        $I->seeResponseCodeIs(200);
        $replyRow = $this->communicationByMessage('test-api030-inherited-reply');
        \PHPUnit\Framework\Assert::assertSame('assigned_only', $replyRow['visibility']);
    }

    private function insertCommunication($message, $visibility, $parentMessageId = null, $submissionId = null)
    {
        \Yii::$app->db->createCommand()->insert('submission_communications', [
            'submission_id' => $submissionId === null ? $this->submissionId : $submissionId,
            'parent_message_id' => $parentMessageId,
            'communication_type' => 'staff_to_staff',
            'visibility' => $visibility,
            'message' => $message,
            'sender_type' => 'staff',
            'sender_id' => 'test-api030-staff',
            'sender_name' => 'Test Staff',
        ])->execute();
        return (int) \Yii::$app->db->getLastInsertID();
    }

    private function communicationByMessage($message)
    {
        return \Yii::$app->db->createCommand(
            'SELECT visibility FROM submission_communications WHERE message = :message',
            [':message' => $message]
        )->queryOne();
    }

    private function sendRequest(FunctionalTester $I, $method, $route, array $routeParams = [], array $payload = [])
    {
        $url = \Yii::$app->urlManager->createUrl(array_merge([$route], $routeParams));
        $I->sendAjaxRequest($method, $url, $payload);
    }

    private function assertFacultyThreadOnlyContainsVisibleMessages(array $messages)
    {
        \PHPUnit\Framework\Assert::assertCount(1, $messages);
        \PHPUnit\Framework\Assert::assertSame('test-api030-root-faculty', $messages[0]['message']);
        \PHPUnit\Framework\Assert::assertSame(1, $messages[0]['reply_count']);
        \PHPUnit\Framework\Assert::assertSame(
            ['test-api030-reply-faculty'],
            array_column($messages[0]['replies'], 'message')
        );
    }
}
