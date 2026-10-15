<?php

use app\models\FacultyProxyPermission;
use app\services\FolioService;
use Firebase\JWT\JWT;

/**
 * Verifies proxy-scoped faculty submission and course listings.
 */
class Api074ProxyDesigneeCest extends BaseFunctionalCest
{
    private $facultyA = 'test-api074-faculty-a';
    private $facultyB = 'test-api074-faculty-b';
    private $unrelatedFaculty = 'test-api074-faculty-unrelated';
    private $staffId = 'test-api074-staff';
    private $specificProxy = 'test-api074-proxy-specific';
    private $fullProxy = 'test-api074-proxy-full';
    private $viewProxy = 'test-api074-proxy-view';
    private $coInstructor = 'test-api074-co-instructor';
    private $unrelatedEmployee = 'test-api074-employee-unrelated';
    private $facultyInternalId = '999007401';
    private $specificInternalId = '999007402';
    private $coInstructorInternalId = '999007405';
    private $previousFacultyFormUrl;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->previousFacultyFormUrl = \Yii::$app->params['facultyFormUrl'] ?? null;
        \Yii::$app->params['facultyFormUrl'] = 'https://faculty.example.test';
        \Yii::$container->set(FolioService::class, new TestApi074FolioService());
        $this->cleanupFixtures();

        $this->insertAssignment($this->facultyInternalId, 'TST-074-01-209901', 'test-api074-course-a');
        $this->insertAssignment($this->facultyInternalId, 'TST-075-02-209901', 'test-api074-course-b');
        $this->insertAssignment($this->coInstructorInternalId, 'TST-076-03-209901', 'test-api074-course-c');
        $this->insertAssignment($this->specificInternalId, 'TST-077-01-209901', 'test-api074-course-own');

        $this->insertSubmission($this->facultyA, 'owner-a', 'TST 074', '01', 'test-api074-listing-a');
        $this->insertSubmission($this->facultyA, 'owner-b', 'TST 075', '02', 'test-api074-listing-b');
        $this->insertSubmission($this->facultyB, 'owner-c', 'TST 076', '03', 'test-api074-listing-c');
        $this->insertSubmission($this->unrelatedFaculty, 'owner-unrelated', 'TST 099', '09', 'test-api074-listing-unrelated');
        $this->insertSubmission($this->staffId, 'staff-own', 'TST 098', '08', 'test-api074-listing-staff');

