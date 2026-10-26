<?php

use app\services\FolioService;
use app\services\GoogleDocFetcher;
use app\services\GoogleDocFetcherInterface;
use PHPUnit\Framework\Assert;
use yii\db\Query;

/** Exercises staff creation of a submitted request from a syllabus. */
class Api098StaffEnteredSubmissionCest extends BaseFunctionalCest
{
    private $prefix = 'test-api098-';
    private $folio;
    private $previousFetcherDefinition;
    private $uuid;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->previousFetcherDefinition = \Yii::$container->getDefinitions()[GoogleDocFetcherInterface::class];
        \Yii::$container->set(FolioService::class, $this->folio = new TestApi098FolioService());
        $this->setGoogleFetcher();
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        \Yii::$container->clear(FolioService::class);
        \Yii::$container->set(GoogleDocFetcherInterface::class, $this->previousFetcherDefinition);
    }

    public function endpointIsStaffOnlyAndAllowsOptions(FunctionalTester $I)
    {
        $route = 'staff-entered-submission/options';
        $I->sendJsonRequest('OPTIONS', $route, []);
        $I->seeResponseCodeIs(204);

        $I->sendJsonRequest('POST', 'staff-entered-submission/create', $this->payload('auth'));
        $I->seeResponseCodeIs(401);

        $this->post($I, $this->payload('auth'), $this->token('test-api098-faculty', 'faculty'));
        $I->seeResponseCodeIs(403);

        $this->post($I, [], $this->token('test-api098-admin', 'admin'));
        $I->seeResponseCodeIs(422);
        Assert::assertSame('instructor_username_required', $this->response($I)['error_code']);
    }

    public function validatesInstructorItemsAndSyllabus(FunctionalTester $I)
    {
        $payload = $this->payload('validation');
        unset($payload['instructor_username']);
        $this->post($I, $payload);
        $I->seeResponseCodeIs(422);
        Assert::assertSame('instructor_username_required', $this->response($I)['error_code']);

        $payload = $this->payload('validation');
        $payload['items'] = [];
        $this->post($I, $payload);
        $I->seeResponseCodeIs(422);
        Assert::assertSame('items_required', $this->response($I)['error_code']);

        $payload = $this->payload('validation');
        $payload['syllabus'] = ['google_doc_url' => 'https://example.test/not-a-google-doc'];
        $this->post($I, $payload);
        $I->seeResponseCodeIs(422);
        Assert::assertSame('invalid_google_doc_url', $this->response($I)['error_code']);
        Assert::assertSame(0, $this->submissionCount('test-api098-instructor'));
    }

    public function createsLinkedSubmittedRequestOwnedByInstructor(FunctionalTester $I)
    {
        $payload = $this->payload('success');
        $this->folio->addListing($this->listing($payload));
        $this->post($I, $payload);

        $I->seeResponseCodeIs(201);
        $response = $this->response($I);
        Assert::assertArrayHasKey('submission_id', $response);
        Assert::assertNotEmpty($response['submission_uuid']);
        $this->uuid = $response['submission_uuid'];
        $submission = (new Query())->from('faculty_submissions')
            ->where(['submission_id' => $response['submission_id']])->one();

        Assert::assertSame('test-api098-instructor', $submission['shibboleth_user_id']);
        Assert::assertSame('Synthetic API098 Instructor', $submission['faculty_display_name']);
        Assert::assertSame('submitted', $submission['status']);
        Assert::assertSame('test-api098-staff', $submission['entered_by']);
        Assert::assertSame('staff_syllabus', $submission['entry_source']);
        Assert::assertSame('not_requested', $submission['email_confirmation_status']);
        Assert::assertSame(0, (int)$submission['email_confirmation_sent']);
        Assert::assertNull($submission['proxy_shibboleth_user_id']);
        Assert::assertNull($submission['proxy_display_name']);
        Assert::assertSame('linked', $submission['link_state']);
        Assert::assertSame($payload['folio_course_listing_id'], $submission['folio_course_listing_id']);
        Assert::assertGreaterThan(0, (int)$submission['offering_id']);
        Assert::assertSame(1, $this->rowCount('submission_folders', $response['submission_id']));
        Assert::assertSame(1, $this->rowCount('submission_new_resources', $response['submission_id']));
        $item = (new Query())->from('submission_new_resources')
            ->where(['submission_id' => $response['submission_id']])->one();
        Assert::assertSame('Week 1', $item['folder_name']);
        Assert::assertSame(1, $this->rowCount('submission_syllabi', $response['submission_id']));

        $this->get($I, 'submission-workflow/pending-submissions', $this->token('test-api098-staff', 'staff'));
        $I->seeResponseCodeIs(200);
        $staffList = $this->response($I);
        $listed = isset($staffList['items']) ? $staffList['items'] : $staffList;
        Assert::assertContains((int)$response['submission_id'], array_map('intval', array_column(
            $listed,
            'submission_id'
        )));

        $this->get($I, 'submission-workflow/view-submission', $this->token('test-api098-staff', 'staff'), [
            'id' => $response['submission_id'],
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('test-api098-staff', $this->response($I)['entered_by']);
        Assert::assertSame('staff_syllabus', $this->response($I)['entry_source']);

        $this->get($I, 'faculty-submission/view', $this->token('test-api098-instructor', 'faculty'), [
            'id' => $response['submission_uuid'],
        ]);
        $I->seeResponseCodeIs(200);
        $facultyResponse = $this->response($I);
        Assert::assertSame($response['submission_uuid'], $facultyResponse['submission_uuid']);
        Assert::assertArrayNotHasKey('entered_by', $facultyResponse);
        Assert::assertArrayNotHasKey('entry_source', $facultyResponse);

        $this->get($I, 'syllabus/staff-list', $this->token('test-api098-staff', 'staff'), [
            'id' => $response['submission_id'],
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('Synthetic API098 syllabus text', $this->response($I)['syllabi'][0]['extracted_text']);
    }

    public function duplicateReturnsConflict(FunctionalTester $I)
    {
        $payload = $this->payload('duplicate');
        $this->folio->addListing($this->listing($payload));
        $this->post($I, $payload);
        $I->seeResponseCodeIs(201);
        $this->uuid = $this->response($I)['submission_uuid'];

        $this->post($I, $payload);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('submission_already_exists', $this->response($I)['error_code']);
        Assert::assertSame(1, $this->submissionCount('test-api098-instructor'));
    }

    public function staffEntryRejectsInstructorDraftWithoutSideEffects(FunctionalTester $I)
    {
        $payload = $this->payload('draft-conflict');
        $submissionId = TestSubmissionFixture::create(
            '10009800-0000-4000-8000-000000000098',
            'test-api098-instructor',
            [
                'term_code' => $payload['courseInfo']['term'],
                'course_code' => $payload['courseInfo']['courseCode'],
                'section' => $payload['courseInfo']['section'],
                'course_title' => $payload['courseInfo']['courseTitle'],
                'faculty_display_name' => $payload['instructor_display_name'],
                'status' => 'draft',
            ]
        );
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'resource_data' => json_encode(['title' => 'Instructor draft reading']),
            'folder_name' => 'Instructor draft folder',
        ], ['submission_id' => $submissionId])->execute();
        \Yii::$app->db->createCommand()->insert('submission_folders', [
            'submission_id' => $submissionId,
            'folder_name' => 'Instructor draft folder',
            'display_order' => 0,
        ])->execute();
        $this->folio->addListing($this->listing($payload));
        $before = $this->draftSnapshot($submissionId);
        $filesBefore = $this->storedFiles();

        $this->post($I, $payload);

        $I->seeResponseCodeIs(409);
        Assert::assertSame('instructor_draft_exists', $this->response($I)['error_code']);
        Assert::assertSame($before, $this->draftSnapshot($submissionId));
        Assert::assertSame(0, $this->rowCount('submission_syllabi', $submissionId));
        Assert::assertSame(0, $this->rowCount('workflow_events', $submissionId));
        Assert::assertSame($filesBefore, $this->storedFiles());
        Assert::assertSame(1, $this->submissionCount('test-api098-instructor'));
    }

    public function syllabusFailureLeavesNoSubmission(FunctionalTester $I)
    {
        $this->setGoogleFetcher([
            'status' => 403,
            'headers' => ['content-type' => 'text/html'],
            'body' => '<html>Sign in</html>',
        ]);
        $this->post($I, $this->payload('syllabus-failure'));

        $I->seeResponseCodeIs(422);
        Assert::assertSame('google_doc_not_shared', $this->response($I)['error_code']);
        Assert::assertSame(0, $this->submissionCount('test-api098-instructor'));
    }

    public function linkFailureRollsBackSyllabusFileAndSubmission(FunctionalTester $I)
    {
        $payload = $this->payload('link-failure');
        $this->folio->addListing($this->listing($payload, ['sectionName' => '99']));
        $filesBefore = $this->storedFiles();
        $this->post($I, $payload);

        $I->seeResponseCodeIs(409);
        Assert::assertSame('not_exact_match', $this->response($I)['error_code']);
        Assert::assertSame(0, $this->submissionCount('test-api098-instructor'));
        Assert::assertSame($filesBefore, $this->storedFiles());
    }

    private function payload($suffix)
    {
        return [
            'folio_course_listing_id' => $this->prefix . 'listing-' . $suffix,
            'instructor_username' => ' TEST-API098-INSTRUCTOR@example.test ',
            'instructor_display_name' => 'Synthetic API098 Instructor',
            'courseInfo' => [
                'courseCode' => 'API098-' . $suffix,
                'courseTitle' => 'Synthetic API098 ' . $suffix,
                'term' => 'Fall 2027',
                'section' => '01',
            ],
            'folders' => [['id' => 'week-1', 'title' => 'Week 1', 'display_order' => 0]],
            'items' => [[
                'resource_data' => ['title' => 'Synthetic API098 reading', 'materialType' => 'book'],
                'folder_uuid' => 'week-1',
                'display_order' => 0,
            ]],
            'syllabus' => [
                'google_doc_url' => 'https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit',
            ],
        ];
    }

    private function listing(array $payload, array $overrides = [])
    {
        $id = $payload['folio_course_listing_id'];
        return array_merge([
            'id' => $id,
            'courseNumber' => $payload['courseInfo']['courseCode'],
            'name' => $payload['courseInfo']['courseTitle'],
            'departmentId' => $this->prefix . 'department',
            'departmentObject' => ['name' => 'Synthetic Department'],
            'courseListingId' => $id,
            'courseListingObject' => [
                'termId' => $this->prefix . 'term',
                'termObject' => [
                    'name' => $payload['courseInfo']['term'],
                    'startDate' => '2027-01-01T00:00:00.000Z',
                    'endDate' => '2027-06-01T00:00:00.000Z',
                ],
                'locationId' => $this->prefix . 'location',
                'locationObject' => ['name' => 'Synthetic Library'],
            ],
            'sectionName' => '1',
        ], $overrides);
    }

    private function post(FunctionalTester $I, array $payload, $token = 'test-api098-staff-token')
    {
        $token = $token === 'test-api098-staff-token' ? $this->token('test-api098-staff', 'staff') : $token;
        $this->request($I, 'POST', 'staff-entered-submission/create', $payload, $token);
    }

    private function get(FunctionalTester $I, $route, $token, array $routeParams = [])
    {
        $this->request($I, 'GET', $route, [], $token, $routeParams);
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, $token, array $routeParams = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonRequest($method, $route, $payload, $routeParams);
    }

    private function response(FunctionalTester $I)
    {
        return $I->grabJsonResponse();
    }

    private function token($username, $role)
    {
        $now = time();
        return \Firebase\JWT\JWT::encode([
            'iat' => $now,
            'exp' => $now + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'full_name' => 'Synthetic API098 user',
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function setGoogleFetcher(?array $result = null)
    {
        \Yii::$container->set(GoogleDocFetcherInterface::class, new GoogleDocFetcher(
            'https://docs.google.com',
            function () use ($result) {
                return $result ?: [
                    'status' => 200,
                    'headers' => ['content-type' => 'text/plain; charset=utf-8'],
                    'body' => 'Synthetic API098 syllabus text',
                ];
            }
        ));
    }

    private function submissionCount($owner)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM faculty_submissions WHERE shibboleth_user_id = :owner',
            [':owner' => $owner]
        )->queryScalar();
    }

    private function rowCount($table, $submissionId)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM ' . $table . ' WHERE submission_id = :id',
            [':id' => $submissionId]
        )->queryScalar();
    }

    private function draftSnapshot($submissionId)
    {
        return [
            'submission' => (new Query())->select([
                'status', 'entered_by', 'entry_source', 'link_state', 'folio_course_listing_id', 'offering_id',
            ])->from('faculty_submissions')->where(['submission_id' => $submissionId])->one(),
            'items' => (new Query())->select(['resource_data', 'folder_name', 'display_order'])
                ->from('submission_new_resources')->where(['submission_id' => $submissionId])
                ->orderBy(['display_order' => SORT_ASC])->all(),
            'folders' => (new Query())->select(['folder_name', 'display_order'])
                ->from('submission_folders')->where(['submission_id' => $submissionId])
                ->orderBy(['display_order' => SORT_ASC])->all(),
        ];
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $ids = (new Query())->select('submission_id')->from('faculty_submissions')
            ->where(['like', 'shibboleth_user_id', $this->prefix . '%'])->column();
        if ($ids) {
            $storedPaths = (new Query())->select('stored_path')->from('submission_syllabi')
                ->where(['submission_id' => $ids])->column();
            foreach (['workflow_events', 'submission_syllabi', 'submission_communications', 'submission_metadata',
                'submission_new_resources', 'submission_reuse_resources', 'submission_folders'] as $table) {
                $db->createCommand()->delete($table, ['submission_id' => $ids])->execute();
            }
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $ids])->execute();
            $this->removeStoredFiles($storedPaths);
        }
        $courseIds = (new Query())->select('course_id')->from('courses')
            ->where(['like', 'course_number', 'API098-%'])->column();
        if ($courseIds) {
            $db->createCommand()->delete('course_offerings', ['course_id' => $courseIds])->execute();
            $db->createCommand()->delete('courses', ['course_id' => $courseIds])->execute();
        }
    }

    private function removeStoredFiles(array $storedPaths)
    {
        $directory = \Yii::getAlias('@runtime/syllabi');
        foreach ($storedPaths as $storedPath) {
            $path = $directory . DIRECTORY_SEPARATOR . basename($storedPath);
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    private function storedFiles()
    {
        return glob(\Yii::getAlias('@runtime/syllabi') . '/*') ?: [];
    }
}

class TestApi098FolioService
{
    private $listings = [];

    public function addListing(array $listing)
    {
        $this->listings[$listing['courseListingId']] = $listing;
    }

    public function searchCoursesStrict($query)
    {
        if (!preg_match('/courseListingId=="([^"]+)"/', $query, $matches)) {
            return null;
        }
        return $this->listings[$matches[1]] ?? null;
    }
}
