<?php

use app\services\FolioService;
use PHPUnit\Framework\Assert;

/** Exercises persisted FOLIO suggestions and the staff needs-linking list. */
class Api081LinkSuggestionsCest extends BaseFunctionalCest
{
    private $prefix = 'test-api081-';
    private $folio;
    private $staffToken;
    private $facultyToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->folio = new TestApi081FolioService();
        \Yii::$container->set(FolioService::class, $this->folio);
        $this->cleanup();
        $this->staffToken = $this->token('staff');
        $this->facultyToken = $this->token('faculty');
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        \Yii::$container->clear(FolioService::class);
    }

    public function recheckStoresExactPossibleAndNoneCandidates(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('classifications');
        $this->folio->searchResults = [
            $this->listing('exact'),
            $this->listing('possible', ['sectionName' => '02']),
            $this->listing('none', [
                'sectionName' => '02',
                'courseListingObject' => [
                    'termId' => 'test-api081-term-2',
                    'termObject' => ['name' => 'Fall 2028'],
                ],
            ]),
        ];

        $this->recheck($I, $uuid, $this->staffToken);

        $I->seeResponseCodeIs(200);
        $summary = $this->response($I);
        Assert::assertSame('exact', $summary['match']);
        Assert::assertNotEmpty($summary['checked_at']);

        $this->getCandidates($I, $uuid, $this->staffToken);

        $I->seeResponseCodeIs(200);
        $items = $this->response($I)['items'];
        Assert::assertSame(['exact', 'possible', 'none'], array_column($items, 'match'));
        Assert::assertSame('test-api081-exact', $items[0]['folio_course_listing_id']);
        Assert::assertSame(['course_number' => true, 'section' => true, 'term' => true], $items[0]['fields']);
        Assert::assertNotEmpty($this->response($I)['checked_at']);
    }

    public function newlyCreatedTst102ListingBecomesExactOnNextCheck(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('tst102', ['course_code' => 'TST 102']);
        $this->folio->searchResults = [];

        $this->recheck($I, $uuid, $this->staffToken);

        $I->seeResponseCodeIs(200);
        Assert::assertSame('none', $this->response($I)['match']);

        $this->folio->searchResults[] = $this->listing('created-tst102', [
            'courseNumber' => 'TST 102',
            'name' => 'TST 102 - Synthetic test course',
        ]);
        $this->recheck($I, $uuid, $this->staffToken);

        $I->seeResponseCodeIs(200);
        Assert::assertSame('exact', $this->response($I)['match']);
        Assert::assertSame(2, $this->eventCount($uuid));
        Assert::assertSame(['suggested', 'rechecked'], $this->eventTypes($uuid));
    }

    public function folioFailureKeepsLastSuggestionAndRecordsErrorTime(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('folio-error');
        $this->folio->searchResults = [$this->listing('preserved')];
        $this->recheck($I, $uuid, $this->staffToken);
        $I->seeResponseCodeIs(200);
        $before = $this->response($I);
        $rowCount = $this->suggestionCount($uuid);
        $lastSuccessfulCheck = date('Y-m-d H:i:s', time() - 2 * 3600);
        \Yii::$app->db->createCommand()->update('link_suggestions', [
            'checked_at' => $lastSuccessfulCheck,
        ], ['submission_id' => $this->submissionId($uuid)])->execute();

        $this->folio->failCourses = true;
        $this->recheck($I, $uuid, $this->staffToken);

        $I->seeResponseCodeIs(200);
        $after = $this->response($I);
        Assert::assertSame('exact', $after['match']);
        Assert::assertSame($lastSuccessfulCheck, $after['checked_at']);
        Assert::assertNotEmpty($after['error_at']);
        Assert::assertSame($rowCount, $this->suggestionCount($uuid));
        Assert::assertNotEmpty($this->lastSuggestionErrorAt($uuid));
        Assert::assertSame(1, $this->eventCount($uuid));

        $this->getNeedsLinking($I, $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(0, $this->queuedSuggestionCount(), 'A recent failed check must not be immediately requeued.');
    }

    public function manualCandidateSearchUsesTheRosterTermAndLeavesStoredSuggestionsUntouched(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('manual-search');
        $this->folio->searchResults = [$this->listing('stored-exact')];
        $this->recheck($I, $uuid, $this->staffToken);
        $I->seeResponseCodeIs(200);

        $this->folio->searchResults = [$this->listing('manual-tst103', [
            'courseNumber' => 'TST 103',
        ])];
        $this->getCandidates($I, $uuid, $this->staffToken, 'TST 103');

        $I->seeResponseCodeIs(200);
        Assert::assertSame('test-api081-manual-tst103', $this->response($I)['items'][0]['folio_course_listing_id']);
        Assert::assertSame('none', $this->response($I)['items'][0]['match']);
        Assert::assertStringContainsString('courseNumber=="TST 103"', $this->folio->lastQuery);
        Assert::assertStringContainsString('termId=="test-api081-term-1"', $this->folio->lastQuery);

        $this->getCandidates($I, $uuid, $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('test-api081-stored-exact', $this->response($I)['items'][0]['folio_course_listing_id']);
    }

    public function needsLinkingIsOldestFirstAndReturnsIntegerIdAndWaitingHours(FunctionalTester $I)
    {
        $oldUuid = $this->insertSubmission('oldest', [
            'course_code' => 'TST 101',
            'submitted_at' => date('Y-m-d H:i:s', time() - 48 * 3600),
        ]);
        $newUuid = $this->insertSubmission('newer', [
            'course_code' => 'TST 102',
            'submitted_at' => date('Y-m-d H:i:s', time() - 3 * 3600),
        ]);
        $linkedUuid = $this->insertSubmission('already-linked', [
            'course_code' => 'TST 103',
            'link_state' => 'linked',
        ]);
        $this->folio->searchResults = [$this->listing('oldest-match')];
        $this->recheck($I, $oldUuid, $this->staffToken);
        $this->folio->searchResults = [$this->listing('newer-match', [
            'courseNumber' => 'TST 102',
            'sectionName' => '02',
        ])];
        $this->recheck($I, $newUuid, $this->staffToken);
        $this->folio->searchCalls = [];

        $this->getNeedsLinking($I, $this->staffToken, ['page' => 1, 'term' => 'Spring 2027']);

        $I->seeResponseCodeIs(200);
        $response = $this->response($I);
        Assert::assertSame(2, $response['count']);
        Assert::assertSame([
            $this->submissionId($oldUuid),
            $this->submissionId($newUuid),
        ], array_column($response['items'], 'submission_id'));
        Assert::assertNotContains($linkedUuid, array_column($response['items'], 'submission_uuid'));
        Assert::assertIsInt($response['items'][0]['submission_id']);
        Assert::assertSame('exact', $response['items'][0]['suggestion']);
        Assert::assertSame('possible', $response['items'][1]['suggestion']);
        Assert::assertGreaterThanOrEqual(47.9, $response['items'][0]['waiting_hours']);
        Assert::assertLessThan(4, $response['items'][1]['waiting_hours']);
        Assert::assertNotEmpty($response['items'][0]['checked_at']);
        Assert::assertSame([], $this->folio->searchCalls, 'Listing stale rows must not call FOLIO inline.');
    }

    public function staleListRequestsQueueOnlyABoundedNumberOfBackgroundChecks(FunctionalTester $I)
    {
        for ($index = 0; $index < 12; $index++) {
            $this->insertSubmission('stale-' . $index);
        }

        $this->getNeedsLinking($I, $this->staffToken);

        $I->seeResponseCodeIs(200);
        $queued = $this->queuedSuggestionCount();
        Assert::assertGreaterThan(0, $queued);
        Assert::assertLessThanOrEqual(10, $queued);
        Assert::assertSame($queued, $this->suggestionRowCount());
        Assert::assertSame([], $this->folio->searchCalls, 'GET must enqueue stale checks without calling FOLIO.');

        $this->getNeedsLinking($I, $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(12, $this->queuedSuggestionCount(), 'A second request may queue the remaining stale submissions.');
        Assert::assertSame(12, $this->suggestionRowCount(), 'Queued submissions must not get duplicate rows.');
    }

    public function needsLinkingRecheckAndCandidatesAreStaffOnly(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('staff-only');

        $this->getNeedsLinking($I, $this->facultyToken);
        $I->seeResponseCodeIs(403);
        $this->recheck($I, $uuid, $this->facultyToken);
        $I->seeResponseCodeIs(403);
        $this->getCandidates($I, $uuid, $this->facultyToken);
        $I->seeResponseCodeIs(403);
    }

    public function suggestionEventsAreWrittenOnlyWhenTheResultChanges(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('event-change');
        $this->folio->searchResults = [$this->listing('event-exact')];
        $this->recheck($I, $uuid, $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, $this->eventCount($uuid));

        $this->recheck($I, $uuid, $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, $this->eventCount($uuid));

        $this->folio->searchResults = [$this->listing('event-possible', ['sectionName' => '02'])];
        $this->recheck($I, $uuid, $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(2, $this->eventCount($uuid));
        Assert::assertSame(['suggested', 'rechecked'], $this->eventTypes($uuid));
    }

    public function missingRosterTermIsResolvedBeforeSuggestionWritesBegin(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('resolve-term', [
            'roster_term_id' => null,
            'academic_period' => 'AP_202701',
        ]);
        $this->folio->terms = [[
            'id' => 'test-api081-term-1',
            'name' => 'Spring 2027',
            'startDate' => '2027-01-01T00:00:00.000Z',
            'endDate' => '2027-06-01T00:00:00.000Z',
        ]];
        $this->folio->assertNoTransactionOnTermSearch = true;
        $this->folio->transactionBeforeTermSearch = \Yii::$app->db->getTransaction();
        $this->folio->searchResults = [$this->listing('resolved-term')];

        $this->recheck($I, $uuid, $this->staffToken);

        $I->seeResponseCodeIs(200);
        Assert::assertSame('exact', $this->response($I)['match']);
        Assert::assertSame($this->folio->transactionBeforeTermSearch, $this->folio->transactionDuringTermSearch);
        Assert::assertStringContainsString('termId=="test-api081-term-1"', $this->folio->searchCalls[0]);
    }

    private function recheck(FunctionalTester $I, $uuid, $token)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonRequest('POST', 'workflow-link/recheck', [], ['uuid' => $uuid]);
    }

    private function getCandidates(FunctionalTester $I, $uuid, $token, $query = null)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $params = ['uuid' => $uuid];
        if ($query !== null) {
            $params['query'] = $query;
        }
        $I->sendJsonRequest('GET', 'workflow-link/candidates', [], $params);
    }

    private function getNeedsLinking(FunctionalTester $I, $token, array $params = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonRequest('GET', 'workflow-link/needs-linking', [], $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function token($role)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => 'test-api081-' . $role,
            'role' => $role,
            'id' => 'test-api081-' . $role,
            'full_name' => 'Synthetic API081 User',
            'email' => 'test-api081-' . $role . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertSubmission($suffix, array $overrides = [])
    {
        $uuid = $this->uuid();
        $values = array_merge([
            'submission_uuid' => $uuid,
            'shibboleth_user_id' => $this->prefix . $suffix,
            'faculty_display_name' => 'Synthetic API081 Faculty',
            'term_code' => 'Spring 2027',
            'course_code' => 'TST 101',
            'section' => '01',
            'course_title' => 'Synthetic ' . $suffix,
            'status' => 'submitted',
            'its_course_id' => 'TST-101-01-202701',
            'academic_period' => 'AP_202701',
            'roster_term_id' => 'test-api081-term-1',
            'submitted_at' => date('Y-m-d H:i:s'),
            'link_state' => 'needs_linking',
        ], $overrides);
        \Yii::$app->db->createCommand()->insert('faculty_submissions', $values)->execute();
        return $uuid;
    }

    private function submissionId($uuid)
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryScalar();
    }

    private function listing($suffix, array $overrides = [])
    {
        $id = $this->prefix . $suffix;
        $courseNumber = $overrides['courseNumber'] ?? 'TST 101';
        $section = $overrides['sectionName'] ?? '1';
        $name = $overrides['name'] ?? 'Synthetic ' . $courseNumber . ' ' . $suffix;
        return array_merge([
            'id' => $id,
            'courseNumber' => $courseNumber,
            'name' => $name,
            'courseListingId' => $id,
            'sectionName' => $section,
            'courses' => [[
                'courseNumber' => $courseNumber,
                'sectionName' => $section,
                'name' => $name,
            ]],
            'courseListingObject' => [
                'termId' => 'test-api081-term-1',
                'termObject' => ['name' => 'Spring 2027'],
            ],
        ], $overrides);
    }

    private function eventCount($uuid)
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :submission_id',
            [':submission_id' => $this->submissionId($uuid)]
        )->queryScalar();
    }

    private function eventTypes($uuid)
    {
        return \Yii::$app->db->createCommand(
            'SELECT event_type FROM workflow_events WHERE submission_id = :submission_id ORDER BY id ASC',
            [':submission_id' => $this->submissionId($uuid)]
        )->queryColumn();
    }

    private function suggestionCount($uuid)
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM link_suggestions WHERE submission_id = :submission_id',
            [':submission_id' => $this->submissionId($uuid)]
        )->queryScalar();
    }

    private function lastSuggestionErrorAt($uuid)
    {
        return \Yii::$app->db->createCommand(
            'SELECT MAX(last_error_at) FROM link_suggestions WHERE submission_id = :submission_id',
            [':submission_id' => $this->submissionId($uuid)]
        )->queryScalar();
    }

    private function queuedSuggestionCount()
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(DISTINCT submission_id) FROM link_suggestions WHERE requested_at IS NOT NULL'
        )->queryScalar();
    }

    private function suggestionRowCount()
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM link_suggestions WHERE submission_id IN '
            . '(SELECT submission_id FROM faculty_submissions WHERE shibboleth_user_id LIKE :prefix)',
            [':prefix' => $this->prefix . '%']
        )->queryScalar();
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $ids = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE shibboleth_user_id LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($ids) {
            if ($db->schema->getTableSchema('link_suggestions', true)) {
                $db->createCommand()->delete('link_suggestions', ['submission_id' => $ids])->execute();
            }
            $db->createCommand()->delete('workflow_events', ['submission_id' => $ids])->execute();
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $ids])->execute();
        }
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}

