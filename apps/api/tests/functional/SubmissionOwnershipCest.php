<?php

/**
 * Verifies that submission ownership and proxy authorization come from the token.
 */
class SubmissionOwnershipCest extends BaseFunctionalCest
{
    private $actorId = 'test-ownership-owner-alpha';
    private $targetId = 'test-ownership-owner-bravo';
    private $actorToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanupSubmissions();
        $this->cleanupPermissions();
        $this->actorToken = $this->mockLogin('ownership-owner-alpha');
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanupSubmissions();
        $this->cleanupPermissions();
    }

    public function submitCompleteIgnoresForgedSubmittedByAndRecordsTokenActor(FunctionalTester $I)
    {
        $this->postComplete($I, $this->actorToken, 'forged', $this->targetId);
        $I->seeResponseCodeIs(200);

        $submission = $this->findSubmission('forged');
        \PHPUnit\Framework\Assert::assertSame($this->actorId, $submission['shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertNull($submission['proxy_shibboleth_user_id']);

        $metadata = $this->findMetadata($submission['submission_id']);
        \PHPUnit\Framework\Assert::assertSame($this->actorId, $metadata['submitted_by_user_id']);
        \PHPUnit\Framework\Assert::assertSame($this->actorId, $metadata['submitted_by_username']);
        \PHPUnit\Framework\Assert::assertSame('T est-ownership-owner-alpha', $metadata['submitted_by_full_name']);
        \PHPUnit\Framework\Assert::assertSame('test-ownership-owner-alpha@smith.edu', $metadata['submitted_by_email']);
        \PHPUnit\Framework\Assert::assertSame('SM', $metadata['submitted_by_institution']);

        $rawPayload = json_decode($metadata['raw_payload'], true);
        \PHPUnit\Framework\Assert::assertSame(
            $this->targetId,
            $rawPayload['metadata']['submittedBy']['username']
        );
    }

    public function submitCompleteRejectsActingForWithoutPermissionBeforeWrites(FunctionalTester $I)
    {
        $this->postComplete($I, $this->actorToken, 'no-permission', $this->actorId, $this->targetId);
        $I->seeResponseCodeIs(403);
        $this->assertNoSubmissionRows($I, 'no-permission');
    }

    public function submitCompleteRejectsViewOnlyWrongCourseAndExpiredPermissions(FunctionalTester $I)
    {
        $cases = [
            [
                'suffix' => 'view-only',
                'proxy' => 'test-ownership-proxy-view-only',
                'permission_type' => \app\models\FacultyProxyPermission::PERMISSION_VIEW_ONLY,
                'expires_at' => null,
                'allowed_course' => null,
            ],
            [
                'suffix' => 'wrong-course',
                'proxy' => 'test-ownership-proxy-wrong-course',
                'permission_type' => \app\models\FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES,
                'expires_at' => null,
                'allowed_course' => 'test-ownership-listing-other',
            ],
            [
                'suffix' => 'expired',
                'proxy' => 'test-ownership-proxy-expired',
                'permission_type' => \app\models\FacultyProxyPermission::PERMISSION_FULL_ACCESS,
                'expires_at' => '2000-01-01 00:00:00',
                'allowed_course' => null,
            ],
        ];

        foreach ($cases as $case) {
            $this->insertPermission(
                $this->targetId,
                $case['proxy'],
                $case['permission_type'],
                $case['expires_at'],
                $case['allowed_course']
            );
            $proxyToken = $this->mockLogin(substr($case['proxy'], strlen('test-')));
            $this->postComplete(
                $I,
                $proxyToken,
                $case['suffix'],
                $this->targetId,
                $this->targetId,
                'test-ownership-listing-current'
            );
            $I->seeResponseCodeIs(403);
            $this->assertNoSubmissionRows($I, $case['suffix']);
            if ($case['suffix'] === 'expired') {
                $permissionStatus = \Yii::$app->db->createCommand(
                    'SELECT status FROM faculty_proxy_permissions '
                    . 'WHERE faculty_shibboleth_id = :owner_id AND proxy_shibboleth_id = :proxy_id',
                    [
                        ':owner_id' => $this->targetId,
                        ':proxy_id' => $case['proxy'],
                    ]
                )->queryScalar();
                \PHPUnit\Framework\Assert::assertSame(
                    \app\models\FacultyProxyPermission::STATUS_ACTIVE,
                    $permissionStatus,
                    'Ownership rejection must not write the expired permission status.'
                );
            }
        }
    }

    public function submitCompleteAllowsCourseLimitedEditorAndRecordsProxy(FunctionalTester $I)
    {
        $proxyId = 'test-ownership-proxy-covered';
        $listingId = 'test-ownership-listing-covered';
        $this->insertPermission(
            $this->targetId,
            $proxyId,
            \app\models\FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES,
            null,
            $listingId
        );

        $this->postComplete(
            $I,
            $this->mockLogin('ownership-proxy-covered'),
            'covered',
            $this->targetId,
            $this->targetId,
            $listingId
        );
        $I->seeResponseCodeIs(200);

        $submission = $this->findSubmission('covered');
        \PHPUnit\Framework\Assert::assertSame($this->targetId, $submission['shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertSame($proxyId, $submission['proxy_shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertSame($listingId, $submission['folio_course_listing_id']);
    }

    public function submitCompleteAllowsNormalActorAsOwner(FunctionalTester $I)
    {
        $this->postComplete($I, $this->actorToken, 'normal', $this->actorId);
        $I->seeResponseCodeIs(200);

        $submission = $this->findSubmission('normal');
        \PHPUnit\Framework\Assert::assertSame($this->actorId, $submission['shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertNull($submission['proxy_shibboleth_user_id']);
    }

    public function updateRejectsOwnerAndCourseIdentityChanges(FunctionalTester $I)
    {
        $uuid = '11111111-1111-4111-8111-111111111111';
        $ownerId = 'sandbox.faculty@example.test';
        $ownerToken = $this->mockLoginAs('S andbox.faculty@example.test', $ownerId);
        $seededSubmission = \Yii::$app->db->createCommand(
            'SELECT submission_id, shibboleth_user_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertNotEmpty($seededSubmission);
        \PHPUnit\Framework\Assert::assertSame($ownerId, $seededSubmission['shibboleth_user_id']);

        $context = stream_context_create([
            'http' => [
                'method' => 'PUT',
                'header' => "Authorization: Bearer " . $ownerToken . "\r\n"
                    . "Content-Type: application/json\r\n",
                'content' => json_encode([
                    'shibboleth_user_id' => $this->targetId,
                    'proxy_shibboleth_user_id' => 'test-ownership-proxy-forged',
                    'proxy_display_name' => 'Forged Proxy',
                    'acting_for_faculty_id' => $this->targetId,
                    'term_code' => 'test-term-ownership-forged',
                    'course_code' => 'test-course-ownership-forged',
                    'section' => 'test-2',
                    'folio_course_listing_id' => 'test-ownership-listing-forged',
                ]),
                'ignore_errors' => true,
            ],
        ]);
        $responseBody = file_get_contents('http://localhost/faculty-submission/' . $uuid, false, $context);
        $responseCode = 0;
        foreach ($http_response_header as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $matches)) {
                $responseCode = (int) $matches[1];
                break;
            }
        }
        \PHPUnit\Framework\Assert::assertSame(400, $responseCode, $responseBody);

        $submission = \Yii::$app->db->createCommand(
            'SELECT shibboleth_user_id, proxy_shibboleth_user_id, term_code, course_code, section, folio_course_listing_id '
            . 'FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertSame($ownerId, $submission['shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertNull($submission['proxy_shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertSame('SANDBOX-2026', $submission['term_code']);
        \PHPUnit\Framework\Assert::assertSame('TST 101', $submission['course_code']);
        \PHPUnit\Framework\Assert::assertSame('01', $submission['section']);
        \PHPUnit\Framework\Assert::assertNull($submission['folio_course_listing_id']);
    }

    public function createUsesTheSharedProxyPermissionChecks(FunctionalTester $I)
    {
        $this->postCreate($I, $this->mockLogin('ownership-proxy-create-denied'), 'create-denied', $this->targetId);
        $I->seeResponseCodeIs(403);
        $this->assertNoSubmissionRows($I, 'create-denied');

        $viewProxyId = 'test-ownership-proxy-create-view';
        $this->insertPermission(
            $this->targetId,
            $viewProxyId,
            \app\models\FacultyProxyPermission::PERMISSION_VIEW_ONLY
        );
        $this->postCreate(
            $I,
            $this->mockLogin('ownership-proxy-create-view'),
            'create-view-only',
            $this->targetId
        );
        $I->seeResponseCodeIs(403);
        $this->assertNoSubmissionRows($I, 'create-view-only');

        $coveredProxyId = 'test-ownership-proxy-create-covered';
        $listingId = 'test-ownership-listing-create-covered';
        $this->insertPermission(
            $this->targetId,
            $coveredProxyId,
            \app\models\FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES,
            null,
            $listingId
        );
        $this->postCreate(
            $I,
            $this->mockLogin('ownership-proxy-create-covered'),
            'create-covered',
            $this->targetId,
            $listingId
        );
        $I->seeResponseCodeIs(200);

        $submission = $this->findSubmission('create-covered');
        \PHPUnit\Framework\Assert::assertSame($this->targetId, $submission['shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertSame($coveredProxyId, $submission['proxy_shibboleth_user_id']);
    }

    private function postComplete(
        FunctionalTester $I,
        $token,
        $suffix,
        $submittedByUsername,
        $actingFor = null,
        $listingId = null
    ) {
        $payload = [
            'courseInfo' => [
                'courseCode' => 'test-course-ownership-' . $suffix,
                'courseTitle' => 'Synthetic ownership ' . $suffix,
                'section' => 'test-1',
                'term' => 'test-term-ownership',
                'instructors' => 'Test Faculty',
            ],
            'resources' => [],
            'folders' => [],
            'metadata' => [
                'submittedBy' => [
                    'id' => $submittedByUsername,
                    'username' => $submittedByUsername,
                    'fullName' => 'Forged Client Name',
                    'email' => 'forged@example.test',
                    'institution' => 'XX',
                ],
            ],
        ];
        if ($actingFor !== null) {
            $payload['acting_for_faculty_id'] = $actingFor;
        }
        if ($listingId !== null) {
            $payload['folio_course_listing_id'] = $listingId;
        }

        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendAjaxRequest(
            'POST',
            \Yii::$app->urlManager->createUrl(['faculty-submission/submit-complete']),
            $payload
        );
    }

    private function postCreate(FunctionalTester $I, $token, $suffix, $actingFor, $listingId = null)
    {
        $payload = [
            'acting_for_faculty_id' => $actingFor,
            'term_code' => 'test-term-ownership',
            'course_code' => 'test-course-ownership-' . $suffix,
            'section' => 'test-1',
            'course_title' => 'Synthetic ownership ' . $suffix,
            'faculty_display_name' => 'Test Owner Bravo',
        ];
        if ($listingId !== null) {
            $payload['folio_course_listing_id'] = $listingId;
        }

        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendAjaxRequest(
            'POST',
            '/index-test.php?r=faculty-submission%2Fcreate',
            $payload
        );
    }

    private function mockLogin($suffix)
    {
        return $this->mockLoginAs('T est-' . $suffix, 'test-' . $suffix);
    }

    private function mockLoginAs($fullName, $expectedId)
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => http_build_query(['full_name' => $fullName]),
                'ignore_errors' => true,
            ],
        ]);
        $body = file_get_contents('http://localhost/faculty-submission/mock-login', false, $context);
        $response = json_decode($body, true);

        if (!is_array($response) || empty($response['token']) || $response['user']['username'] !== $expectedId) {
            throw new \RuntimeException('Mock login did not return the expected synthetic token identity: ' . $body);
        }

        $claims = (array) \Firebase\JWT\JWT::decode(
            $response['token'],
            new \Firebase\JWT\Key(getenv('JWT_SECRET_KEY'), 'HS256')
        );
        \PHPUnit\Framework\Assert::assertSame($expectedId, $claims['username']);

        return $response['token'];
    }

    private function insertPermission($ownerId, $proxyId, $permissionType, $expiresAt = null, $allowedCourse = null)
    {
        \Yii::$app->db->createCommand()->insert('faculty_proxy_permissions', [
            'faculty_shibboleth_id' => $ownerId,
            'proxy_shibboleth_id' => $proxyId,
            'faculty_display_name' => 'Test Owner Bravo',
            'proxy_display_name' => 'Test Proxy',
            'permission_type' => $permissionType,
            'status' => \app\models\FacultyProxyPermission::STATUS_ACTIVE,
            'expires_at' => $expiresAt,
        ])->execute();
        $permissionId = (int) \Yii::$app->db->getLastInsertID();

        if ($allowedCourse !== null) {
            \Yii::$app->db->createCommand()->insert('faculty_proxy_course_permissions', [
                'permission_id' => $permissionId,
                'folio_course_listing_id' => $allowedCourse,
                'course_title' => 'Synthetic test course',
            ])->execute();
        }
    }

    private function findSubmission($suffix)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM faculty_submissions WHERE course_code = :course_code AND term_code = :term_code',
            [
                ':course_code' => 'test-course-ownership-' . $suffix,
                ':term_code' => 'test-term-ownership',
            ]
        )->queryOne();
    }

    private function findMetadata($submissionId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_metadata WHERE submission_id = :submission_id',
            [':submission_id' => $submissionId]
        )->queryOne();
    }

    private function assertNoSubmissionRows(FunctionalTester $I, $suffix)
    {
        $params = [
            ':course_code' => 'test-course-ownership-' . $suffix,
            ':term_code' => 'test-term-ownership',
            ':section' => 'test-1',
        ];
        $submissionCount = (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM faculty_submissions WHERE course_code = :course_code AND term_code = :term_code AND section = :section',
            $params
        )->queryScalar();
        \PHPUnit\Framework\Assert::assertSame(0, $submissionCount, 'Rejected request wrote a faculty submission.');

        foreach ([
            'submission_new_resources',
            'submission_reuse_resources',
            'submission_folders',
            'submission_metadata',
        ] as $table) {
            $count = (int) \Yii::$app->db->createCommand(
                'SELECT COUNT(*) FROM ' . $table . ' child '
                . 'INNER JOIN faculty_submissions parent ON parent.submission_id = child.submission_id '
                . 'WHERE parent.course_code = :course_code AND parent.term_code = :term_code AND parent.section = :section',
                $params
            )->queryScalar();
            \PHPUnit\Framework\Assert::assertSame(0, $count, 'Rejected request wrote rows to ' . $table . '.');
        }
    }

    private function cleanupSubmissions()
    {
        $submissionIds = \Yii::$app->db->createCommand(
            "SELECT submission_id FROM faculty_submissions WHERE course_code LIKE 'test-course-ownership-%'"
        )->queryColumn();
        if (!$submissionIds) {
            return;
        }

        foreach ([
            'submission_metadata',
            'submission_new_resources',
            'submission_reuse_resources',
            'submission_folders',
        ] as $table) {
            \Yii::$app->db->createCommand()->delete($table, ['submission_id' => $submissionIds])->execute();
        }
        \Yii::$app->db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
    }

    private function cleanupPermissions()
    {
        \Yii::$app->db->createCommand()->delete(
            'faculty_proxy_activity_log',
            [
                'and',
                ['faculty_shibboleth_id' => $this->targetId],
                ['like', 'proxy_shibboleth_id', 'test-ownership-proxy-%'],
            ]
        )->execute();
        $permissionIds = \Yii::$app->db->createCommand(
            "SELECT permission_id FROM faculty_proxy_permissions "
            . "WHERE faculty_shibboleth_id = 'test-ownership-owner-bravo' "
            . "AND proxy_shibboleth_id LIKE 'test-ownership-proxy-%'"
        )->queryColumn();
        if (!$permissionIds) {
            return;
        }

        \Yii::$app->db->createCommand()->delete(
            'faculty_proxy_course_permissions',
            ['permission_id' => $permissionIds]
        )->execute();
        \Yii::$app->db->createCommand()->delete('faculty_proxy_permissions', ['permission_id' => $permissionIds])->execute();
    }
}
