<?php

/**
 * Verifies secure faculty proxy invitations, acceptance and staff oversight.
 */
class FacultyProxyCest extends BaseFunctionalCest
{
    private $facultyId = 'test-api070-faculty';
    private $employeeId = 'test-api070-employee';
    private $facultyInternalId = '999007001';
    private $listingId = 'test-api070-listing-current';
    private $otherListingId = 'test-api070-listing-other';
    private $unrosteredListingId = 'test-api070-listing-unrostered';
    private $previousFacultyFormUrl;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->previousFacultyFormUrl = \Yii::$app->params['facultyFormUrl'] ?? null;
        \Yii::$app->params['facultyFormUrl'] = 'http://localhost:5174/test-configured-prefix';
        $this->cleanupFixtures();
        $this->insertAssignment($this->listingId, 'test 155', '01');
        $this->insertAssignment($this->otherListingId, 'test 156', '02');
        \Yii::$container->set(
            \app\services\FolioService::class,
            new TestApi070FolioService()
        );
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanupFixtures();
        \Yii::$container->clear(\app\services\FolioService::class);
        if ($this->previousFacultyFormUrl === null) {
            unset(\Yii::$app->params['facultyFormUrl']);
        } else {
            \Yii::$app->params['facultyFormUrl'] = $this->previousFacultyFormUrl;
        }
    }

    public function facultyCanInviteWithDefaultCourseScopeAndSeeTheirGrants(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->employeeId, 'employee'));
        $I->sendAjaxRequest('POST', $this->proxyRoute('invite-proxy'), $this->invitePayload([$this->listingId]));
        $I->seeResponseCodeIs(403);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->facultyId, 'faculty', $this->facultyInternalId));
        $I->sendAjaxRequest('POST', $this->proxyRoute('invite-proxy'), $this->invitePayload([$this->listingId]));
        $response = $this->response($I);
        \PHPUnit\Framework\Assert::assertArrayHasKey('permission', $response, 'Invitation response: ' . json_encode($response));
        $I->seeResponseCodeIs(200);
        \PHPUnit\Framework\Assert::assertArrayHasKey('invitation_url', $response);
        \PHPUnit\Framework\Assert::assertArrayHasKey('permission', $response);

        \PHPUnit\Framework\Assert::assertSame(
            'http://localhost:5174/test-configured-prefix/faculty/accept-proxy-invitation/',
            substr(
                $response['invitation_url'],
                0,
                strlen('http://localhost:5174/test-configured-prefix/faculty/accept-proxy-invitation/')
            )
        );
        \PHPUnit\Framework\Assert::assertSame(
            \app\models\FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES,
            $response['permission']['permission_type']
        );
        \PHPUnit\Framework\Assert::assertSame($this->listingId, $response['permission']['courses'][0]['folio_course_listing_id']);
        \PHPUnit\Framework\Assert::assertNotEmpty($response['permission']['invitation_expires_at']);

        $I->sendAjaxRequest('GET', $this->proxyRoute('my-proxies'));
        $I->seeResponseCodeIs(200);
        $grants = $this->response($I)['items'];
        \PHPUnit\Framework\Assert::assertCount(1, $grants);
        \PHPUnit\Framework\Assert::assertSame('test-api070-proxy@example.test', $grants[0]['proxy_email']);
        \PHPUnit\Framework\Assert::assertSame('pending', $grants[0]['status']);
        \PHPUnit\Framework\Assert::assertSame($this->listingId, $grants[0]['courses'][0]['folio_course_listing_id']);
    }

    public function invitationCourseMustResolveToAnInstructorRosterCourse(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->facultyId, 'faculty', $this->facultyInternalId));
        $I->sendAjaxRequest(
            'POST',
            $this->proxyRoute('invite-proxy'),
            $this->invitePayload([$this->unrosteredListingId])
        );
        $I->seeResponseCodeIs(400);
        \PHPUnit\Framework\Assert::assertSame(
            0,
            (int)\app\models\FacultyProxyPermission::find()
                ->where(['faculty_shibboleth_id' => $this->facultyId])
                ->count()
        );
    }

    public function facultyCanChooseFullAccessOrViewOnly(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->facultyId, 'faculty', $this->facultyInternalId));
        foreach ([
            ['full_access', 'test-api070-all@example.test'],
            ['view_only', 'test-api070-view@example.test'],
        ] as $case) {
            $I->sendAjaxRequest('POST', $this->proxyRoute('invite-proxy'), [
                'proxy_email' => $case[1],
                'permission_type' => $case[0],
            ]);
            $I->seeResponseCodeIs(200);
            $response = $this->response($I);
            \PHPUnit\Framework\Assert::assertSame($case[0], $response['permission']['permission_type']);
        }
    }

    public function acceptanceUsesTheAuthenticatedAccountAndInvitationIsSingleUse(FunctionalTester $I)
    {
        $permission = $this->createInvitation($I);
        $token = $permission->invitation_token;

        $I->deleteHeader('Authorization');
        $I->sendAjaxRequest('POST', $this->proxyRoute('accept-invitation'), [
            'invitation_token' => $token,
            'proxy_shibboleth_id' => 'test-api070-forged-proxy',
            'proxy_email' => 'test-api070-forged@example.test',
        ]);
        $I->seeResponseCodeIs(401);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->employeeId, 'employee'));
        $I->sendAjaxRequest('GET', $this->proxyRoute('validate-token', ['token' => $token]));
        $I->seeResponseCodeIs(200);
        $validation = $this->response($I);
        \PHPUnit\Framework\Assert::assertSame(['valid', 'invitation'], array_keys($validation));
        \PHPUnit\Framework\Assert::assertSame(
            ['faculty_name', 'scope_summary', 'invitation_expires_at'],
            array_keys($validation['invitation'])
        );
        \PHPUnit\Framework\Assert::assertStringNotContainsString('example.test', json_encode($validation));
        \PHPUnit\Framework\Assert::assertStringNotContainsString($this->facultyId, json_encode($validation));
        \PHPUnit\Framework\Assert::assertStringNotContainsString($token, json_encode($validation));

        $I->sendAjaxRequest('POST', $this->proxyRoute('accept-invitation'), [
            'invitation_token' => $token,
            'proxy_shibboleth_id' => 'test-api070-forged-proxy',
        ]);
        $I->seeResponseCodeIs(200);
        $permission->refresh();
        \PHPUnit\Framework\Assert::assertSame($this->employeeId, $permission->proxy_shibboleth_id);
        $I->sendAjaxRequest('POST', $this->proxyRoute('accept-invitation'), ['invitation_token' => $token]);
        $I->seeResponseCodeIs(409);
        $I->sendAjaxRequest('GET', $this->proxyRoute('validate-token', ['token' => $token]));
        \PHPUnit\Framework\Assert::assertFalse($this->response($I)['valid']);

        $log = \app\models\FacultyProxyActivityLog::find()
            ->where(['faculty_shibboleth_id' => $this->facultyId, 'action' => 'accepted'])
            ->one();
        \PHPUnit\Framework\Assert::assertNotNull($log);
        \PHPUnit\Framework\Assert::assertSame($this->employeeId, $log->proxy_shibboleth_id);
        \PHPUnit\Framework\Assert::assertSame($this->employeeId, $log->getDetailsDecoded()['accepted_by_user_id']);
        \PHPUnit\Framework\Assert::assertSame('employee', $log->getDetailsDecoded()['accepted_by_role']);
    }

    public function ownOrExpiredInvitationsCannotBeAccepted(FunctionalTester $I)
    {
        $permission = $this->createInvitation($I);
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->facultyId, 'faculty'));
        $I->sendAjaxRequest('POST', $this->proxyRoute('accept-invitation'), [
            'invitation_token' => $permission->invitation_token,
        ]);
        $I->seeResponseCodeIs(409);

        $permission->invitation_expires_at = '2000-01-01 00:00:00';
        $permission->save(false);
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->employeeId, 'employee'));
        $I->sendAjaxRequest('POST', $this->proxyRoute('accept-invitation'), [
            'invitation_token' => $permission->invitation_token,
        ]);
        $I->seeResponseCodeIs(410);
    }

    public function acceptedEmployeeCanActForGrantedCourseUntilFacultyRevokes(FunctionalTester $I)
    {
        $permission = $this->createInvitation($I);
        $this->accept($I, $permission->invitation_token);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->employeeId, 'employee'));
        $I->sendAjaxRequest('GET', $this->proxyRoute('my-faculty-access'));
        $I->seeResponseCodeIs(200);
        $access = $this->response($I)['items'];
        \PHPUnit\Framework\Assert::assertCount(1, $access);
        \PHPUnit\Framework\Assert::assertSame($this->facultyId, $access[0]['faculty_id']);
        \PHPUnit\Framework\Assert::assertSame($this->listingId, $access[0]['courses'][0]['folio_course_listing_id']);

        $this->submitActingFor($I, 'allowed', $this->listingId);
        $I->seeResponseCodeIs(200);
        $submission = \app\models\FacultySubmission::find()
            ->where([
                'shibboleth_user_id' => $this->facultyId,
                'proxy_shibboleth_user_id' => $this->employeeId,
                'its_course_id' => 'TEST-155-01-209901',
                'academic_period' => 'AP_209901',
            ])
            ->one();
        \PHPUnit\Framework\Assert::assertSame($this->facultyId, $submission->shibboleth_user_id);
        \PHPUnit\Framework\Assert::assertSame($this->employeeId, $submission->proxy_shibboleth_user_id);

        $this->submitActingFor($I, 'ungranted', $this->otherListingId);
        $I->seeResponseCodeIs(403);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->facultyId, 'faculty', $this->facultyInternalId));
        $I->sendAjaxRequest('DELETE', $this->proxyRoute('revoke-proxy', ['id' => $permission->permission_id]));
        $I->seeResponseCodeIs(200);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->employeeId, 'employee'));
        $this->submitActingFor($I, 'revoked', $this->listingId);
        $I->seeResponseCodeIs(403);
        \PHPUnit\Framework\Assert::assertTrue(
            \app\models\FacultyProxyActivityLog::find()
                ->where(['faculty_shibboleth_id' => $this->facultyId, 'action' => 'acted_for'])
                ->exists()
        );
    }

    public function staffCanReviewAndRevokeAllGrantsButOthersCannot(FunctionalTester $I)
    {
        $permission = $this->createInvitation($I);
        $this->accept($I, $permission->invitation_token);

        foreach (['faculty', 'employee'] as $role) {
            $userId = $role === 'faculty' ? 'test-api070-other-faculty' : $this->employeeId;
            $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($userId, $role));
            $I->sendAjaxRequest('GET', $this->proxyRoute('staff-grants'));
            $I->seeResponseCodeIs(403);
            $I->sendAjaxRequest('GET', $this->proxyRoute('staff-activity-log'));
            $I->seeResponseCodeIs(403);
            $I->sendAjaxRequest('DELETE', $this->proxyRoute('staff-revoke-grant', ['id' => $permission->permission_id]));
            $I->seeResponseCodeIs(403);
        }

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token('test-api070-staff', 'staff'));
        $I->sendAjaxRequest('GET', $this->proxyRoute('staff-grants', [
            'status' => 'active',
            'faculty_id' => $this->facultyId,
        ]));
        $I->seeResponseCodeIs(200);
        \PHPUnit\Framework\Assert::assertCount(1, $this->response($I)['items']);
        $I->sendAjaxRequest('GET', $this->proxyRoute('staff-activity-log', ['faculty_id' => $this->facultyId]));
        $I->seeResponseCodeIs(200);
        \PHPUnit\Framework\Assert::assertGreaterThan(0, count($this->response($I)['items']));
        $I->sendAjaxRequest('DELETE', $this->proxyRoute('staff-revoke-grant', ['id' => $permission->permission_id]));
        $I->seeResponseCodeIs(200);

        $permission->refresh();
        \PHPUnit\Framework\Assert::assertSame('revoked', $permission->status);
        $log = \app\models\FacultyProxyActivityLog::find()
            ->where(['faculty_shibboleth_id' => $this->facultyId, 'action' => 'revoked'])
            ->one();
        \PHPUnit\Framework\Assert::assertSame('test-api070-staff', $log->getDetailsDecoded()['revoked_by_user_id']);
    }

    private function createInvitation(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->facultyId, 'faculty', $this->facultyInternalId));
        $I->sendAjaxRequest('POST', $this->proxyRoute('invite-proxy'), $this->invitePayload([$this->listingId]));
        $response = $this->response($I);
        \PHPUnit\Framework\Assert::assertArrayHasKey('permission', $response, 'Invitation response: ' . json_encode($response));
        $I->seeResponseCodeIs(200);
        $permission = \app\models\FacultyProxyPermission::find()
            ->where([
                'faculty_shibboleth_id' => $this->facultyId,
                'proxy_email' => 'test-api070-proxy@example.test',
                'status' => \app\models\FacultyProxyPermission::STATUS_PENDING,
            ])
            ->one();
        \PHPUnit\Framework\Assert::assertNotNull($permission, 'A successful invite response must persist a pending grant.');
        return $permission;
    }

    private function accept(FunctionalTester $I, $token)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token($this->employeeId, 'employee'));
        $I->sendAjaxRequest('POST', $this->proxyRoute('accept-invitation'), ['invitation_token' => $token]);
        $I->seeResponseCodeIs(200);
    }

    private function invitePayload(array $courseIds)
    {
        return [
            'proxy_email' => 'test-api070-proxy@example.test',
            'course_permissions' => array_map(function ($id) {
                return ['folio_course_listing_id' => $id];
            }, $courseIds),
        ];
    }

    private function proxyRoute($action, array $params = [])
    {
        return \Yii::$app->urlManager->createUrl(array_merge(['faculty-proxy/' . $action], $params));
    }

    private function submitActingFor(FunctionalTester $I, $suffix, $listingId)
    {
        $I->sendAjaxRequest('POST', \Yii::$app->urlManager->createUrl(['faculty-submission/submit-complete']), [
            'acting_for_faculty_id' => $this->facultyId,
            'folio_course_listing_id' => $listingId,
            'its_course_id' => $listingId === $this->listingId
                ? 'TEST-155-01-209901'
                : 'TEST-156-02-209901',
            'academic_period' => 'AP_209901',
            'courseInfo' => [
            'courseCode' => $listingId === $this->listingId ? 'TEST 155' : 'TEST 156',
                'courseTitle' => 'test-api070-submission-' . $suffix,
                'section' => $listingId === $this->listingId ? '01' : '02',
                'term' => 'Fall 2099',
                'instructors' => 'Test API070 Faculty',
            ],
            'resources' => [],
            'folders' => [],
            'metadata' => ['submittedBy' => ['username' => 'test-api070-forged']],
        ]);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertIsArray($response);
        return $response;
    }

    private function token($username, $role, $internalId = null)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'full_name' => 'Test API070 ' . $role,
            'email' => $username . '@example.test',
            'institution' => 'SM',
            'internal_id' => $internalId,
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertAssignment($listingId, $courseCode, $section)
    {
        $courseNumber = strtoupper(str_replace(' ', '-', $courseCode));
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => 'AP_209901',
            'course_id' => $courseNumber . '-' . $section . '-209901',
            'course_title' => 'test-api070-' . $listingId,
            'smith_id' => $this->facultyInternalId,
            'role' => 'Instructor',
        ])->execute();
    }

    private function cleanupFixtures()
    {
        $permissionIds = \app\models\FacultyProxyPermission::find()
            ->select('permission_id')
            ->where(['faculty_shibboleth_id' => $this->facultyId])
            ->column();
        \Yii::$app->db->createCommand()->delete('faculty_proxy_activity_log', [
            'or',
            ['like', 'faculty_shibboleth_id', 'test-api070-%'],
            ['like', 'proxy_shibboleth_id', 'test-api070-%'],
        ])->execute();
        if ($permissionIds) {
            \Yii::$app->db->createCommand()->delete('faculty_proxy_course_permissions', [
                'permission_id' => $permissionIds,
            ])->execute();
            \Yii::$app->db->createCommand()->delete('faculty_proxy_permissions', [
                'permission_id' => $permissionIds,
            ])->execute();
        }
        \Yii::$app->db->createCommand()->delete('faculty_proxy_permissions', [
            'proxy_shibboleth_id' => ['test-api070-employee', 'test-api070-other-faculty'],
        ])->execute();
        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => $this->facultyInternalId,
        ])->execute();
        \Yii::$app->db->createCommand()->delete('faculty_submissions', [
            'like', 'course_title', 'test-api070-submission-%',
        ])->execute();
        \Yii::$app->db->createCommand()->delete('faculty_submissions', [
            'shibboleth_user_id' => $this->facultyId,
            'proxy_shibboleth_user_id' => $this->employeeId,
        ])->execute();
    }
}

