<?php

/**
 * Verifies that submission ownership and proxy authorization come from the token.
 */
class SubmissionOwnershipCest extends BaseFunctionalCest
{
    private $actorId = 'test-ownership-owner-alpha';
    private $targetId = 'test-ownership-owner-bravo';
    private $actorSmithId = '999000101';
    private $targetSmithId = '999000106';
    private $coInstructorSmithId = '999000103';
    private $actorToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanupSubmissions();
        $this->cleanupPermissions();
        $this->cleanupAssignments();
        \Yii::$container->set(
            \app\services\FolioService::class,
            new TestSubmissionOwnershipFolioStub()
        );
        $this->insertRosterAssignment($this->actorSmithId, 'TST-155-01-209909', 'AP_209909');
        $this->insertRosterAssignment($this->targetSmithId, 'TST-155-01-209909', 'AP_209909');
        $this->actorToken = $this->mockLogin('ownership-owner-alpha', $this->actorSmithId);
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanupSubmissions();
        $this->cleanupPermissions();
        $this->cleanupAssignments();
        \Yii::$container->clear(\app\services\FolioService::class);
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
        \PHPUnit\Framework\Assert::assertSame($this->actorId . '@example.test', $metadata['submitted_by_email']);
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

    public function submitCompleteRejectsUnrosteredFacultyBeforeAnyWrite(FunctionalTester $I)
    {
        $token = $this->mockLoginAs('T est-unrostered-api056', 'test-unrostered-api056', '999000102');

        $this->postComplete($I, $token, 'unrostered-complete', 'test-unrostered-api056');
        $I->seeResponseCodeIs(403);
        $rosterError = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertSame('roster_course_not_found', $rosterError['error_code'] ?? null);
        $this->assertNoSubmissionRows($I, 'unrostered-complete');

        $this->postCreate($I, $token, 'unrostered-create', null);
        $I->seeResponseCodeIs(403);
        \PHPUnit\Framework\Assert::assertStringContainsString(
            'course not found on your teaching roster; contact library staff',
            $I->grabPageSource()
        );
        $this->assertNoSubmissionRows($I, 'unrostered-create');
    }

