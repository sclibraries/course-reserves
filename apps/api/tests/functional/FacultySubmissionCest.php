<?php
/**
 * FacultySubmissionCest.php — Smoke tests for faculty submission CRUD.
 *
 * Uses a test-owned submission and a manually-crafted faculty JWT so that
 * FacultySubmissionController authenticates the requests.
 *
 * The submission belongs to the API-078 synthetic faculty A and has status
 * 'submitted' (editable).
 *
 * Note: FacultySubmissionController extends BaseRestController which uses
 * HttpBearerAuth. Missing or invalid tokens cause HttpBearerAuth to throw
 * UnauthorizedHttpException (HTTP 401), not ForbiddenHttpException (403).
 *
 * PHP 7.2 compatible — no typed properties, no arrow functions, no ??=.
 */
class FacultySubmissionCest extends BaseFunctionalCest
{
    /** UUID of the test-owned 'submitted' record. */
    private $uuid = '77000000-0000-4000-8000-000000000023';

    /** Shibboleth user ID that owns the above submission. */
    private $shibbolethId = 'test-api078-faculty-a';

    /** Faculty JWT minted in _before() and shared across tests. */
    private $token;
    private $staffToken;
    private $submissionId;
    private $otherSubmissionUuid = '33333333-3333-4333-8333-333333333333';
    private $rosterSmithId = '999078001';
    private $rosterCourseId = 'TST-API030-99-209902';

