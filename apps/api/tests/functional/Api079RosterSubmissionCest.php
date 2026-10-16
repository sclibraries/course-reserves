<?php

use app\models\FacultyProxyPermission;
use app\services\FolioService;
use PHPUnit\Framework\Assert;

/**
 * Verifies that complete submissions use the authenticated owner's exact ITS roster course.
 */
class Api079RosterSubmissionCest extends BaseFunctionalCest
{
    private $ownerId = 'test-api079-owner';
    private $ownerSmithId = '999007901';
    private $proxySmithId = '999007902';
    private $facultyInternalId = '999007903';
    private $rosterCourseId = 'TST-101-01-209902';
    private $academicPeriod = 'AP_209902';
    private $ownerToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        \Yii::$container->set(FolioService::class, new TestApi079FolioService());
        $this->cleanupFixtures();
        $this->insertAssignment(
            $this->ownerSmithId,
            $this->rosterCourseId,
            $this->academicPeriod,
            'test-api079-roster-title'
        );
        $this->ownerToken = $this->token($this->ownerId, 'faculty', $this->ownerSmithId);
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanupFixtures();
        \Yii::$container->clear(FolioService::class);
    }

    public function ownSubmissionUsesRosterRowAndReturnsRosterFields(FunctionalTester $I)
    {
        $this->postComplete($I, $this->ownerToken, 'own', [
            'its_course_id' => $this->rosterCourseId,
            'academic_period' => $this->academicPeriod,
        ]);

        $I->seeResponseCodeIs(200);
        $response = $this->response($I);
        Assert::assertSame($this->rosterCourseId, $response['submission']['its_course_id']);
        Assert::assertSame($this->academicPeriod, $response['submission']['academic_period']);
        Assert::assertSame('Roster Term A', $response['submission']['term_code']);
        Assert::assertSame('TST 101', $response['submission']['course_code']);
        Assert::assertSame('01', $response['submission']['section']);
        Assert::assertSame('test-api079-roster-title', $response['submission']['course_title']);

        $submission = $this->submissionByOwner($this->ownerId);
        Assert::assertSame($this->rosterCourseId, $submission['its_course_id']);
        Assert::assertSame($this->academicPeriod, $submission['academic_period']);
        Assert::assertSame('test-api079-term-a', $submission['roster_term_id']);
        Assert::assertSame('Roster Term A', $submission['term_code']);
        Assert::assertSame('TST 101', $submission['course_code']);
        Assert::assertSame('01', $submission['section']);
        Assert::assertSame('test-api079-roster-title', $submission['course_title']);
    }

    public function ownSubmissionSucceedsWhenFolioTermsAreUnavailable(FunctionalTester $I)
    {
        $this->useFolioTerms([]);
        $this->postComplete($I, $this->ownerToken, 'own-no-folio-terms', [
            'its_course_id' => $this->rosterCourseId,
            'academic_period' => $this->academicPeriod,
        ]);

        $I->seeResponseCodeIs(200);
        $submission = $this->submissionByOwner($this->ownerId);
        Assert::assertSame($this->rosterCourseId, $submission['its_course_id']);
        Assert::assertSame($this->academicPeriod, $submission['academic_period']);
        Assert::assertNull($submission['roster_term_id']);
        Assert::assertSame($this->academicPeriod, $submission['term_code']);
        Assert::assertSame('TST 101', $submission['course_code']);
        Assert::assertSame('01', $submission['section']);
        Assert::assertSame('test-api079-roster-title', $submission['course_title']);
    }

    public function missingRosterFieldsReturn422(FunctionalTester $I)
    {
        $this->postComplete($I, $this->ownerToken, 'missing', []);

        $I->seeResponseCodeIs(422);
        Assert::assertSame('roster_course_required', $this->response($I)['error_code']);
        Assert::assertNull($this->submissionByTitle('missing'));
    }

    public function wrongCoursePeriodAndTeachingAssistantRowsReturn403(FunctionalTester $I)
    {
        $this->insertAssignment(
            $this->ownerSmithId,
            'TST-102-02-209902',
            $this->academicPeriod,
            'Teaching assistant course',
            'TA'
        );
        $cases = [
            ['wrong-course', 'TST-999-99-209902', $this->academicPeriod],
            ['wrong-period', $this->rosterCourseId, 'AP_209908'],
            ['ta-row', 'TST-102-02-209902', $this->academicPeriod],
        ];

        foreach ($cases as $case) {
            $this->postComplete($I, $this->ownerToken, $case[0], [
                'its_course_id' => $case[1],
                'academic_period' => $case[2],
            ]);
            $I->seeResponseCodeIs(403);
            Assert::assertSame('roster_course_not_found', $this->response($I)['error_code'] ?? null);
            Assert::assertNull($this->submissionByTitle($case[0]));
        }
    }

    public function unparseableInstructorCourseIdRemainsForbidden(FunctionalTester $I)
    {
        $this->insertAssignment(
            $this->ownerSmithId,
            'unparseable',
            $this->academicPeriod,
            'test-api079-unparseable-course'
        );
        $this->postComplete($I, $this->ownerToken, 'unparseable-course', [
            'its_course_id' => 'unparseable',
            'academic_period' => $this->academicPeriod,
        ]);

        $I->seeResponseCodeIs(403);
        Assert::assertSame('roster_course_not_found', $this->response($I)['error_code'] ?? null);
        Assert::assertNull($this->submissionByTitle('unparseable-course'));
    }

    public function coInstructorCanSubmitItsRosterCourse(FunctionalTester $I)
    {
        $coInstructorId = 'test-api079-co-instructor';
        $coInstructorSmithId = '999007905';
        $courseId = 'TST-103-03-209902';
        $this->insertAssignment($coInstructorSmithId, $courseId, $this->academicPeriod, 'test-api079-co-instructor-roster');

        $this->postComplete($I, $this->token($coInstructorId, 'faculty', $coInstructorSmithId), 'co-instructor', [
            'its_course_id' => $courseId,
            'academic_period' => $this->academicPeriod,
        ]);

        $I->seeResponseCodeIs(200);
        $submission = $this->submissionByOwner($coInstructorId);
        Assert::assertSame($coInstructorId, $submission['shibboleth_user_id']);
        Assert::assertSame($courseId, $submission['its_course_id']);
        Assert::assertSame('test-api079-co-instructor-roster', $submission['course_title']);
    }

    public function proxyUsesFacultyRosterIdentityAndRequiresGrantRosterIdentity(FunctionalTester $I)
    {
        $proxyId = 'test-api079-proxy';
        $proxyToken = $this->token($proxyId, 'employee', $this->proxySmithId);
        $this->insertAssignment(
            $this->facultyInternalId,
            'TST-104-04-209902',
            $this->academicPeriod,
            'test-api079-proxy-roster-title'
        );
        $this->insertGrant($this->ownerId, $proxyId, $this->facultyInternalId);
        $this->postComplete($I, $proxyToken, 'proxy', [
            'acting_for_faculty_id' => $this->ownerId,
            'its_course_id' => 'TST-104-04-209902',
            'academic_period' => $this->academicPeriod,
        ]);

        $I->seeResponseCodeIs(200);
        $submission = $this->submissionByOwner($this->ownerId, $proxyId);
        Assert::assertSame($this->ownerId, $submission['shibboleth_user_id']);
        Assert::assertSame($proxyId, $submission['proxy_shibboleth_user_id']);
        Assert::assertArrayHasKey('its_course_id', $submission);
        Assert::assertSame('TST-104-04-209902', $submission['its_course_id']);
        Assert::assertSame('test-api079-term-a', $submission['roster_term_id']);
        Assert::assertSame('Roster Term A', $submission['term_code']);
        Assert::assertSame('test-api079-proxy-roster-title', $submission['course_title']);
        Assert::assertSame('test-api079-proxy-roster-title', $this->response($I)['submission']['course_title']);

        $nullRosterProxy = 'test-api079-null-roster-proxy';
        $this->insertGrant($this->ownerId, $nullRosterProxy, null);
        $this->postComplete(
            $I,
            $this->token($nullRosterProxy, 'employee', $this->proxySmithId),
            'proxy-null-roster',
            [
                'acting_for_faculty_id' => $this->ownerId,
                'its_course_id' => $this->rosterCourseId,
                'academic_period' => $this->academicPeriod,
            ]
        );
        $I->seeResponseCodeIs(409);
        Assert::assertSame('proxy_roster_unavailable', $this->response($I)['error_code']);
        Assert::assertNull($this->submissionByTitle('proxy-null-roster'));
    }

    public function proxySubmissionSucceedsWhenFolioTermsAreUnavailable(FunctionalTester $I)
    {
        $proxyId = 'test-api079-proxy-no-folio';
        $courseId = 'TST-108-08-209902';
        $this->useFolioTerms([]);
        $this->insertAssignment(
            $this->facultyInternalId,
            $courseId,
            $this->academicPeriod,
            'test-api079-proxy-no-folio-title'
        );
        $this->insertGrant($this->ownerId, $proxyId, $this->facultyInternalId);
        $this->postComplete(
            $I,
            $this->token($proxyId, 'employee', $this->proxySmithId),
            'proxy-no-folio-terms',
            [
                'acting_for_faculty_id' => $this->ownerId,
                'its_course_id' => $courseId,
                'academic_period' => $this->academicPeriod,
            ]
        );

        $I->seeResponseCodeIs(200);
        $submission = $this->submissionByOwner($this->ownerId, $proxyId);
        Assert::assertSame($courseId, $submission['its_course_id']);
        Assert::assertSame($this->academicPeriod, $submission['term_code']);
        Assert::assertNull($submission['roster_term_id']);
        Assert::assertSame('TST 108', $submission['course_code']);
        Assert::assertSame('08', $submission['section']);
        Assert::assertSame('test-api079-proxy-no-folio-title', $submission['course_title']);
    }

    public function staffMaySubmitWithOrWithoutRosterFields(FunctionalTester $I)
    {
        $staffId = 'test-api079-staff';
        $staffToken = $this->token($staffId, 'staff');
        $this->postComplete($I, $staffToken, 'staff-no-roster', [
            'acting_for_faculty_id' => $this->ownerId,
        ]);
        $I->seeResponseCodeIs(200);
        $legacyStaffSubmission = $this->submissionByTitle('staff-no-roster');
        Assert::assertArrayHasKey('its_course_id', $legacyStaffSubmission);
        Assert::assertArrayHasKey('academic_period', $legacyStaffSubmission);
        Assert::assertNull($legacyStaffSubmission['its_course_id']);
        Assert::assertNull($legacyStaffSubmission['academic_period']);
        Assert::assertSame('Client Term staff-no-roster', $legacyStaffSubmission['term_code']);

        $staffCourseId = 'TST-105-05-209902';
        $this->insertAssignment('999007906', $staffCourseId, $this->academicPeriod, 'test-api079-staff-roster-title');
        $this->postComplete($I, $staffToken, 'staff-with-roster', [
            'acting_for_faculty_id' => $this->ownerId,
            'its_course_id' => $staffCourseId,
            'academic_period' => $this->academicPeriod,
        ]);
        $I->seeResponseCodeIs(200);
        $rosteredStaffResponse = $this->response($I)['submission'];
        Assert::assertSame($staffCourseId, $rosteredStaffResponse['its_course_id'] ?? null);
        Assert::assertSame('test-api079-staff-roster-title', $rosteredStaffResponse['course_title']);
    }

    public function duplicateUsesRosterCourseAndAcademicPeriod(FunctionalTester $I)
    {
        $courseId = 'TST-106-06';
        $otherPeriod = 'AP_209908';
        $this->insertAssignment($this->ownerSmithId, $courseId, $this->academicPeriod, 'test-api079-term-a-title');
        $this->insertAssignment($this->ownerSmithId, $courseId, $otherPeriod, 'test-api079-term-b-title');

        $this->postComplete($I, $this->ownerToken, 'duplicate-first', [
            'its_course_id' => $courseId,
            'academic_period' => $this->academicPeriod,
        ]);
        $I->seeResponseCodeIs(200);
        $this->postComplete($I, $this->ownerToken, 'duplicate-same-period', [
            'its_course_id' => $courseId,
            'academic_period' => $this->academicPeriod,
        ]);
        $I->seeResponseCodeIs(400);

        $this->postComplete($I, $this->ownerToken, 'duplicate-other-period', [
            'its_course_id' => $courseId,
            'academic_period' => $otherPeriod,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('test-api079-term-b-title', $this->response($I)['submission']['course_title']);
    }

    public function facultyListIncludesRosterFieldsAndLegacyNulls(FunctionalTester $I)
    {
        $courseId = 'TST-107-07-209902';
        $this->insertAssignment($this->ownerSmithId, $courseId, $this->academicPeriod, 'test-api079-response-new');
        $this->postComplete($I, $this->ownerToken, 'response-new', [
            'its_course_id' => $courseId,
            'academic_period' => $this->academicPeriod,
        ]);
        $I->seeResponseCodeIs(200);
        $this->insertLegacySubmission('legacy-response');

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->ownerToken);
        $I->amOnRoute('faculty-submission/index');
        $I->seeResponseCodeIs(200);
        $items = $this->response($I)['items'];
        $newSubmission = $this->itemByTitle($items, 'response-new');
        $legacySubmission = $this->itemByTitle($items, 'legacy-response');
        Assert::assertSame($courseId, $newSubmission['its_course_id']);
        Assert::assertSame($this->academicPeriod, $newSubmission['academic_period']);
        Assert::assertArrayHasKey('its_course_id', $legacySubmission);
        Assert::assertArrayHasKey('academic_period', $legacySubmission);
        Assert::assertNull($legacySubmission['its_course_id']);
        Assert::assertNull($legacySubmission['academic_period']);
    }

    private function postComplete(FunctionalTester $I, $token, $suffix, array $topLevel = [])
    {
        $payload = array_merge([
            'courseInfo' => [
                'courseCode' => 'FORGED ' . $suffix,
                'courseTitle' => 'test-api079-' . $suffix,
                'section' => '99',
                'term' => 'Client Term ' . $suffix,
                'instructors' => 'Forged client instructor',
            ],
            'resources' => [],
            'folders' => [],
            'metadata' => [],
        ], $topLevel);
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendAjaxRequest(
            'POST',
            \Yii::$app->urlManager->createUrl(['faculty-submission/submit-complete']),
            $payload
        );
    }

    private function useFolioTerms(array $terms)
    {
        \Yii::$container->set(FolioService::class, new TestApi079FolioService($terms));
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
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
            'full_name' => 'Synthetic API079 User',
            'email' => $username . '@example.test',
            'institution' => 'SM',
            'internal_id' => $internalId,
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertAssignment($smithId, $courseId, $period, $title, $role = 'Instructor')
    {
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => $period,
            'course_id' => $courseId,
            'course_title' => $title,
            'smith_id' => $smithId,
            'role' => $role,
        ])->execute();
    }

    private function insertGrant($facultyId, $proxyId, $facultyInternalId)
    {
        \Yii::$app->db->createCommand()->insert('faculty_proxy_permissions', [
            'faculty_shibboleth_id' => $facultyId,
            'proxy_shibboleth_id' => $proxyId,
            'faculty_internal_id' => $facultyInternalId,
            'faculty_display_name' => 'Synthetic API079 Faculty',
            'proxy_display_name' => 'Synthetic API079 Proxy',
            'proxy_email' => $proxyId . '@example.test',
            'permission_type' => FacultyProxyPermission::PERMISSION_FULL_ACCESS,
            'status' => FacultyProxyPermission::STATUS_ACTIVE,
        ])->execute();
    }

    private function insertLegacySubmission($suffix)
    {
        \Yii::$app->db->createCommand()->insert('faculty_submissions', [
            'shibboleth_user_id' => $this->ownerId,
            'term_code' => 'Legacy Term',
            'course_code' => 'LEGACY 101',
            'section' => '01',
            'course_title' => 'test-api079-' . $suffix,
            'status' => 'submitted',
        ])->execute();
    }

    private function submissionByTitle($suffix)
    {
        $submission = \Yii::$app->db->createCommand(
            'SELECT * FROM faculty_submissions WHERE course_title = :title',
            [':title' => 'test-api079-' . $suffix]
        )->queryOne();
        return $submission ?: null;
    }

    private function submissionByOwner($ownerId, $proxyId = null)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM faculty_submissions WHERE shibboleth_user_id = :owner_id '
            . 'AND proxy_shibboleth_user_id <=> :proxy_id ORDER BY submission_id DESC LIMIT 1',
            [':owner_id' => $ownerId, ':proxy_id' => $proxyId]
        )->queryOne();
    }

    private function itemByTitle(array $items, $suffix)
    {
        foreach ($items as $item) {
            if ($item['course_title'] === 'test-api079-' . $suffix) {
                return $item;
            }
        }
        Assert::fail('Faculty submission response did not include ' . $suffix);
    }

    private function cleanupFixtures()
    {
        $db = \Yii::$app->db;
        $submissionIds = $db->createCommand(
            "SELECT submission_id FROM faculty_submissions WHERE course_title LIKE 'test-api079-%'"
        )->queryColumn();
        foreach ([
            'submission_metadata',
            'submission_new_resources',
            'submission_reuse_resources',
            'submission_folders',
        ] as $table) {
            if ($submissionIds) {
                $db->createCommand()->delete($table, ['submission_id' => $submissionIds])->execute();
            }
        }
        if ($submissionIds) {
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        $db->createCommand()->delete('faculty_proxy_activity_log', [
            'or',
            ['like', 'faculty_shibboleth_id', 'test-api079-%', false],
            ['like', 'proxy_shibboleth_id', 'test-api079-%', false],
        ])->execute();
        $db->createCommand()->delete('faculty_proxy_permissions', [
            'or',
            ['like', 'faculty_shibboleth_id', 'test-api079-%', false],
            ['like', 'proxy_shibboleth_id', 'test-api079-%', false],
        ])->execute();
        $db->createCommand()->delete('course_assignments', [
            'smith_id' => [
                $this->ownerSmithId,
                $this->proxySmithId,
                $this->facultyInternalId,
                '999007904',
                '999007905',
                '999007906',
            ],
        ])->execute();
    }
}

class TestApi079FolioService
{
    private $terms;

    public function __construct($terms = null)
    {
        $this->terms = $terms;
    }

    public function searchTerms()
    {
        if ($this->terms !== null) {
            return $this->terms;
        }

        return [
            [
                'id' => 'test-api079-term-a',
                'name' => 'Roster Term A',
                'startDate' => '2099-01-01',
                'endDate' => '2099-06-30',
            ],
            [
                'id' => 'test-api079-term-b',
                'name' => 'Roster Term B',
                'startDate' => '2099-07-01',
                'endDate' => '2099-12-31',
            ],
        ];
    }

    public function searchCourses($query)
    {
        return null;
    }
}