class TestApi070FolioService
{
    private $courses = [
        'test-api070-listing-current' => [
            'id' => 'test-api070-course-current',
            'courseNumber' => 'TEST 155',
            'name' => 'test-api070-course-current',
            'courseListingId' => 'test-api070-listing-current',
            'courseListingObject' => ['id' => 'test-api070-listing-current', 'termId' => 'test-api070-term'],
            'sectionName' => '01',
        ],
        'test-api070-listing-other' => [
            'id' => 'test-api070-course-other',
            'courseNumber' => 'TEST 156',
            'name' => 'test-api070-course-other',
            'courseListingId' => 'test-api070-listing-other',
            'courseListingObject' => ['id' => 'test-api070-listing-other', 'termId' => 'test-api070-term'],
            'sectionName' => '02',
        ],
        'test-api070-listing-unrostered' => [
            'id' => 'test-api070-course-unrostered',
            'courseNumber' => 'TEST 157',
            'name' => 'test-api070-course-unrostered',
            'courseListingId' => 'test-api070-listing-unrostered',
            'courseListingObject' => ['id' => 'test-api070-listing-unrostered', 'termId' => 'test-api070-term'],
            'sectionName' => '03',
        ],
    ];

    public function searchTerms()
    {
        return [[
            'id' => 'test-api070-term',
            'name' => 'Fall 2099',
            'startDate' => '2099-01-01',
            'endDate' => '2099-12-31',
        ]];
    }

    public function searchCourses($query)
    {
        foreach ($this->courses as $id => $course) {
            if (strpos($query, $id) !== false) {
                return $course;
            }
        }
        return null;
    }
}
