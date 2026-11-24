<?php

require_once __DIR__ . '/../_support/Api119A2ChecklistFixture.php';

use app\models\FacultySubmission;
use PHPUnit\Framework\Assert;
use yii\db\Query;

class Api119EFacultyRepresentationCest extends Api109FunctionalCest
{
    protected $prefix = 'test-api119e4-';

    private $commandClass;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->commandClass = \Yii::$app->db->commandClass;
        \Yii::$app->db->commandClass = Api119A2FailingCommand::class;
        Api119A2FailingCommand::clearConfiguration();
    }

    public function _after(FunctionalTester $I)
    {
        Api119A2FailingCommand::clearConfiguration();
        \Yii::$app->db->commandClass = $this->commandClass;
        parent::_after($I);
    }

    public function indexViewAndSubmittedSaveShareOneRepresentationPerPage(FunctionalTester $I)
    {
        $book = $this->materialTypeId('book');
        $sourceId = $this->createSource($book);
        $withItems = $this->createSubmission('represented');
        $empty = $this->createSubmission('empty-canceled');
        $this->fixtureItems($withItems, $book, $sourceId);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'created_at' => date('Y-m-d H:i:s', time() - 10),
        ], ['submission_id' => $withItems])->execute();
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'status' => FacultySubmission::STATUS_CANCELED,
            'created_at' => date('Y-m-d H:i:s', time() - 300),
        ], ['submission_id' => $empty])->execute();
        \Yii::$app->db->createCommand()->delete('submission_new_resources', [
            'submission_id' => $empty,
        ])->execute();

        $before = $this->itemState([$withItems, $empty]);
        $firstPage = $this->indexPage($I, 1);
        $secondPage = $this->indexPage($I, 2);
        Assert::assertSame($before, $this->itemState([$withItems, $empty]));
        Assert::assertSame(1, $firstPage['meta']['page']);
        Assert::assertSame(2, $secondPage['meta']['page']);
        Assert::assertSame($withItems, (int)$this->submissionId($firstPage['items'][0]['submission_uuid']));
        Assert::assertSame($empty, (int)$this->submissionId($secondPage['items'][0]['submission_uuid']));

        $indexed = $firstPage['items'][0];
        $this->assertCanonicalHeader($indexed, true);
        $this->assertSyntheticPrivateDataAbsent($indexed);
        Assert::assertSame([
            'total' => 3,
            'reuse' => 2,
            'new' => 1,
            'complete' => 2,
            'pending' => 1,
        ], $indexed['item_counts']);
        Assert::assertSame(66.7, $indexed['completion_percentage']);
        Assert::assertSame('owner', $indexed['access']);
        Assert::assertSame([1, 3], array_column($indexed['unfoldered_items'], 'display_order'));
        Assert::assertSame([2], array_column($indexed['folders'], 'display_order'));
        Assert::assertSame('new', $indexed['unfoldered_items'][0]['kind']);
        Assert::assertSame('new', $indexed['unfoldered_items'][1]['kind']);
        Assert::assertSame('reuse', $indexed['folders'][0]['items'][0]['kind']);
        Assert::assertSame(
            $indexed['unfoldered_items'][0]['id'],
            $indexed['folders'][0]['items'][0]['id']
        );

        $emptyItem = $secondPage['items'][0];
        $this->assertCanonicalHeader($emptyItem, false);
        Assert::assertSame(['total' => 0, 'reuse' => 0, 'new' => 0, 'complete' => 0, 'pending' => 0],
            $emptyItem['item_counts']);
        Assert::assertSame(0, $emptyItem['completion_percentage']);
        Assert::assertSame([], $emptyItem['folders']);
        Assert::assertSame([], $emptyItem['unfoldered_items']);

        Api119A2FailingCommand::resetQueries();
        $view = $this->facultyRequest(
            $I,
            'GET',
            \Yii::$app->urlManager->createUrl(['faculty-submission/view', 'id' => $indexed['submission_uuid']])
        );
        $this->assertNoWorkflowAssignmentRead();
        $this->assertNoWriteOrLockQueries();
        $this->assertCanonicalHeader($view, true);
        $this->assertSyntheticPrivateDataAbsent($view);
        Assert::assertSame($indexed['folders'], $view['folders']);
        Assert::assertSame($indexed['unfoldered_items'], $view['unfoldered_items']);
        Assert::assertSame([
            'pending' => 1,
            'in_progress' => 0,
            'complete' => 2,
            'unavailable' => 0,
        ], $view['status_summary']['by_status']);
        Assert::assertSame(3, $view['status_summary']['total_items']);
        Assert::assertArrayNotHasKey('raw_payload', $view['metadata']);
        Assert::assertSame($before, $this->itemState([$withItems, $empty]));

        $saved = $this->facultyRequest(
            $I,
            'PUT',
            \Yii::$app->urlManager->createUrl([
                'faculty-submission/update',
                'id' => $indexed['submission_uuid'],
            ]),
            ['submission_notes' => 'Synthetic header-only update']
        );
        $this->assertNoWorkflowAssignmentRead();
        $this->assertCanonicalHeader($saved, true);
        $this->assertSyntheticPrivateDataAbsent($saved);
        Assert::assertSame($indexed['folders'], $saved['folders']);
        Assert::assertSame($indexed['unfoldered_items'], $saved['unfoldered_items']);
        Assert::assertArrayHasKey('lock_status', $saved);
        Assert::assertSame($before, $this->itemState([$withItems, $empty]));
    }

    private function fixtureItems($submissionId, $book, $sourceId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('submission_new_resources', ['submission_id' => $submissionId])->execute();
        $folderName = 'Synthetic middle folder';
        $db->createCommand()->insert('submission_folders', [
            'submission_id' => $submissionId,
            'folder_name' => $folderName,
            'display_order' => 2,
        ])->execute();

        $this->insertNewItem($submissionId, 1190042000, $book, $sourceId, 'Root one', 1, null, null, 0, 'complete');
        $this->insertNewItem($submissionId, 1190042002, $book, $sourceId, 'Root two', 3, null, null, 1, 'needs-review');
        $db->createCommand()->insert('submission_reuse_resources', [
            'id' => 1190042000,
            'submission_id' => $submissionId,
            'source_resource_id' => $sourceId,
            'material_type_id' => $book,
            'barcode' => 'synthetic-reuse-barcode',
            'call_number' => 'Synthetic reuse call number',
            'display_order' => 2,
            'folder_name' => $folderName,
            'position_in_folder' => 1,
            'item_status' => 'complete',
            'public_note' => 'test-staff-public-note',
        ])->execute();
        $db->createCommand()->insert('submission_metadata', [
            'submission_id' => $submissionId,
            'total_items' => 3,
            'total_folders' => 1,
            'items_in_folders' => 1,
            'ungrouped_items' => 2,
            'submitted_by_email' => 'private@example.test',
            'raw_payload' => 'private synthetic payload',
        ])->execute();
    }

    private function insertNewItem($submissionId, $id, $book, $sourceId, $title, $order, $folder, $position, $isReuse, $status)
    {
        \Yii::$app->db->createCommand()->insert('submission_new_resources', [
            'id' => $id,
            'submission_id' => $submissionId,
            'material_type_id' => $book,
            'is_reuse' => $isReuse,
            'source_resource_id' => $isReuse ? (string)$sourceId : null,
            'resource_data' => json_encode(['title' => 'Synthetic ' . $title, 'materialType' => 'book']),
            'display_order' => $order,
            'folder_name' => $folder,
            'position_in_folder' => $position,
            'item_status' => $status,
            'public_note' => 'test-staff-public-note',
        ])->execute();
    }

    private function indexPage(FunctionalTester $I, $page)
    {
        $counter = new \ReflectionProperty(\yii\data\BaseDataProvider::class, 'counter');
        $counter->setAccessible(true);
        $counter->setValue(null, 0);
        Api119A2FailingCommand::resetQueries();
        $response = $this->facultyRequest(
            $I,
            'GET',
            \Yii::$app->urlManager->createUrl([
                'faculty-submission/index',
                'per-page' => 1,
                'page' => $page,
            ])
        );
        $reads = array_values(array_filter(Api119A2FailingCommand::queries(), function ($sql) {
            return preg_match('/^\\s*SELECT\\b/i', $sql)
                && preg_match('/\\bFROM\\s+`?(submission_folders|submission_new_resources|submission_reuse_resources)`?\\b/i', $sql);
        }));
        Assert::assertCount(3, $reads, 'Expected one bulk folder/new/reuse read for the page');
        $this->assertNoWorkflowAssignmentRead();
        $this->assertNoWriteOrLockQueries();

        return $response;
    }

    private function assertCanonicalHeader(array $submission, $canEdit)
    {
        Assert::assertArrayHasKey('folders', $submission);
        Assert::assertArrayHasKey('unfoldered_items', $submission);
        Assert::assertSame($canEdit, $submission['can_edit']);
        Assert::assertArrayNotHasKey('newResources', $submission);
        Assert::assertArrayNotHasKey('reuseResources', $submission);
        Assert::assertArrayNotHasKey('ungrouped_items', $submission);
    }

    private function assertSyntheticPrivateDataAbsent(array $response)
    {
        $json = json_encode($response);
        foreach (['test-staff-public-note', 'private@example.test', 'private synthetic payload'] as $sentinel) {
            Assert::assertStringNotContainsString($sentinel, $json);
        }
    }

    private function assertNoWorkflowAssignmentRead()
    {
        $reads = array_filter(Api119A2FailingCommand::queries(), function ($sql) {
            return preg_match('/\\bFROM\\s+`?submission_workflow_assignments`?\\b/i', $sql);
        });
        Assert::assertCount(0, $reads, 'The faculty header must not load workflowAssignment');
    }

    private function assertNoWriteOrLockQueries()
    {
        $writesOrLocks = array_filter(Api119A2FailingCommand::queries(), function ($sql) {
            return preg_match('/^\\s*(INSERT|UPDATE|DELETE|REPLACE|START TRANSACTION)\\b/i', $sql)
                || preg_match('/\\b(FOR UPDATE|LOCK IN SHARE MODE)\\b/i', $sql);
        });
        Assert::assertCount(0, $writesOrLocks, 'Faculty GETs must not write or lock rows');
    }

    private function itemState(array $submissionIds)
    {
        $db = \Yii::$app->db;
        return [
            'folders' => (new Query())->from('submission_folders')
                ->where(['submission_id' => $submissionIds])->orderBy(['folder_id' => SORT_ASC])->all(),
            'new' => (new Query())->from('submission_new_resources')
                ->where(['submission_id' => $submissionIds])->orderBy(['id' => SORT_ASC])->all(),
            'reuse' => (new Query())->from('submission_reuse_resources')
                ->where(['submission_id' => $submissionIds])->orderBy(['id' => SORT_ASC])->all(),
        ];
    }

    private function submissionId($uuid)
    {
        return \Yii::$app->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryScalar();
    }

    private function facultyRequest(FunctionalTester $I, $method, $url, ?array $payload = null)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->facultyToken());
        if ($payload === null) {
            $I->sendAjaxRequest($method, $url);
        } else {
            $I->sendAjaxRequest($method, $url, $payload);
        }
        $I->seeResponseCodeIs(200);
        return $this->response($I);
    }

    private function facultyToken()
    {
        $username = $this->prefix . 'faculty';
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => 'faculty',
            'id' => $username,
            'internal_id' => '999119004',
            'full_name' => 'Synthetic API-119E4 Faculty',
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }
}