    /**
     * Delegate DB/URL setup to the base class, then mint a faculty JWT
     * for the submission owner so FacultySubmissionController accepts the token.
     */
    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        \Yii::$container->set(
            \app\services\FolioService::class,
            new TestFacultySubmissionFolioStub()
        );
        TestSubmissionFixture::create($this->uuid, $this->shibbolethId);
        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => $this->rosterSmithId,
            'course_id' => $this->rosterCourseId,
        ])->execute();
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => 'AP_209902',
            'course_id' => $this->rosterCourseId,
            'course_title' => 'Synthetic API-030 roster course',
            'smith_id' => $this->rosterSmithId,
            'role' => 'Instructor',
        ])->execute();
        $this->submissionId = (int)\Yii::$app->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $this->uuid]
        )->queryScalar();

        $secretKey = getenv('JWT_SECRET_KEY');
        $issuedAt  = time();
        $payload   = [
            'iat'         => $issuedAt,
            'exp'         => $issuedAt + 3600,
            'username'    => $this->shibbolethId,
            'role'        => 'faculty',
            'id'          => 0,
            'full_name'   => 'Test Faculty',
            'email'       => $this->shibbolethId,
            'institution' => 'SM',
            'internal_id' => $this->rosterSmithId,
        ];
        $this->token = \Firebase\JWT\JWT::encode($payload, $secretKey, 'HS256');
        $staffPayload = [
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => 'test-api030-staff',
            'role' => 'staff',
            'id' => 'test-api030-staff',
            'full_name' => 'Test Staff',
            'email' => 'test-api030-staff@example.test',
        ];
        $this->staffToken = \Firebase\JWT\JWT::encode($staffPayload, $secretKey, 'HS256');
    }

    public function _after(FunctionalTester $I)
    {
        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => $this->rosterSmithId,
            'course_id' => $this->rosterCourseId,
        ])->execute();
        \Yii::$container->clear(\app\services\FolioService::class);
        \Yii::$app->db->createCommand()->delete(
            'submission_communications',
            'message LIKE :prefix',
            [':prefix' => 'test-api030-%']
        )->execute();
        \Yii::$app->db->createCommand()->delete('faculty_submissions', [
            'submission_uuid' => $this->otherSubmissionUuid,
        ])->execute();
        TestSubmissionFixture::delete($this->uuid);
        \Yii::$app->db->createCommand()->delete('faculty_submissions', [
            'shibboleth_user_id' => $this->shibbolethId,
            'its_course_id' => 'TST-API030-99-209902',
            'academic_period' => 'AP_209902',
        ])->execute();
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    /**
     * GET /faculty-submission/{uuid} with a valid faculty token returns 200.
     */
    public function getWithValidTokenReturns200(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->amOnRoute('faculty-submission/view', ['id' => $this->uuid]);
        $I->seeResponseCodeIs(200);
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

    /**
     * PUT /faculty-submission/{uuid} with a valid payload returns 200.
     *
     * Updates submission_notes — a safe, non-critical field — to verify the
     * write path works end-to-end.  The submission has status 'submitted'
     * which FacultySubmission::canEdit() permits.
     */
    public function putWithValidPayloadReturns200(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendAjaxRequest(
            'PUT',
            '/faculty-submission/' . $this->uuid,
            ['submission_notes' => 'smoke-test update — safe to ignore']
        );
        $I->seeResponseCodeIs(200);
    }

    // ── Test 3 ────────────────────────────────────────────────────────────────

    /**
     * GET /faculty-submission/{uuid} without a token returns 401.
     *
     * HttpBearerAuth (inherited from BaseRestController) throws
     * UnauthorizedHttpException (HTTP 401) when no Authorization header is present.
     */
    public function getWithoutTokenReturns401(FunctionalTester $I)
    {
        $I->amOnRoute('faculty-submission/view', ['id' => $this->uuid]);
        $I->seeResponseCodeIs(401);
    }

    public function submitCompleteResponseUsesFilteredSubmissionSerialization(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $url = \Yii::$app->urlManager->createUrl(['faculty-submission/submit-complete']);
        $I->sendAjaxRequest('POST', $url, [
            'its_course_id' => 'TST-API030-99-209902',
            'academic_period' => 'AP_209902',
            'courseInfo' => [
                'courseCode' => 'TST API030',
                'courseTitle' => 'Synthetic API-030 serialization',
                'term' => 'Spring 2099',
                'section' => '99',
                'instructors' => 'Test Faculty',
            ],
            'resources' => [],
            'folders' => [],
            'metadata' => [
                'submittedBy' => [
                    'username' => $this->shibbolethId,
                    'fullName' => 'Test Faculty',
                ],
            ],
        ]);
        $I->seeResponseCodeIs(200);
        $response = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertArrayHasKey('submission', $response, $I->grabPageSource());
        \PHPUnit\Framework\Assert::assertArrayHasKey('communications', $response['submission']);
        \PHPUnit\Framework\Assert::assertSame([], $response['submission']['communications']);
    }

    public function facultyAndStaffWritersRejectInvalidOrCrossSubmissionResourceAndParentIds(FunctionalTester $I)
    {
        $otherSubmissionId = $this->insertOtherSubmission();
        $otherResourceId = $this->insertResource($otherSubmissionId);
        $otherParentId = $this->insertCommunication('test-api030-other-parent', 'faculty_visible', null, $otherSubmissionId);
        $invalidResourceId = $otherResourceId + 1000;
        $invalidParentId = $otherParentId + 1000;

        foreach (['faculty', 'staff'] as $audience) {
            $this->assertCreateRequest($I, $audience, [
                'message' => 'test-api030-invalid-' . $audience . '-resource',
                'resource_id' => $invalidResourceId,
            ], 400);
            $this->assertCreateRequest($I, $audience, [
                'message' => 'test-api030-cross-' . $audience . '-resource',
                'resource_id' => $otherResourceId,
            ], 400);
            $this->assertCreateRequest($I, $audience, [
                'message' => 'test-api030-cross-' . $audience . '-parent',
                'parent_message_id' => $otherParentId,
            ], 400);
            $this->assertCreateRequest($I, $audience, [
                'message' => 'test-api030-invalid-' . $audience . '-parent',
                'parent_message_id' => $invalidParentId,
            ], 400);
        }
    }

    public function bothWritersCanReferenceTheirOwnSubmissionResourcesAndParents(FunctionalTester $I)
    {
        $resourceId = (int) \Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id LIMIT 1',
            [':id' => $this->submissionId]
        )->queryScalar();
        $facultyParentId = $this->insertCommunication('test-api030-own-faculty-parent', 'faculty_visible');
        $staffParentId = $this->insertCommunication('test-api030-own-staff-parent', 'staff_only');

        $this->assertCreateRequest($I, 'faculty', [
            'message' => 'test-api030-valid-faculty-reply',
            'resource_id' => $resourceId,
            'parent_message_id' => $facultyParentId,
        ], 200);
        $this->assertCreateRequest($I, 'staff', [
            'message' => 'test-api030-valid-staff-reply',
            'resource_id' => $resourceId,
            'parent_message_id' => $staffParentId,
            'visibility' => 'staff_only',
        ], 200);
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

    private function insertOtherSubmission()
    {
        \Yii::$app->db->createCommand()->insert('faculty_submissions', [
            'submission_uuid' => $this->otherSubmissionUuid,
            'shibboleth_user_id' => 'test-api030-other-faculty',
            'term_code' => '209902',
            'course_code' => 'TST 902',
            'section' => '02',
            'course_title' => 'Synthetic Other Course',
            'status' => 'draft',
            'faculty_display_name' => 'Test Faculty',
        ])->execute();
        return (int) \Yii::$app->db->getLastInsertID();
    }

    private function insertResource($submissionId)
    {
        \Yii::$app->db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submissionId,
            'resource_data' => json_encode(['title' => 'Synthetic resource']),
            'item_status' => 'pending',
        ])->execute();
        return (int) \Yii::$app->db->getLastInsertID();
    }

    private function assertCreateRequest(FunctionalTester $I, $audience, array $payload, $expectedStatus)
    {
        $faculty = $audience === 'faculty';
        $route = $faculty ? 'faculty-submission/create-communication' : 'submission-workflow/create-communication';
        $id = $faculty ? $this->uuid : $this->submissionId;
        $token = $faculty ? $this->token : $this->staffToken;
        $url = \Yii::$app->urlManager->createUrl([$route, 'id' => $id]);
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendAjaxRequest('POST', $url, $payload);
        $I->seeResponseCodeIs($expectedStatus);
    }
}

class TestFacultySubmissionFolioStub
{
    public function searchTerms()
    {
        return [
            [
                'id' => 'test-api030-spring-2099',
                'name' => 'Spring 2099',
                'startDate' => '2099-01-01',
                'endDate' => '2099-05-31',
            ],
        ];
    }

    public function searchCourses($query)
    {
        return null;
    }
}