class TestApi081FolioService
{
    public $searchResults = [];
    public $terms = [];
    public $searchCalls = [];
    public $lastQuery;
    public $failCourses = false;
    public $assertNoTransactionOnTermSearch = false;
    public $transactionBeforeTermSearch;
    public $transactionDuringTermSearch;

    public function searchCoursesStrict($query)
    {
        $this->searchCalls[] = $query;
        $this->lastQuery = $query;
        if ($this->failCourses) {
            throw new \RuntimeException('synthetic FOLIO outage');
        }

        $courseNumber = $this->queryValue($query, 'courseNumber');
        $termId = $this->queryValue($query, 'termId');
        $results = [];
        foreach ($this->searchResults as $listing) {
            if ($courseNumber !== null && !$this->hasCourseNumber($listing, $courseNumber)) {
                continue;
            }
            if ($termId !== null && (string)($listing['courseListingObject']['termId'] ?? '') !== $termId) {
                continue;
            }
            $results[] = $listing;
        }
        return $results ?: null;
    }

    public function searchCourses($query)
    {
        return $this->searchCoursesStrict($query);
    }

    public function searchTermsStrict()
    {
        if ($this->assertNoTransactionOnTermSearch) {
            $this->transactionDuringTermSearch = \Yii::$app->db->getTransaction();
        }
        return $this->terms;
    }

    public function searchTerms()
    {
        return $this->terms;
    }

    private function queryValue($query, $field)
    {
        if (!preg_match('/' . preg_quote($field, '/') . '=="((?:\\\\.|[^"])*)"/', $query, $matches)) {
            return null;
        }
        return stripcslashes($matches[1]);
    }

    private function hasCourseNumber(array $listing, $number)
    {
        $courses = $listing['courses'] ?? [$listing];
        foreach ($courses as $course) {
            if (strtolower(preg_replace('/\s+/', '', (string)($course['courseNumber'] ?? ''))) ===
                strtolower(preg_replace('/\s+/', '', (string)$number))) {
                return true;
            }
        }
        return false;
    }
}
