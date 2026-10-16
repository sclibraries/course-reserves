<?php

use app\models\SubmissionCommunication;
use app\services\FolioService;
use PHPUnit\Framework\Assert;

/** Exercises staff-only linking, the event log, and the processing gate. */
class Api080WorkflowLinkCest extends BaseFunctionalCest
{
    private $prefix = 'test-api080-flow-';
    private $folio;
    private $staffToken;
    private $adminToken;
    private $facultyToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->folio = new TestApi080WorkflowFolioService();
        \Yii::$container->set(FolioService::class, $this->folio);
        $this->cleanup();
        $this->staffToken = $this->token('staff');
        $this->adminToken = $this->token('admin');
        $this->facultyToken = $this->token('faculty');
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        \Yii::$container->clear(FolioService::class);
    }

    public function candidatesReturnExactPossibleAndNoneMatches(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('candidates');
        $this->folio->searchResults = [
            $this->listing('candidate-exact'),
            $this->listing('candidate-section', ['sectionName' => '02']),
            $this->listing('candidate-course', ['courseNumber' => 'AFR 156']),
        ];

        $this->get($I, 'workflow/submission/' . $uuid . '/candidates', $this->staffToken);

        $I->seeResponseCodeIs(200);
        $items = $this->response($I)['items'];
        Assert::assertSame(['exact', 'possible', 'none'], array_column($items, 'match'));
        Assert::assertSame('test-api080-flow-candidate-exact', $items[0]['folio_course_listing_id']);
        Assert::assertSame(['course_number' => true, 'section' => true, 'term' => true], $items[0]['fields']);
        Assert::assertArrayHasKey('checked_at', $this->response($I));
    }

    public function exactLinkUsesFetchedFolioDataAndWritesTimelineEvent(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('exact-link');
        $listing = $this->listing('exact-link');
        $this->folio->addListing($listing);

        $this->post($I, 'workflow/submission/' . $uuid . '/link', [
            'folio_course_listing_id' => $listing['courseListingId'],
            'selectedCourse' => ['courseNumber' => 'FORGED 999', 'sectionName' => '99'],
        ], $this->staffToken);

        $I->seeResponseCodeIs(200);
        $response = $this->response($I);
        Assert::assertSame('linked', $response['link_state']);
        Assert::assertNull($response['link_flag']);
        Assert::assertSame('test-api080-staff', $response['linked_by']);
        Assert::assertSame($listing['courseListingId'], $response['folio_course_listing_id']);
        Assert::assertSame('AFR155', $this->courseNumber($response['offering_id']));
        Assert::assertSame($listing['courseListingId'], $this->folio->lastFetchedId);

        $event = $this->event($uuid, 'linked');
        Assert::assertSame('test-api080-staff', $event['actor_username']);
        Assert::assertSame('staff', $event['actor_role']);
        Assert::assertSame('linked', json_decode($event['after_json'], true)['link_state']);

        $this->get($I, 'workflow/submission/' . $uuid . '/timeline', $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('linked', $this->response($I)['items'][0]['event_type']);
    }

    public function legacyCourseLinkRequiresExactMatchAndUsesFolioSection(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('legacy-link');
        $listing = $this->listing('legacy-link');
        $this->folio->addListing($listing);
        $this->request($I, 'POST', 'course/link-course-offering', [
            'submission_id' => $this->submissionId($uuid),
            'selectedCourse' => $listing,
        ], $this->staffToken);

        $I->seeResponseCodeIs(200);
        Assert::assertSame('1', $this->response($I)['offering']['section_name']);
        Assert::assertSame('linked', $this->event($uuid, 'linked')['event_type']);
    }

    public function linkRejectsNonExactAndReportsAlreadyLinkedBy(FunctionalTester $I)
    {
        $mismatchUuid = $this->insertSubmission('mismatch');
        $mismatch = $this->listing('mismatch', ['courseNumber' => 'AFR 156']);
        $this->folio->addListing($mismatch);
        $this->post($I, 'workflow/submission/' . $mismatchUuid . '/link', [
            'folio_course_listing_id' => $mismatch['courseListingId'],
        ], $this->staffToken);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('not_exact_match', $this->response($I)['error_code']);
        Assert::assertFalse($this->response($I)['fields']['course_number']);

        $uuid = $this->insertSubmission('double-link');
        $listing = $this->listing('double-link');
        $this->folio->addListing($listing);
        $payload = ['folio_course_listing_id' => $listing['courseListingId']];
        $this->post($I, 'workflow/submission/' . $uuid . '/link', $payload, $this->staffToken);
        $I->seeResponseCodeIs(200);
        $this->post($I, 'workflow/submission/' . $uuid . '/link', $payload, $this->adminToken);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('already_linked', $this->response($I)['error_code']);
        Assert::assertSame('test-api080-staff', $this->response($I)['linked_by']);
    }

    public function correctionChangesOnlyCourseAndSectionAndMessagesFaculty(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('correct');
        $this->post($I, 'workflow/submission/' . $uuid . '/correct', [
            'course_code' => 'AFR 156',
            'section' => '02',
            'reason' => 'Corrected from the roster record',
        ], $this->staffToken);
        $I->seeResponseCodeIs(200);
        $response = $this->response($I);
        Assert::assertSame('AFR 156', $response['course_code']);
        Assert::assertSame('02', $response['section']);
        Assert::assertSame('Fall 2027', $response['term_code']);

        $message = SubmissionCommunication::find()->where([
            'submission_id' => $this->submissionId($uuid),
        ])->one();
        Assert::assertNotNull($message);
        Assert::assertSame(SubmissionCommunication::VISIBILITY_FACULTY, $message->visibility);
        Assert::assertSame('Library staff', $message->sender_name);
        Assert::assertStringContainsString('Corrected from the roster record', $message->message);
        Assert::assertSame('corrected', $this->event($uuid, 'corrected')['event_type']);

        $this->post($I, 'workflow/submission/' . $uuid . '/correct', [
            'term_code' => 'Spring 2028',
            'reason' => 'Term cannot be changed',
        ], $this->staffToken);
        $I->seeResponseCodeIs(422);
        Assert::assertSame('term_change_not_allowed', $this->response($I)['error_code']);
        Assert::assertSame(1, $this->eventCount($uuid));
    }

    public function overrideRequiresReasonAndFlagsTheLink(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('override');
        $listing = $this->listing('override', ['sectionName' => '03']);
        $this->folio->addListing($listing);

        $this->post($I, 'workflow/submission/' . $uuid . '/link-override', [
            'folio_course_listing_id' => $listing['courseListingId'],
        ], $this->staffToken);
        $I->seeResponseCodeIs(400);

        $this->post($I, 'workflow/submission/' . $uuid . '/link-override', [
            'folio_course_listing_id' => $listing['courseListingId'],
            'reason' => 'Owner approved the mismatch override',
        ], $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('mismatch_override', $this->response($I)['link_flag']);
        Assert::assertSame('link_override', $this->event($uuid, 'link_override')['event_type']);
    }

    public function unlinkWorksBeforeMaterializationAndIsBlockedAfter(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('unlink');
        $listing = $this->listing('unlink');
        $this->folio->addListing($listing);
        $this->post($I, 'workflow/submission/' . $uuid . '/link', [
            'folio_course_listing_id' => $listing['courseListingId'],
        ], $this->staffToken);
        $I->seeResponseCodeIs(200);

        $this->post($I, 'workflow/submission/' . $uuid . '/unlink', [
            'reason' => 'The faculty request needs relinking',
        ], $this->staffToken);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('needs_linking', $this->response($I)['link_state']);
        Assert::assertNull($this->response($I)['offering_id']);
        Assert::assertSame('unlinked', $this->event($uuid, 'unlinked')['event_type']);

        $this->post($I, 'workflow/submission/' . $uuid . '/link', [
            'folio_course_listing_id' => $listing['courseListingId'],
        ], $this->staffToken);
        $I->seeResponseCodeIs(200);
        $itemId = $this->insertItem($uuid, ['materialized_at' => date('Y-m-d H:i:s')]);
        $this->post($I, 'workflow/submission/' . $uuid . '/unlink', [
            'reason' => 'This published item must stay linked',
        ], $this->staffToken);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('items_published', $this->response($I)['error_code']);
        Assert::assertNotNull($itemId);
    }

    public function allWorkflowAndChecklistWritesRejectAnUnlinkedSubmission(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('gate');
        $itemId = $this->insertItem($uuid);
        $templateId = $this->insertChecklistTemplate();
        $templateTaskId = $this->insertTemplateTask($templateId);
        $checklistId = $this->insertChecklist($itemId, $templateId);
        $taskId = $this->insertChecklistTask($checklistId, $templateTaskId);
        $requests = [
            ['POST', 'submission-workflow/claim-item', [], ['itemId' => $itemId]],
            ['PUT', 'submission-workflow/update-item', ['item_status' => 'in_progress'], ['itemId' => $itemId]],
            ['POST', 'submission-workflow/complete-processing', [], ['itemId' => $itemId]],
            ['POST', 'checklist/assign-checklist', ['template_id' => $templateId], ['itemId' => $itemId]],
            ['PATCH', 'checklist/update-task', ['completed' => true], ['itemId' => $itemId, 'taskId' => $taskId]],
            ['POST', 'checklist/complete-checklist', [], ['itemId' => $itemId]],
        ];

        foreach ($requests as $request) {
            $this->request($I, $request[0], $request[1], $request[2], $this->staffToken, $request[3] ?? []);
            $I->seeResponseCodeIs(409);
            Assert::assertSame('submission_not_linked', $this->response($I)['error_code'], $request[1]);
        }

        $item = \app\models\SubmissionNewResource::findOne($itemId);
        Assert::assertSame('pending', $item->item_status);
        Assert::assertEmpty($item->staff_notes);
        Assert::assertSame(0, (int) \app\models\ItemChecklistTask::findOne($taskId)->completed);
        Assert::assertSame($checklistId, (int) \app\models\ItemChecklist::findOne(['submission_item_id' => $itemId])->id);
    }

    public function timelineIsStaffOnly(FunctionalTester $I)
    {
        $uuid = $this->insertSubmission('private-timeline');
        $this->get($I, 'workflow/submission/' . $uuid . '/timeline', $this->facultyToken);
        $I->seeResponseCodeIs(403);
    }

    private function post(FunctionalTester $I, $route, array $payload, $token)
    {
        $this->request($I, 'POST', $route, $payload, $token);
    }

    private function get(FunctionalTester $I, $route, $token)
    {
        $this->request($I, 'GET', $route, [], $token);
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, $token, array $routeParams = [])
    {
        if (preg_match('#^workflow/submission/([^/]+)/([^/]+)$#', $route, $matches)) {
            $route = 'workflow-link/' . $matches[2];
            $routeParams['uuid'] = $matches[1];
        }
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonRequest($method, $route, $payload, $routeParams);
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
            'username' => 'test-api080-' . $role,
            'role' => $role,
            'id' => 'test-api080-' . $role,
            'full_name' => 'Synthetic API080 User',
            'email' => 'test-api080-' . $role . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertSubmission($suffix, array $overrides = [])
    {
        $uuid = $this->uuid();
        $values = array_merge([
            'submission_uuid' => $uuid,
            'shibboleth_user_id' => $this->prefix . $suffix,
            'term_code' => 'Fall 2027',
            'course_code' => 'AFR 155',
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'status' => 'submitted',
            'its_course_id' => 'AFR-155-01-202701',
            'academic_period' => 'AP_202701',
            'roster_term_id' => 'test-api080-term-1',
        ], $overrides);
        \Yii::$app->db->createCommand()->insert('faculty_submissions', $values)->execute();
        return $uuid;
    }

    private function insertItem($uuid, array $overrides = [])
    {
        $submissionId = $this->submissionId($uuid);
        $values = array_merge([
            'submission_id' => $submissionId,
            'resource_data' => json_encode(['title' => 'Synthetic API080 item']),
            'item_status' => 'pending',
            'display_order' => 1,
        ], $overrides);
        \Yii::$app->db->createCommand()->insert('submission_new_resources', $values)->execute();
        return (int) \Yii::$app->db->getLastInsertID();
    }

    private function insertChecklistTemplate()
    {
        \Yii::$app->db->createCommand()->insert('checklist_templates', [
            'name' => $this->prefix . 'template-' . bin2hex(random_bytes(4)),
            'format' => 'any',
            'is_active' => 1,
        ])->execute();
        return (int) \Yii::$app->db->getLastInsertID();
    }

    private function insertTemplateTask($templateId)
    {
        \Yii::$app->db->createCommand()->insert('checklist_template_tasks', [
            'template_id' => $templateId,
            'label' => 'Synthetic task',
            'task_order' => 1,
            'optional' => 0,
        ])->execute();
        return (int) \Yii::$app->db->getLastInsertID();
    }

    private function insertChecklist($itemId, $templateId)
    {
        \Yii::$app->db->createCommand()->insert('item_checklists', [
            'submission_item_id' => $itemId,
            'template_id' => $templateId,
        ])->execute();
        return (int) \Yii::$app->db->getLastInsertID();
    }

    private function insertChecklistTask($checklistId, $templateTaskId)
    {
        \Yii::$app->db->createCommand()->insert('item_checklist_tasks', [
            'item_checklist_id' => $checklistId,
            'template_task_id' => $templateTaskId,
            'completed' => 0,
        ])->execute();
        return (int) \Yii::$app->db->getLastInsertID();
    }

    private function submissionId($uuid)
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryScalar();
    }

    private function courseNumber($offeringId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT c.course_number FROM courses c JOIN course_offerings o ON o.course_id = c.course_id WHERE o.offering_id = :id',
            [':id' => $offeringId]
        )->queryScalar();
    }

    private function event($uuid, $eventType)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM workflow_events WHERE submission_id = :submission_id AND event_type = :event_type ORDER BY id DESC LIMIT 1',
            [':submission_id' => $this->submissionId($uuid), ':event_type' => $eventType]
        )->queryOne();
    }

    private function eventCount($uuid)
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :submission_id',
            [':submission_id' => $this->submissionId($uuid)]
        )->queryScalar();
    }

    private function listing($suffix, array $overrides = [])
    {
        $id = $this->prefix . $suffix;
        return array_merge([
            'id' => $id,
            'courseNumber' => 'AFR155',
            'name' => 'Synthetic API080 Course ' . $suffix,
            'departmentId' => 'test-api080-department',
            'departmentObject' => ['name' => 'Synthetic Department'],
            'courseListingId' => $id,
            'courseListingObject' => [
                'termId' => 'test-api080-term-1',
                'termObject' => [
                    'name' => 'Fall 2027',
                    'startDate' => '2027-01-01T00:00:00.000Z',
                    'endDate' => '2027-06-01T00:00:00.000Z',
                ],
                'locationId' => $this->prefix . 'location-' . $suffix,
                'locationObject' => ['name' => 'Synthetic Library'],
            ],
            'sectionName' => '1',
        ], $overrides);
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $submissionIds = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE course_title LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($submissionIds) {
            $communicationIds = $db->createCommand(
                'SELECT id FROM submission_communications WHERE submission_id IN (' . implode(',', array_map('intval', $submissionIds)) . ')'
            )->queryColumn();
            if ($communicationIds) {
                foreach (['submission_communication_activity', 'submission_communication_participants', 'submission_communication_reads'] as $table) {
                    $db->createCommand()->delete($table, ['communication_id' => $communicationIds])->execute();
                }
                $db->createCommand()->delete('submission_communications', ['id' => $communicationIds])->execute();
            }
            $itemIds = $db->createCommand(
                'SELECT id FROM submission_new_resources WHERE submission_id IN (' . implode(',', array_map('intval', $submissionIds)) . ')'
            )->queryColumn();
            if ($itemIds) {
                $checklistIds = (new \yii\db\Query())->select('id')->from('item_checklists')->where(['submission_item_id' => $itemIds])->column($db);
                if ($checklistIds) {
                    $db->createCommand()->delete('item_checklist_tasks', ['item_checklist_id' => $checklistIds])->execute();
                    $db->createCommand()->delete('item_checklists', ['id' => $checklistIds])->execute();
                }
            }
            if ($db->schema->getTableSchema('workflow_events')) {
                $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionIds])->execute();
            }
            foreach (['submission_new_resources', 'submission_reuse_resources', 'submission_folders'] as $table) {
                $db->createCommand()->delete($table, ['submission_id' => $submissionIds])->execute();
            }
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }

        $templateIds = (new \yii\db\Query())->select('id')->from('checklist_templates')->where(['like', 'name', $this->prefix . '%', false])->column($db);
        if ($templateIds) {
            $db->createCommand()->delete('checklist_template_tasks', ['template_id' => $templateIds])->execute();
            $db->createCommand()->delete('checklist_templates', ['id' => $templateIds])->execute();
        }
        $courseIds = (new \yii\db\Query())->select('course_id')->from('courses')->where(['like', 'location_id', $this->prefix . '%', false])->column($db);
        if ($courseIds) {
            $db->createCommand()->delete('course_offerings', ['course_id' => $courseIds])->execute();
            $db->createCommand()->delete('courses', ['course_id' => $courseIds])->execute();
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

class TestApi080WorkflowFolioService
{
    public $listings = [];
    public $searchResults = [];
    public $lastFetchedId;
    public $lastQuery;

    public function addListing(array $listing)
    {
        $this->listings[$listing['courseListingId']] = $listing;
    }

    public function fetchCourseById($id)
    {
        $this->lastFetchedId = $id;
        if (!isset($this->listings[$id])) {
            throw new \RuntimeException('FOLIO_COURSE_NOT_FOUND');
        }
        return $this->listings[$id];
    }

    public function searchCourses($query)
    {
        $this->lastQuery = $query;
        return $this->searchResults ?: null;
    }
}