        $this->insertGrant(
            $this->facultyA,
            $this->specificProxy,
            FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES,
            FacultyProxyPermission::STATUS_ACTIVE,
            ['test-api074-listing-a'],
            null,
            $this->facultyInternalId
        );
        $this->insertGrant(
            $this->facultyA,
            $this->fullProxy,
            FacultyProxyPermission::PERMISSION_FULL_ACCESS,
            FacultyProxyPermission::STATUS_ACTIVE,
            [],
            null,
            $this->facultyInternalId
        );
        $this->insertGrant(
            $this->facultyA,
            $this->viewProxy,
            FacultyProxyPermission::PERMISSION_VIEW_ONLY,
            FacultyProxyPermission::STATUS_ACTIVE,
            [],
            null,
            $this->facultyInternalId
        );
        $this->insertGrant(
            $this->facultyA,
            $this->staffId,
            FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES,
            FacultyProxyPermission::STATUS_ACTIVE,
            ['test-api074-listing-a'],
            null,
            $this->facultyInternalId
        );
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanupFixtures();
        \Yii::$container->clear(FolioService::class);
        if ($this->previousFacultyFormUrl === null) {
            unset(\Yii::$app->params['facultyFormUrl']);
        } else {
            \Yii::$app->params['facultyFormUrl'] = $this->previousFacultyFormUrl;
        }
    }

    public function submissionListMatchesOwnerProxyAndRosterAccess(FunctionalTester $I)
    {
        $owner = $this->listFor($I, $this->token($this->facultyA, 'faculty', $this->facultyInternalId));
        $this->assertTitles($owner, ['test-api074-owner-a', 'test-api074-owner-b']);
        \PHPUnit\Framework\Assert::assertSame('owner', $this->accessFor($owner, 'test-api074-owner-a')['access']);

        $specific = $this->listFor($I, $this->token($this->specificProxy, 'employee', $this->specificInternalId));
        $this->assertTitles($specific, ['test-api074-owner-a']);
        \PHPUnit\Framework\Assert::assertSame('proxy', $this->accessFor($specific, 'test-api074-owner-a')['access']);
        \PHPUnit\Framework\Assert::assertTrue($this->accessFor($specific, 'test-api074-owner-a')['proxy_can_edit']);

        $full = $this->listFor($I, $this->token($this->fullProxy, 'employee'));
        $this->assertTitles($full, ['test-api074-owner-a', 'test-api074-owner-b']);
        \PHPUnit\Framework\Assert::assertTrue($this->accessFor($full, 'test-api074-owner-b')['proxy_can_edit']);

        $viewOnly = $this->listFor($I, $this->token($this->viewProxy, 'employee'));
        $this->assertTitles($viewOnly, ['test-api074-owner-a', 'test-api074-owner-b']);
        \PHPUnit\Framework\Assert::assertFalse($this->accessFor($viewOnly, 'test-api074-owner-a')['proxy_can_edit']);

        $coInstructor = $this->listFor($I, $this->token($this->coInstructor, 'faculty', $this->coInstructorInternalId));
        $this->assertTitles($coInstructor, ['test-api074-owner-c']);
        \PHPUnit\Framework\Assert::assertSame('co_instructor', $this->accessFor($coInstructor, 'test-api074-owner-c')['access']);

        $unrelated = $this->listFor($I, $this->token($this->unrelatedEmployee, 'employee'));
        $this->assertTitles($unrelated, []);
    }

    public function submissionListExcludesInactiveAndOutOfScopeGrants(FunctionalTester $I)
    {
        $this->insertSubmission('test-api074-pending-faculty', 'pending', 'TST 080', '01', 'test-api074-listing-pending');
        $this->insertSubmission('test-api074-revoked-faculty', 'revoked', 'TST 081', '01', 'test-api074-listing-revoked');
        $this->insertSubmission('test-api074-expired-faculty', 'expired', 'TST 082', '01', 'test-api074-listing-expired');
        $this->insertGrant(
            'test-api074-pending-faculty',
            $this->unrelatedEmployee,
            FacultyProxyPermission::PERMISSION_FULL_ACCESS,
            FacultyProxyPermission::STATUS_PENDING
        );
        $this->insertGrant(
            'test-api074-revoked-faculty',
            $this->unrelatedEmployee,
            FacultyProxyPermission::PERMISSION_FULL_ACCESS,
            FacultyProxyPermission::STATUS_REVOKED
        );
        $this->insertGrant(
            'test-api074-expired-faculty',
            $this->unrelatedEmployee,
            FacultyProxyPermission::PERMISSION_FULL_ACCESS,
            FacultyProxyPermission::STATUS_ACTIVE,
            [],
            '2000-01-01 00:00:00'
        );

        $response = $this->listFor($I, $this->token($this->unrelatedEmployee, 'employee'));
        $this->assertTitles($response, []);

        $specific = $this->listFor($I, $this->token($this->specificProxy, 'employee', $this->specificInternalId));
        $this->assertTitles($specific, ['test-api074-owner-a']);
    }

    public function staffSubmissionListKeepsItsCurrentGrantBasedScope(FunctionalTester $I)
    {
        $staff = $this->listFor($I, $this->token($this->staffId, 'staff'));
        $this->assertTitles($staff, [
            'test-api074-owner-a',
            'test-api074-owner-b',
            'test-api074-staff-own',
        ]);
        \PHPUnit\Framework\Assert::assertSame('owner', $this->accessFor($staff, 'test-api074-staff-own')['access']);
        \PHPUnit\Framework\Assert::assertSame('proxy', $this->accessFor($staff, 'test-api074-owner-b')['access']);
        \PHPUnit\Framework\Assert::assertArrayNotHasKey('test-api074-owner-c', array_flip($this->titles($staff)));
        \PHPUnit\Framework\Assert::assertArrayNotHasKey('test-api074-owner-unrelated', array_flip($this->titles($staff)));
    }

    public function instructorCoursesCanBeRequestedForAnActiveDesigneeGrant(FunctionalTester $I)
    {
        $own = $this->coursesFor($I, $this->token($this->specificProxy, 'employee', $this->specificInternalId));
        \PHPUnit\Framework\Assert::assertSame($this->specificInternalId, $own['instructor']['internal_id']);
        \PHPUnit\Framework\Assert::assertSame(['test-api074-listing-own'], $this->listingIds($own['courses']));
        \PHPUnit\Framework\Assert::assertArrayNotHasKey('can_edit', $own);

        $full = $this->coursesFor($I, $this->token($this->fullProxy, 'employee'), [
            'acting_for_faculty_id' => $this->facultyA,
        ]);
        \PHPUnit\Framework\Assert::assertSame($this->facultyInternalId, $full['instructor']['internal_id']);
        \PHPUnit\Framework\Assert::assertSame('Test API074 Faculty A', $full['instructor']['full_name']);
        \PHPUnit\Framework\Assert::assertSame(
            ['success', 'instructor', 'courses', 'count', 'can_edit'],
            array_keys($full)
        );
        \PHPUnit\Framework\Assert::assertSame(['test-api074-listing-a', 'test-api074-listing-b'], $this->listingIds($full['courses']));
        \PHPUnit\Framework\Assert::assertTrue($full['can_edit']);

        $specific = $this->coursesFor($I, $this->token($this->specificProxy, 'employee'), [
            'acting_for_faculty_id' => $this->facultyA,
        ]);
        \PHPUnit\Framework\Assert::assertSame(['test-api074-listing-a'], $this->listingIds($specific['courses']));
        \PHPUnit\Framework\Assert::assertTrue($specific['can_edit']);

        $viewOnly = $this->coursesFor($I, $this->token($this->viewProxy, 'employee'), [
            'acting_for_faculty_id' => $this->facultyA,
        ]);
        \PHPUnit\Framework\Assert::assertSame(['test-api074-listing-a', 'test-api074-listing-b'], $this->listingIds($viewOnly['courses']));
        \PHPUnit\Framework\Assert::assertFalse($viewOnly['can_edit']);
    }

    public function instructorCoursesRejectMissingAndRevokedDesigneeGrants(FunctionalTester $I)
    {
        $token = $this->token($this->unrelatedEmployee, 'employee');
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->amOnRoute('course-assignments/instructor-courses', ['acting_for_faculty_id' => $this->facultyA]);
        $I->seeResponseCodeIs(403);

        $this->insertGrant(
            'test-api074-revoked-faculty',
            $this->unrelatedEmployee,
            FacultyProxyPermission::PERMISSION_FULL_ACCESS,
            FacultyProxyPermission::STATUS_REVOKED
        );
        $I->amOnRoute('course-assignments/instructor-courses', ['acting_for_faculty_id' => 'test-api074-revoked-faculty']);
        $I->seeResponseCodeIs(403);
    }

    public function missingFacultyRosterReturnsScopedCoursesOrReinviteConflict(FunctionalTester $I)
    {
        $this->insertGrant(
            'test-api074-null-roster-faculty',
            'test-api074-null-roster-specific',
            FacultyProxyPermission::PERMISSION_SPECIFIC_COURSES,
            FacultyProxyPermission::STATUS_ACTIVE,
            ['test-api074-listing-a']
        );
        $this->insertGrant(
            'test-api074-null-roster-faculty',
            'test-api074-null-roster-full',
            FacultyProxyPermission::PERMISSION_FULL_ACCESS,
            FacultyProxyPermission::STATUS_ACTIVE
        );

        $specific = $this->coursesFor($I, $this->token('test-api074-null-roster-specific', 'employee'), [
            'acting_for_faculty_id' => 'test-api074-null-roster-faculty',
        ]);
        \PHPUnit\Framework\Assert::assertNull($specific['instructor']['internal_id']);
        \PHPUnit\Framework\Assert::assertSame(1, $specific['count']);
        \PHPUnit\Framework\Assert::assertSame('test-api074-listing-a', $specific['courses'][0]['folio_course']['courseListingId']);
        \PHPUnit\Framework\Assert::assertSame('test-api074-listing-a', $specific['courses'][0]['assignment']['folio_course_listing_id']);
        \PHPUnit\Framework\Assert::assertTrue($specific['can_edit']);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token('test-api074-null-roster-full', 'employee'));
        $I->amOnRoute('course-assignments/instructor-courses', [
            'acting_for_faculty_id' => 'test-api074-null-roster-faculty',
        ]);
        $I->seeResponseCodeIs(409);
        $error = json_decode($I->grabPageSource(), true);
        \PHPUnit\Framework\Assert::assertSame('proxy_roster_unavailable', $error['error_code']);
        \PHPUnit\Framework\Assert::assertStringContainsString('re-invite', $error['message']);
    }

    public function invitationStoresFacultyInternalIdFromTheToken(FunctionalTester $I)
    {
        $table = \Yii::$app->db->schema->getTableSchema('faculty_proxy_permissions');
        \PHPUnit\Framework\Assert::assertNotNull(
            $table->getColumn('faculty_internal_id'),
            'The API-074 migration must add faculty_internal_id before this endpoint test runs.'
        );

        $facultyToken = $this->token('test-api074-inviting-faculty', 'faculty', '999007406', 'Test API074 Inviting Faculty');
        $I->haveHttpHeader('Authorization', 'Bearer ' . $facultyToken);
        $I->sendAjaxRequest('POST', \Yii::$app->urlManager->createUrl(['faculty-proxy/invite-proxy']), [
            'proxy_email' => 'test-api074-invite@example.test',
            'permission_type' => 'full_access',
            'faculty_internal_id' => '999000000',
        ]);
        $I->seeResponseCodeIs(200);

        $grant = FacultyProxyPermission::find()->where([
            'faculty_shibboleth_id' => 'test-api074-inviting-faculty',
            'proxy_email' => 'test-api074-invite@example.test',
        ])->one();
        \PHPUnit\Framework\Assert::assertNotNull($grant);
        \PHPUnit\Framework\Assert::assertSame('999007406', $grant->faculty_internal_id);
        \PHPUnit\Framework\Assert::assertNotSame('999000000', $grant->faculty_internal_id);
    }

    private function listFor(FunctionalTester $I, $token)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->amOnRoute('faculty-submission/index');
        $I->seeResponseCodeIs(200);
        return json_decode($I->grabPageSource(), true);
    }

    private function coursesFor(FunctionalTester $I, $token, array $query = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->amOnRoute('course-assignments/instructor-courses', $query);
        $I->seeResponseCodeIs(200);
        return json_decode($I->grabPageSource(), true);
    }

    private function titles(array $response)
    {
        $titles = array_column($response['items'], 'course_title');
        sort($titles);
        return $titles;
    }

    private function assertTitles(array $response, array $expected)
    {
        sort($expected);
        \PHPUnit\Framework\Assert::assertSame($expected, $this->titles($response));
    }

    private function accessFor(array $response, $title)
    {
        foreach ($response['items'] as $item) {
            if ($item['course_title'] === $title) {
                return $item;
            }
        }
        throw new \RuntimeException('Missing synthetic submission from list: ' . $title);
    }

    private function listingIds(array $courses)
    {
        $ids = [];
        foreach ($courses as $course) {
            $folioCourse = $course['folio_course'] ?? null;
            if (isset($folioCourse['courseListingId'])) {
                $ids[] = $folioCourse['courseListingId'];
            } elseif (is_array($folioCourse)) {
                foreach ($folioCourse as $result) {
                    if (is_array($result) && isset($result['courseListingId'])) {
                        $ids[] = $result['courseListingId'];
                    }
                }
            }
        }
        sort($ids);
        return $ids;
    }

    private function token($userId, $role, $internalId = null, $fullName = 'Test API074 User')
    {
        return JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $userId,
            'id' => $userId,
            'role' => $role,
            'full_name' => $fullName,
            'email' => $userId . '@example.test',
            'institution' => 'SM',
            'internal_id' => $internalId,
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertAssignment($internalId, $courseId, $courseTitle)
    {
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => 'AP_209901',
            'course_id' => $courseId,
            'course_title' => $courseTitle,
            'smith_id' => $internalId,
            'role' => 'Instructor',
        ])->execute();
    }

    private function insertSubmission($owner, $suffix, $courseCode, $section, $listingId)
    {
        \Yii::$app->db->createCommand()->insert('faculty_submissions', [
            'shibboleth_user_id' => $owner,
            'term_code' => 'Fall 2099',
            'course_code' => $courseCode,
            'section' => $section,
            'course_title' => 'test-api074-' . $suffix,
            'folio_course_listing_id' => $listingId,
            'status' => 'submitted',
        ])->execute();
    }

    private function insertGrant(
        $facultyId,
        $proxyId,
        $permissionType,
        $status = FacultyProxyPermission::STATUS_ACTIVE,
        array $courseIds = [],
        $expiresAt = null,
        $facultyInternalId = null
    ) {
        $attributes = [
            'faculty_shibboleth_id' => $facultyId,
            'proxy_shibboleth_id' => $proxyId,
            'faculty_display_name' => 'Test API074 Faculty A',
            'proxy_display_name' => 'Test API074 Proxy',
            'proxy_email' => $proxyId . '@example.test',
            'permission_type' => $permissionType,
            'status' => $status,
            'expires_at' => $expiresAt,
        ];
        $table = \Yii::$app->db->schema->getTableSchema('faculty_proxy_permissions');
        if ($facultyInternalId !== null && $table->getColumn('faculty_internal_id') !== null) {
            $attributes['faculty_internal_id'] = $facultyInternalId;
        }

        \Yii::$app->db->createCommand()->insert('faculty_proxy_permissions', $attributes)->execute();
        $permissionId = (int) \Yii::$app->db->getLastInsertID();
        foreach ($courseIds as $courseId) {
            \Yii::$app->db->createCommand()->insert('faculty_proxy_course_permissions', [
                'permission_id' => $permissionId,
                'folio_course_listing_id' => $courseId,
                'course_title' => 'Test API074 permitted course',
                'term_id' => 'test-api074-term',
            ])->execute();
        }
        return $permissionId;
    }

    private function cleanupFixtures()
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('faculty_proxy_permissions', [
            'or',
            ['like', 'faculty_shibboleth_id', 'test-api074-%', false],
            ['like', 'proxy_shibboleth_id', 'test-api074-%', false],
        ])->execute();
        $db->createCommand()->delete('faculty_proxy_activity_log', [
            'or',
            ['like', 'faculty_shibboleth_id', 'test-api074-%', false],
            ['like', 'proxy_shibboleth_id', 'test-api074-%', false],
        ])->execute();
        $db->createCommand()->delete('faculty_submissions', ['like', 'course_title', 'test-api074-%', false])->execute();
        $db->createCommand()->delete('course_assignments', ['smith_id' => [
            '999007401', '999007402', '999007405',
        ]])->execute();
    }
}

