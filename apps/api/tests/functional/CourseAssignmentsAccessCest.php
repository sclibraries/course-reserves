<?php

/**
 * Verifies authenticated access and per-faculty course lookup behavior.
 */
class CourseAssignmentsAccessCest extends BaseFunctionalCest
{
    private $_facultyAInternalId = '999000031';
    private $_facultyBInternalId = '999000032';
    private $_facultyAToken;
    private $_facultyBToken;
    private $_staffToken;
    private $_staffInstructorToken;

    /**
     * Create synthetic assignments and get tokens from the application issuers.
     *
     * @param  FunctionalTester $I Functional test actor.
     * @return void
     */
    public function _before(FunctionalTester $I)
    {
        parent::_before($I);

        $this->_removeAssignments();
        $this->_insertAssignment($this->_facultyAInternalId, 'TST-101-01-209901');
        $this->_insertAssignment($this->_facultyBInternalId, 'TST-102-01-209901');

        $this->_staffToken = $this->_requestToken(
            'http://localhost/dev-auth/login',
            ['username' => 'devadmin'],
            'access_token'
        );
        $this->_facultyAToken = $this->_requestToken(
            'http://localhost/faculty-submission/mock-login',
            [
                'full_name' => 'Synthetic Faculty A',
                'internal_id' => $this->_facultyAInternalId,
            ],
            'token'
        );
        $this->_facultyBToken = $this->_requestToken(
            'http://localhost/faculty-submission/mock-login',
            [
                'full_name' => 'Synthetic Faculty B',
                'internal_id' => $this->_facultyBInternalId,
            ],
            'token'
        );
        $this->_staffInstructorToken = $this->_requestToken(
            'http://localhost/faculty-submission/mock-login',
            [
                'full_name' => 'Synthetic Staff Instructor',
                'internal_id' => $this->_facultyAInternalId,
                'role' => 'staff',
            ],
            'token'
        );
    }

    /**
     * Remove synthetic assignments after each scenario.
     *
     * @param  FunctionalTester $I Functional test actor.
     * @return void
     */
    public function _after(FunctionalTester $I)
    {
        $this->_removeAssignments();
    }

    /**
     * Assert the staff-only response matrix for all roster routes.
     *
     * @param  FunctionalTester $I Functional test actor.
     * @return void
     */
    public function rosterRoutesRequireStaffAuthorization(FunctionalTester $I)
    {
        $requests = [
            ['index', []],
            ['by-period', []],
            ['by-smith-id', ['smith_id' => $this->_facultyAInternalId]],
            ['check-enrollment', [
                'smith_id' => $this->_facultyAInternalId,
                'course_number' => 'TST 101',
                'section_name' => '01',
                'academic_period' => 'AP_209901',
            ]],
        ];

        foreach ($requests as $request) {
            $route = 'course-assignments/' . $request[0];

            $I->deleteHeader('Authorization');
            $I->amOnRoute($route, $request[1]);
            $I->seeResponseCodeIs(401);

            $I->haveHttpHeader('Authorization', 'Bearer ' . $this->_facultyAToken);
            $I->amOnRoute($route, $request[1]);
            $I->seeResponseCodeIs(403);

            $I->haveHttpHeader('Authorization', 'Bearer ' . $this->_staffToken);
            $I->amOnRoute($route, $request[1]);
            $I->seeResponseCodeIs(200);
        }
    }

    /**
     * Assert faculty lookup uses the token identity and ignores query identities.
     *
     * @param  FunctionalTester $I Functional test actor.
     * @return void
     */
    public function instructorCoursesUsesOnlyTheFacultyTokenIdentity(FunctionalTester $I)
    {
        $claims = (array) \Firebase\JWT\JWT::decode(
            $this->_facultyAToken,
            new \Firebase\JWT\Key(getenv('JWT_SECRET_KEY'), 'HS256')
        );
        \PHPUnit\Framework\Assert::assertSame(
            $this->_facultyAInternalId,
            $claims['internal_id'] ?? null
        );

        $I->deleteHeader('Authorization');
        $I->amOnRoute('course-assignments/instructor-courses');
        $I->seeResponseCodeIs(401);

        $this->_assertFacultyAssignmentsAreScoped(
            $I,
            $this->_facultyAToken,
            $this->_facultyAInternalId,
            $this->_facultyBInternalId
        );
        $this->_assertFacultyAssignmentsAreScoped(
            $I,
            $this->_facultyBToken,
            $this->_facultyBInternalId,
            $this->_facultyAInternalId
        );

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->_staffInstructorToken);
        $I->amOnRoute('course-assignments/instructor-courses');
        $I->seeResponseCodeIs(200);

