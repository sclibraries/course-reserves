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
}
