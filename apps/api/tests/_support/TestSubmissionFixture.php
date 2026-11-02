<?php

/**
 * Creates the faculty submission row shared by functional API tests.
 */
class TestSubmissionFixture
{
    const DEFAULT_UUID = '77000000-0000-4000-8000-000000000023';
    const FACULTY_A_ID = 'test-api078-faculty-a';

    public static function create($uuid, $ownerId, array $overrides = array())
    {
        self::delete($uuid);

        $submission = array_merge([
            'submission_uuid' => $uuid,
            'shibboleth_user_id' => $ownerId,
            'term_code' => 'Spring 2027',
            'course_code' => 'TST 101',
            'section' => '01',
            'course_title' => 'TST 101 - Test Course One',
            'status' => 'submitted',
            'faculty_display_name' => 'Test Faculty A',
            'submission_notes' => 'Synthetic functional-test submission.',
        ], $overrides);

        $db = \Yii::$app->db;
        $db->createCommand()->insert('faculty_submissions', $submission)->execute();
        $submissionId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $submissionId,
            'resource_data' => json_encode(['title' => 'TST 101 test material']),
            'item_status' => 'pending',
        ])->execute();

        return $submissionId;
    }

    public static function delete($uuid)
    {
        $db = \Yii::$app->db;
        $submissionId = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryScalar();
        if (!$submissionId) {
            return;
        }

        self::deleteApi116ARowsForSubmission($submissionId);

        foreach ([
            'submission_communications',
            'submission_metadata',
            'submission_new_resources',
            'submission_reuse_resources',
            'submission_folders',
        ] as $tableName) {
            if ($db->getSchema()->getTableSchema($tableName, true)) {
                $db->createCommand()->delete($tableName, ['submission_id' => $submissionId])->execute();
            }
        }
        $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionId])->execute();
    }

    /** Removes only API-116A registry rows created for this synthetic fixture. */
    public static function deleteApi116ARowsForSubmission($submissionId)
    {
        $db = \Yii::$app->db;
        if (!$db->schema->getTableSchema('publication_destinations', true)
            || !$db->schema->getTableSchema('publication_attachments', true)) {
            return;
        }

        $references = [];
        foreach ([
            'new' => 'submission_new_resources',
            'reuse' => 'submission_reuse_resources',
        ] as $kind => $table) {
            $itemIds = $db->createCommand(
                'SELECT id FROM ' . $table . ' WHERE submission_id = :submission_id',
                [':submission_id' => (int)$submissionId]
            )->queryColumn();
            if (!$itemIds) {
                continue;
            }
            $references[] = ['and', ['item_kind' => $kind], ['item_id' => $itemIds]];
        }
        if (!$references) {
            return;
        }

        $destinationIds = [];
        $ownerIds = [];
        foreach ($references as $reference) {
            $kind = $reference[1]['item_kind'];
            $ids = array_map('intval', $reference[2]['item_id']);
            $idList = implode(',', $ids);
            $destinationIds = array_merge($destinationIds, $db->createCommand(
                'SELECT DISTINCT destination_id FROM publication_attachments '
                . 'WHERE item_kind = :kind AND item_id IN (' . $idList . ')',
                [':kind' => $kind]
            )->queryColumn());
            $ownerIds = array_merge($ownerIds, $db->createCommand(
                'SELECT id FROM publication_destinations '
                . 'WHERE owner_item_kind = :kind AND owner_item_id IN (' . $idList . ')',
                [':kind' => $kind]
            )->queryColumn());
        }
        $destinationIds = array_values(array_unique(array_map('intval', array_merge($destinationIds, $ownerIds))));

        $deleteAttachments = ['or'];
        foreach ($references as $reference) {
            $deleteAttachments[] = $reference;
        }
        if ($destinationIds) {
            $deleteAttachments[] = ['destination_id' => $destinationIds];
        }
        $db->createCommand()->delete('publication_attachments', $deleteAttachments)->execute();
        if ($destinationIds) {
            $db->createCommand()->delete('publication_destinations', ['id' => $destinationIds])->execute();
        }
    }
}