    public function rosteredCoInstructorCanOpenAndEditSharedSubmission(FunctionalTester $I)
    {
        $this->postComplete($I, $this->actorToken, 'co-instructor-seed', $this->actorId);
        $I->seeResponseCodeIs(200);
        $submission = $this->findSubmission('co-instructor-seed');
        $uuid = $submission['submission_uuid'];

        $this->insertRosterAssignment($this->coInstructorSmithId, 'TST-155-01-209909', 'AP_209909');
        $coInstructorToken = $this->mockLoginAs(
            'T est-co-instructor-api056',
            'test-co-instructor-api056',
            $this->coInstructorSmithId
        );
        $I->haveHttpHeader('Authorization', 'Bearer ' . $coInstructorToken);
        $I->amOnRoute('faculty-submission/view', ['id' => $uuid]);
        $I->seeResponseCodeIs(200);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', [
            'submission_notes' => 'test-co-instructor-edit',
        ], ['id' => $uuid]);
        $I->seeResponseCodeIs(200);
        $this->assertSubmissionNotes($submission['submission_id'], 'test-co-instructor-edit');

        $unrosteredToken = $this->mockLoginAs(
            'T est-not-rostered-api056',
            'test-not-rostered-api056',
            '999000104'
        );
        $I->haveHttpHeader('Authorization', 'Bearer ' . $unrosteredToken);
        $I->amOnRoute('faculty-submission/view', ['id' => $uuid]);
        $I->seeResponseCodeIs(403);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', [
            'submission_notes' => 'test-forbidden-edit',
        ], ['id' => $uuid]);
        $I->seeResponseCodeIs(403);
        $this->assertSubmissionNotes($submission['submission_id'], 'test-co-instructor-edit');
    }

    public function crossListedPartnerCourseDoesNotMatchTheRosteredCode(FunctionalTester $I)
    {
        $this->insertRosterAssignment('999000105', 'AFR-155-01-209909', 'AP_209909');
        $token = $this->mockLoginAs(
            'T est-crosslisted-api056',
            'test-crosslisted-api056',
            '999000105'
        );

        $this->postComplete($I, $token, 'crosslisted-partner', 'test-crosslisted-api056');
        $I->seeResponseCodeIs(403);
        $rosterError = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertSame('roster_course_not_found', $rosterError['error_code'] ?? null);
        $this->assertNoSubmissionRows($I, 'crosslisted-partner');
    }

    public function staffCanActForAnyFacultyAndOpenAndEditAnySubmission(FunctionalTester $I)
    {
        $staffId = 'test-ownership-staff-api056';
        $staffToken = $this->mockLoginAs('T est-ownership-staff-api056', $staffId, null, 'staff');
        $this->postComplete($I, $staffToken, 'staff-create', $this->targetId, $this->targetId);
        $I->seeResponseCodeIs(200);

        $submission = $this->findSubmission('staff-create');
        \PHPUnit\Framework\Assert::assertSame($this->targetId, $submission['shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertSame($staffId, $submission['proxy_shibboleth_user_id']);

        $this->postComplete($I, $this->actorToken, 'staff-open-seed', $this->actorId);
        $I->seeResponseCodeIs(200);
        $ownedSubmission = $this->findSubmission('staff-open-seed');
        $I->haveHttpHeader('Authorization', 'Bearer ' . $staffToken);
        $I->amOnRoute('faculty-submission/view', ['id' => $ownedSubmission['submission_uuid']]);
        $I->seeResponseCodeIs(200);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', [
            'submission_notes' => 'test-staff-edited-any-submission',
        ], ['id' => $ownedSubmission['submission_uuid']]);
        $I->seeResponseCodeIs(200);
        $this->assertSubmissionNotes(
            $ownedSubmission['submission_id'],
            'test-staff-edited-any-submission'
        );
    }

    public function updateRejectsOwnerAndCourseIdentityChanges(FunctionalTester $I)
    {
        $uuid = '77000000-0000-4000-8000-000000000023';
        $ownerId = TestSubmissionFixture::FACULTY_A_ID;
        $ownerToken = $this->mockLoginAs('T est-api078-faculty-a', $ownerId);
        TestSubmissionFixture::create($uuid, $ownerId, [
            'course_title' => 'test-ownership-seeded-submission',
        ]);
        $seededSubmission = \Yii::$app->db->createCommand(
            'SELECT submission_id, shibboleth_user_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertNotEmpty($seededSubmission);
        \PHPUnit\Framework\Assert::assertSame($ownerId, $seededSubmission['shibboleth_user_id']);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $ownerToken);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', [
            'shibboleth_user_id' => $this->targetId,
            'proxy_shibboleth_user_id' => 'test-ownership-proxy-forged',
            'proxy_display_name' => 'Forged Proxy',
            'acting_for_faculty_id' => $this->targetId,
            'term_code' => 'test-term-ownership-forged',
            'course_code' => 'test-course-ownership-forged',
            'section' => 'test-2',
            'folio_course_listing_id' => 'test-ownership-listing-forged',
        ], ['id' => $uuid]);
        $I->seeResponseCodeIs(400);

        $submission = \Yii::$app->db->createCommand(
            'SELECT shibboleth_user_id, proxy_shibboleth_user_id, term_code, course_code, section, folio_course_listing_id '
            . 'FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertSame($ownerId, $submission['shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertNull($submission['proxy_shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertSame('Spring 2027', $submission['term_code']);
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

    public function employeeWithActivePermissionCanActForFaculty(FunctionalTester $I)
    {
        $proxyId = 'test-ownership-employee-proxy';
        $this->insertPermission(
            $this->targetId,
            $proxyId,
            \app\models\FacultyProxyPermission::PERMISSION_FULL_ACCESS
        );

        $this->postCreate($I, $this->signedToken($proxyId, 'employee'), 'employee-proxy', $this->targetId);
        $I->seeResponseCodeIs(200);

        $submission = $this->findSubmission('employee-proxy');
        \PHPUnit\Framework\Assert::assertSame($this->targetId, $submission['shibboleth_user_id']);
        \PHPUnit\Framework\Assert::assertSame($proxyId, $submission['proxy_shibboleth_user_id']);
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
            'its_course_id' => 'TST-155-01-209909',
            'academic_period' => 'AP_209909',
            'courseInfo' => [
                'courseCode' => 'TST 155',
                'courseTitle' => 'test-ownership-' . $suffix,
                'section' => '01',
                'term' => 'Fall 2099',
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

    private function postCreate(FunctionalTester $I, $token, $suffix, $actingFor = null, $listingId = null)
    {
        $payload = [
            'term_code' => 'Fall 2099',
            'course_code' => 'TST 155',
            'section' => '01',
            'course_title' => 'test-ownership-' . $suffix,
            'faculty_display_name' => 'Test Owner Bravo',
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
            '/index-test.php?r=faculty-submission%2Fcreate',
            $payload
        );
    }

    private function mockLogin($suffix, $internalId = null, $role = 'faculty')
    {
        return $this->mockLoginAs('T est-' . $suffix, 'test-' . $suffix, $internalId, $role);
    }

    private function mockLoginAs($fullName, $expectedId, $internalId = null, $role = 'faculty')
    {
        $loginData = ['full_name' => $fullName];
        if ($internalId !== null) {
            $loginData['internal_id'] = $internalId;
        }
        if ($role !== 'faculty') {
            $loginData['role'] = $role;
        }
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => http_build_query($loginData),
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
        if ($internalId !== null) {
            \PHPUnit\Framework\Assert::assertSame($internalId, $claims['internal_id']);
        }
        \PHPUnit\Framework\Assert::assertSame($role, $claims['role']);
        $claims['email'] = $expectedId . '@example.test';

        return \Firebase\JWT\JWT::encode($claims, getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function signedToken($username, $role)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'full_name' => 'Synthetic Employee Proxy',
            'email' => $username . '@example.test',
            'institution' => 'SM',
            'internal_id' => '999006901',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertPermission($ownerId, $proxyId, $permissionType, $expiresAt = null, $allowedCourse = null)
    {
        \Yii::$app->db->createCommand()->insert('faculty_proxy_permissions', [
            'faculty_shibboleth_id' => $ownerId,
            'proxy_shibboleth_id' => $proxyId,
            'faculty_internal_id' => $ownerId === $this->targetId ? $this->targetSmithId : null,
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
        $ownerId = in_array($suffix, ['covered', 'staff-create', 'create-covered', 'employee-proxy'], true)
            ? $this->targetId
            : $this->actorId;
        return \Yii::$app->db->createCommand(
            'SELECT * FROM faculty_submissions WHERE shibboleth_user_id = :owner_id '
            . 'AND ((its_course_id = :course_id AND academic_period = :academic_period) '
            . 'OR course_title = :course_title) '
            . 'ORDER BY submission_id DESC LIMIT 1',
            [
                ':owner_id' => $ownerId,
                ':course_id' => 'TST-155-01-209909',
                ':academic_period' => 'AP_209909',
                ':course_title' => 'test-ownership-' . $suffix,
            ]
        )->queryOne();
    }

    private function assertSubmissionNotes($submissionId, $expectedNotes)
    {
        $notes = \Yii::$app->db->createCommand(
            'SELECT submission_notes FROM faculty_submissions WHERE submission_id = :submission_id',
            [':submission_id' => $submissionId]
        )->queryScalar();
        \PHPUnit\Framework\Assert::assertSame($expectedNotes, $notes);
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
            ':course_title' => 'test-ownership-' . $suffix,
            ':course_code' => 'TST 155',
            ':term_code' => 'Fall 2099',
            ':section' => '01',
        ];
        $submissionCount = (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM faculty_submissions WHERE course_title = :course_title '
            . 'AND course_code = :course_code AND term_code = :term_code AND section = :section',
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
                . 'WHERE parent.course_title = :course_title AND parent.course_code = :course_code '
                . 'AND parent.term_code = :term_code AND parent.section = :section',
                $params
            )->queryScalar();
            \PHPUnit\Framework\Assert::assertSame(0, $count, 'Rejected request wrote rows to ' . $table . '.');
        }
    }

    private function cleanupSubmissions()
    {
        $submissionIds = \Yii::$app->db->createCommand(
            "SELECT submission_id FROM faculty_submissions WHERE shibboleth_user_id IN "
            . "(:actor_id, :target_id) OR course_title LIKE 'test-ownership-%'",
            [':actor_id' => $this->actorId, ':target_id' => $this->targetId]
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

    private function insertRosterAssignment($smithId, $courseId, $academicPeriod)
    {
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => $academicPeriod,
            'course_id' => $courseId,
            'course_title' => 'test-ownership-roster-course',
            'smith_id' => $smithId,
            'role' => 'Instructor',
        ])->execute();
    }

    private function cleanupAssignments()
    {
        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => [
                $this->actorSmithId,
                $this->targetSmithId,
                $this->coInstructorSmithId,
                '999000104',
                '999000105',
            ],
        ])->execute();
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

class TestSubmissionOwnershipFolioStub
{
    public function searchTerms()
    {
        return [
            [
                'id' => 'test-folio-term-2099',
                'name' => 'Fall 2099',
                'startDate' => '2099-08-01',
                'endDate' => '2099-12-31',
            ],
            [
                'id' => '00000000-0000-4000-8000-000000000002',
                'name' => 'Spring 2027',
                'startDate' => '2027-01-01',
                'endDate' => '2027-05-31',
            ],
        ];
    }

    public function searchCourses($query)
    {
        return null;
    }
}
