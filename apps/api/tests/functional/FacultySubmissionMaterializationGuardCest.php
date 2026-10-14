<?php
/**
 * Functional coverage for API-033 faculty mutation protection.
 */
class FacultySubmissionMaterializationGuardCest extends BaseFunctionalCest
{
    private $shibbolethId = 'sandbox.faculty@example.test';
    private $token;
    private $staffToken;
    private $rosterSmithId = '999000131';
    private $api033SubmissionUuid;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        \Yii::$container->set(
            \app\services\FolioService::class,
            new Api033FolioServiceStub()
        );
        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => $this->rosterSmithId,
        ])->execute();
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => 'AP_209902',
            'course_id' => 'TST-API030-99-209902',
            'course_title' => 'Synthetic API-033 roster course',
            'smith_id' => $this->rosterSmithId,
            'role' => 'Instructor',
        ])->execute();

        $secretKey = getenv('JWT_SECRET_KEY');
        $issuedAt = time();
        $this->token = \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => $this->shibbolethId,
            'role' => 'faculty',
            'id' => 0,
            'full_name' => 'Test Faculty',
            'email' => $this->shibbolethId,
            'institution' => 'SM',
            'internal_id' => $this->rosterSmithId,
        ], $secretKey, 'HS256');
        $this->staffToken = \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => 'test-api033-staff',
            'role' => 'staff',
            'id' => 'test-api033-staff',
            'full_name' => 'Test Staff',
            'email' => 'test-api033-staff@example.test',
        ], $secretKey, 'HS256');
    }

    public function _after(FunctionalTester $I)
    {
        if ($this->api033SubmissionUuid) {
            \Yii::$app->db->createCommand()->delete('faculty_submissions', [
                'submission_uuid' => $this->api033SubmissionUuid,
            ])->execute();
            $this->api033SubmissionUuid = null;
        }

        \Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => $this->rosterSmithId,
        ])->execute();
        \Yii::$container->clear(\app\services\FolioService::class);
    }

    public function materializedItemChangeReturns409WithoutWriting(FunctionalTester $I)
    {
        $submissionId = $this->createApi033Submission(1);
        $folder = $this->createApi033Folder($submissionId, 'Processed items');
        $itemId = $this->createApi033Item($submissionId, 'Processed title', $folder['folder_name'], true);
        $folders = $this->api033FolderPayload($submissionId);

        $this->assertMaterializedUpdateRejectedAndUnchanged(
            $I,
            $this->api033SubmissionUuid,
            $this->token,
            [
                'submission_notes' => 'This note must not be saved',
                'folders' => $folders,
                'items' => [$this->api033ItemPayload($itemId, 'Changed title', $folder['folder_uuid'])],
            ],
            [$itemId],
            $submissionId
        );
    }

    public function omittingMaterializedItemReturns409WithoutWriting(FunctionalTester $I)
    {
        $submissionId = $this->createApi033Submission(2);
        $folder = $this->createApi033Folder($submissionId, 'Processed items');
        $itemId = $this->createApi033Item($submissionId, 'Processed title', $folder['folder_name'], true);

        $this->assertMaterializedUpdateRejectedAndUnchanged(
            $I,
            $this->api033SubmissionUuid,
            $this->token,
            [
                'submission_notes' => 'An omitted item must not cause this note to be saved',
                'folders' => $this->api033FolderPayload($submissionId),
                'items' => [],
            ],
            [$itemId],
            $submissionId
        );
    }

    public function mixedUnprocessedChangeAndMaterializedDeletionReturns409WithoutWriting(FunctionalTester $I)
    {
        $submissionId = $this->createApi033Submission(3);
        $folder = $this->createApi033Folder($submissionId, 'Processed items');
        $materializedId = $this->createApi033Item($submissionId, 'Processed title', $folder['folder_name'], true);
        $unprocessedId = $this->createApi033Item($submissionId, 'Unprocessed title', $folder['folder_name'], false);

        $this->assertMaterializedUpdateRejectedAndUnchanged(
            $I,
            $this->api033SubmissionUuid,
            $this->token,
            [
                'folders' => $this->api033FolderPayload($submissionId),
                'items' => [$this->api033ItemPayload($unprocessedId, 'Updated unprocessed title', $folder['folder_uuid'])],
            ],
            [$materializedId],
            $submissionId
        );
    }

    public function unchangedMaterializedItemAllowsUnprocessedChange(FunctionalTester $I)
    {
        $submissionId = $this->createApi033Submission(4);
        $folder = $this->createApi033Folder($submissionId, 'Processed items');
        $materializedId = $this->createApi033Item($submissionId, 'Processed title', $folder['folder_name'], true);
        $unprocessedId = $this->createApi033Item($submissionId, 'Unprocessed title', $folder['folder_name'], false);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', [
            'folders' => $this->api033FolderPayload($submissionId),
            'items' => [
                $this->api033ItemPayload($materializedId, 'Processed title', $folder['folder_uuid']),
                $this->api033ItemPayload($unprocessedId, 'Updated unprocessed title', $folder['folder_uuid']),
            ],
        ], ['id' => $this->api033SubmissionUuid]);

        $I->seeResponseCodeIs(200);
        $items = $this->api033Rows('submission_new_resources', $submissionId);
        $materialized = $this->api033FindRow($items, $materializedId);
        $unprocessed = $this->api033FindRow($items, $unprocessedId);
        \PHPUnit\Framework\Assert::assertSame('Processed title', json_decode($materialized['resource_data'], true)['title']);
        \PHPUnit\Framework\Assert::assertSame('Updated unprocessed title', json_decode($unprocessed['resource_data'], true)['title']);
    }

    public function folderDeletionWithoutItemsPayloadReturns409BeforeUnfoldering(FunctionalTester $I)
    {
        $submissionId = $this->createApi033Submission(5);
        $folder = $this->createApi033Folder($submissionId, 'Processed items');
        $itemId = $this->createApi033Item($submissionId, 'Processed title', $folder['folder_name'], true);

        $this->assertMaterializedUpdateRejectedAndUnchanged(
            $I,
            $this->api033SubmissionUuid,
            $this->token,
            ['folders' => []],
            [$itemId],
            $submissionId
        );
    }

    public function staffCannotBypassMaterializedGuardThroughFacultyUpdate(FunctionalTester $I)
    {
        $submissionId = $this->createApi033Submission(6);
        $folder = $this->createApi033Folder($submissionId, 'Processed items');
        $itemId = $this->createApi033Item($submissionId, 'Processed title', $folder['folder_name'], true);

        $this->assertMaterializedUpdateRejectedAndUnchanged(
            $I,
            $this->api033SubmissionUuid,
            $this->staffToken,
            [
                'folders' => $this->api033FolderPayload($submissionId),
                'items' => [$this->api033ItemPayload($itemId, 'Changed by staff', $folder['folder_uuid'])],
            ],
            [$itemId],
            $submissionId
        );
    }

    private function createApi033Submission($suffix)
    {
        $this->api033SubmissionUuid = '03300000-0000-4000-8000-' . str_pad((string)$suffix, 12, '0', STR_PAD_LEFT);
        \Yii::$app->db->createCommand()->insert('faculty_submissions', [
            'submission_uuid' => $this->api033SubmissionUuid,
            'shibboleth_user_id' => $this->shibbolethId,
            'term_code' => 'Spring 2099',
            'course_code' => 'TST-API030-99-209902',
            'section' => '99',
            'course_title' => 'Synthetic API-033 item guard',
            'status' => 'submitted',
            'faculty_display_name' => 'Test Faculty',
        ])->execute();

        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function createApi033Folder($submissionId, $folderName)
    {
        \Yii::$app->db->createCommand()->insert('submission_folders', [
            'submission_id' => $submissionId,
            'folder_name' => $folderName,
            'display_order' => 1,
        ])->execute();

        return [
            'folder_id' => (int)\Yii::$app->db->getLastInsertID(),
            'folder_name' => $folderName,
            'folder_uuid' => 'api033-folder-' . (string)\Yii::$app->db->getLastInsertID(),
        ];
    }

    private function createApi033Item($submissionId, $title, $folderName, $materialized)
    {
        $materialization = $materialized ? 551 : null;
        \Yii::$app->db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submissionId,
            'material_type_id' => 1,
            'is_reuse' => 0,
            'source_barcode' => null,
            'source_call_number' => null,
            'resource_data' => json_encode([
                'title' => $title,
                'authors' => 'Synthetic Author',
                'materialType' => 'article',
                'doi' => '10.1000/api033-original',
            ]),
            'display_order' => 1,
            'folder_name' => $folderName,
            'faculty_notes' => 'Synthetic faculty note',
            'item_status' => $materialized ? 'complete' : 'pending',
            'position_in_folder' => 1,
            'materialized_resource_id' => $materialization,
            'materialized_course_resource_id' => null,
            'materialized_physical_reference_id' => null,
            'materialized_folder_id' => null,
            'materialized_by_staff_id' => null,
            'materialized_at' => null,
        ])->execute();

        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function api033FolderPayload($submissionId)
    {
        $folders = (new \yii\db\Query())
            ->from('submission_folders')
            ->where(['submission_id' => $submissionId])
            ->orderBy(['folder_id' => SORT_ASC])
            ->all();
        $payload = [];
        foreach ($folders as $folder) {
            $payload[] = [
                'folder_uuid' => 'api033-folder-' . (string)$folder['folder_id'],
                'folder_name' => $folder['folder_name'],
                'display_order' => $folder['display_order'],
            ];
        }

        return $payload;
    }

    private function api033ItemPayload($itemId, $title, $folderUuid)
    {
        return [
            'item_uuid' => (string)$itemId,
            'title' => $title,
            'authors' => 'Synthetic Author',
            'material_type' => 'article',
            'resource_data' => [],
            'display_order' => 1,
            'folder_uuid' => $folderUuid,
            'position_in_folder' => 1,
            'faculty_notes' => 'Synthetic faculty note',
        ];
    }

    private function assertMaterializedUpdateRejectedAndUnchanged(FunctionalTester $I, $uuid, $token, array $payload, array $itemIds, $submissionId)
    {
        $before = $this->api033Snapshot($submissionId);
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', $payload, ['id' => $uuid]);
        $I->seeResponseCodeIs(409);
        \PHPUnit\Framework\Assert::assertSame([
            'success' => false,
            'error_code' => 'materialized_item_correction_required',
            'message' => 'Processed course-reserve items must be corrected by library staff.',
            'submission_uuid' => $uuid,
            'item_ids' => $itemIds,
        ], $I->grabJsonResponse());
        \PHPUnit\Framework\Assert::assertSame($before, $this->api033Snapshot($submissionId));
    }

    private function api033Snapshot($submissionId)
    {
        return [
            'submission' => (new \yii\db\Query())
                ->from('faculty_submissions')
                ->where(['submission_id' => $submissionId])
                ->one(),
            'folders' => $this->api033Rows('submission_folders', $submissionId),
            'new_resources' => $this->api033Rows('submission_new_resources', $submissionId),
            'reuse_resources' => $this->api033Rows('submission_reuse_resources', $submissionId),
        ];
    }

    private function api033Rows($table, $submissionId)
    {
        $primaryKey = $table === 'submission_folders' ? 'folder_id' : 'id';
        return (new \yii\db\Query())
            ->from($table)
            ->where(['submission_id' => $submissionId])
            ->orderBy([$primaryKey => SORT_ASC])
            ->all();
    }

    private function api033FindRow(array $rows, $id)
    {
        foreach ($rows as $row) {
            if ((string)$row['id'] === (string)$id) {
                return $row;
            }
        }

        return null;
    }

}

class Api033FolioServiceStub
{
    public function searchTerms()
    {
        return [
            [
                'id' => 'test-api033-spring-2099',
                'name' => 'Spring 2099',
                'startDate' => '2099-01-01',
                'endDate' => '2099-05-31',
            ],
        ];
    }

    public function searchCourses($query)
    {
        return null;
    }
}