class TestApi074FolioService
{
    private $courses = [
        'test-api074-listing-a' => [
            'id' => 'test-api074-course-a',
            'courseNumber' => 'TST 074',
            'name' => 'Test API074 course A',
            'courseListingId' => 'test-api074-listing-a',
            'courseListingObject' => ['id' => 'test-api074-listing-a', 'termId' => 'test-api074-term'],
            'sectionName' => '01',
        ],
        'test-api074-listing-b' => [
            'id' => 'test-api074-course-b',
            'courseNumber' => 'TST 075',
            'name' => 'Test API074 course B',
            'courseListingId' => 'test-api074-listing-b',
            'courseListingObject' => ['id' => 'test-api074-listing-b', 'termId' => 'test-api074-term'],
            'sectionName' => '02',
        ],
        'test-api074-listing-c' => [
            'id' => 'test-api074-course-c',
            'courseNumber' => 'TST 076',
            'name' => 'Test API074 course C',
            'courseListingId' => 'test-api074-listing-c',
            'courseListingObject' => ['id' => 'test-api074-listing-c', 'termId' => 'test-api074-term'],
            'sectionName' => '03',
        ],
        'test-api074-listing-own' => [
            'id' => 'test-api074-course-own',
            'courseNumber' => 'TST 077',
            'name' => 'Test API074 proxy own course',
            'courseListingId' => 'test-api074-listing-own',
            'courseListingObject' => ['id' => 'test-api074-listing-own', 'termId' => 'test-api074-term'],
            'sectionName' => '01',
        ],
    ];

    public function searchTerms()
    {
        return [[
            'id' => 'test-api074-term',
            'name' => 'Fall 2099',
            'startDate' => '2099-01-01',
            'endDate' => '2099-12-31',
        ]];
    }

    public function searchCourses($query)
    {
        foreach ($this->courses as $listingId => $course) {
            if (strpos($query, $listingId) !== false || strpos($query, $course['courseNumber']) !== false) {
                return $course;
            }
        }
        return null;
    }
}
