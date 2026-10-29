<?php

use PHPUnit\Framework\Assert;

/** Keeps faculty assigned-page edits pending after materialization. */
class Api105FacultyPublishedEditCest extends BaseFunctionalCest
{
    private $uuid;
    private $owner = 'test-api105-faculty-edit';
    private $submissionId;
    private $itemId;
    private $token;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $db = \Yii::$app->db;
        $this->uuid = $this->uuid();
        $materialTypeId = (int)$db->createCommand(
            'SELECT material_type_id FROM material_types WHERE name = "article" LIMIT 1'
        )->queryScalar();
        $db->createCommand()->insert('faculty_submissions', [
            'submission_uuid' => $this->uuid,
            'shibboleth_user_id' => $this->owner,
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 105-FACULTY',
            'section' => '01',
            'course_title' => 'Synthetic API-105 faculty edit',
            'status' => 'submitted',
            'link_state' => 'linked',
            'faculty_display_name' => 'Synthetic Faculty',
            'submitted_at' => '2026-10-01 12:00:00',
        ])->execute();
        $this->submissionId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $this->submissionId,
            'material_type_id' => $materialTypeId,
            'resource_data' => json_encode([
                'title' => 'Synthetic article', 'authors' => 'Synthetic Author', 'materialType' => 'article',
            ]),
            'display_order' => 1,
            'item_status' => 'complete',
            'materialized_resource_id' => 810501,
            'materialized_course_resource_id' => 810502,
            'materialized_at' => '2026-10-01 12:00:00',
            'materialized_by_staff_id' => 'synthetic-staff',
        ])->execute();
        $this->itemId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('submission_publication_state', [
            'item_kind' => 'new',
            'item_id' => $this->itemId,
            'submission_id' => $this->submissionId,
            'state' => 'published',
            'draft_revision' => 1,
            'published_revision' => 1,
            'pending_changes' => 'none',
            'reconciliation_status' => 'verified',
        ])->execute();
        $this->token = \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $this->owner,
            'role' => 'faculty',
            'id' => 0,
            'full_name' => 'Synthetic Faculty',
            'email' => $this->owner . '@example.test',
            'institution' => 'SM',
            'internal_id' => '999105001',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    public function assignedPagesEditLeavesPublishedVersionPending(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('PUT', 'faculty-submission/update', [
            'items' => [[
                'item_uuid' => (string)$this->itemId,
                'title' => 'Synthetic article',
                'authors' => 'Synthetic Author',
                'material_type' => 'article',
                'display_order' => 1,
                'assignedPages' => '44-46',
            ]],
        ], ['id' => $this->uuid]);
        $I->seeResponseCodeIs(200);

        $row = \Yii::$app->db->createCommand(
            'SELECT assigned_pages, materialized_resource_id, materialized_course_resource_id '
            . 'FROM submission_new_resources WHERE id = :id',
            [':id' => $this->itemId]
        )->queryOne();
        Assert::assertSame('44-46', $row['assigned_pages']);
        Assert::assertSame('810501', $row['materialized_resource_id']);
        Assert::assertSame('810502', $row['materialized_course_resource_id']);

        $state = \Yii::$app->db->createCommand(
            'SELECT state, draft_revision, published_revision, pending_changes '
            . 'FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
            [':id' => $this->itemId]
        )->queryOne();
        Assert::assertSame('published_with_pending_edits', $state['state']);
        Assert::assertSame('2', $state['draft_revision']);
        Assert::assertSame('1', $state['published_revision']);
        Assert::assertSame('pending', $state['pending_changes']);

        $I->sendJsonRequest('GET', 'workflow-publication/state', [], ['kind' => 'new', 'id' => $this->itemId]);
        $I->seeResponseCodeIs(403);
    }

    public function _after(FunctionalTester $I)
    {
        if ($this->submissionId) {
            \Yii::$app->db->createCommand()->delete('workflow_events', [
                'submission_id' => $this->submissionId,
            ])->execute();
            \Yii::$app->db->createCommand()->delete('faculty_submissions', [
                'submission_id' => $this->submissionId,
            ])->execute();
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