        $response = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertSame(1, $response['count']);
        \PHPUnit\Framework\Assert::assertSame(
            $this->_facultyAInternalId,
            $response['courses'][0]['assignment']['smith_id']
        );
    }

    /**
     * Assert one faculty token always returns only its own assignment.
     *
     * @param  FunctionalTester $I       Functional test actor.
     * @param  string           $token   Faculty access token.
     * @param  string           $ownId   Internal identifier belonging to the token.
     * @param  string           $otherId Internal identifier belonging to another faculty.
     * @return void
     */
    private function _assertFacultyAssignmentsAreScoped(
        FunctionalTester $I,
        $token,
        $ownId,
        $otherId
    ) {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        foreach ([
            [],
            ['smith_id' => $otherId],
            ['internal_id' => $otherId],
        ] as $query) {
            $I->amOnRoute('course-assignments/instructor-courses', $query);
            $I->seeResponseCodeIs(200);

            $response = json_decode($I->grabPageSource(), true);
            \PHPUnit\Framework\Assert::assertSame(1, $response['count']);
            \PHPUnit\Framework\Assert::assertSame($ownId, $response['instructor']['internal_id']);
            \PHPUnit\Framework\Assert::assertSame(
                $ownId,
                $response['courses'][0]['assignment']['smith_id']
            );
        }
    }

    /**
     * Assert the query-identity debug route is hidden in the test environment.
     *
     * @param  FunctionalTester $I Functional test actor.
     * @return void
     */
    public function testQueryIdentityRouteReturns404InTestEnvironment(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->_staffToken);
        $I->amOnRoute(
            'course-assignments/test-instructor-courses',
            [
                'full_name' => 'Synthetic Faculty A',
                'internal_id' => $this->_facultyAInternalId,
            ]
        );
        $I->seeResponseCodeIs(404);
    }

    /**
     * Insert one synthetic course assignment.
     *
     * @param  string $internalId Synthetic faculty identifier.
     * @param  string $courseId   Synthetic course identifier.
     * @return void
     */
    private function _insertAssignment($internalId, $courseId)
    {
        \Yii::$app->db->createCommand()->insert(
            'course_assignments', [
            'academic_period' => 'AP_209901',
            'course_id' => $courseId,
            'course_title' => 'Synthetic API-031 Course',
            'smith_id' => $internalId,
            'role' => 'instructor',
            ]
        )->execute();
    }

    /**
     * Remove both synthetic course assignments.
     *
     * @return void
     */
    private function _removeAssignments()
    {
        \Yii::$app->db->createCommand()->delete(
            'course_assignments', [
            'smith_id' => [$this->_facultyAInternalId, $this->_facultyBInternalId],
            ]
        )->execute();
    }

    /**
     * Get a token from an application issuer and return the requested field.
     *
     * @param  string $url      Token issuer URL.
     * @param  array  $postData Form fields for the issuer.
     * @param  string $tokenKey Response field containing the token.
     * @return string
     */
    private function _requestToken($url, array $postData, $tokenKey)
    {
        $context = stream_context_create(
            [
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => http_build_query($postData),
                'ignore_errors' => true,
            ],
            ]
        );
        $body = file_get_contents($url, false, $context);
        $data = json_decode($body, true);

        if (!is_array($data) || empty($data[$tokenKey])) {
            throw new \RuntimeException(
                "Expected '{$tokenKey}' in response from {$url}. Got: {$body}"
            );
        }

        return $data[$tokenKey];
    }
}
