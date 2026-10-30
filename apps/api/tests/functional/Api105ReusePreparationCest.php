<?php

use PHPUnit\Framework\Assert;

/** Ensures a custom publish-online preparation flow also supports reuse items. */
class Api105ReusePreparationCest extends BaseFunctionalCest
{
    private $prefix = 'test-api105-reuse-';
    private $uuid;
    private $submissionId;
    private $itemId;
    private $flowId;
    private $materialTypeId;
    private $token;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->uuid = $this->uuid();
        $db = \Yii::$app->db;
        $db->createCommand()->insert('users', [
            'username' => $this->prefix . 'staff',
            'full_name' => 'Synthetic API-105 staff',
            'email' => $this->prefix . 'staff@example.test',
            'role' => 'staff',
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
        $this->token = $this->token();
        $db->createCommand()->insert('material_types', [
            'name' => $this->prefix . 'electronic',
            'description' => 'Synthetic API-105 material type',
        ])->execute();
        $this->materialTypeId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . 'publish online',
            'description' => 'Synthetic API-105 preparation flow',
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $this->flowId = (int)$db->getLastInsertID();
        $steps = [[
            'key' => 'publish', 'kind' => 'publish_online', 'label' => 'Record online preparation',
            'outcomes' => [[
                'key' => 'done', 'label' => 'Done', 'next' => ['finish' => 'online'],
            ]],
        ], [
            'key' => 'online', 'kind' => 'finish', 'label' => 'Available online',
            'finish_state' => 'available_online', 'reason_required' => false, 'outcomes' => [],
        ]];
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $this->flowId, 'version' => 1, 'steps_json' => json_encode($steps),
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $db->createCommand()->insert('material_type_flows', [
            'material_type_id' => $this->materialTypeId, 'flow_id' => $this->flowId,
        ])->execute();
        $this->submissionId = TestSubmissionFixture::create($this->uuid, $this->prefix . 'faculty', [
            'course_title' => $this->prefix . 'course',
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $db->createCommand()->insert('resources', [
            'name' => $this->prefix . 'source', 'material_type_id' => $this->materialTypeId,
        ])->execute();
        $sourceId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $this->submissionId, 'source_resource_id' => $sourceId,
        ])->execute();
        $this->itemId = (int)$db->getLastInsertID();
    }

    public function reuseItemCanFinishPreparationWithoutPublishing(FunctionalTester $I)
    {
        $params = ['kind' => 'reuse', 'id' => $this->itemId];
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], $params);
        $I->seeResponseCodeIs(200);
        $flow = $this->response($I);
        Assert::assertSame($this->flowId, $flow['flow']['id']);
        Assert::assertSame('publish', $flow['current_step']['step']['key']);
        $draftRevision = (int)\Yii::$app->db->createCommand(
            'SELECT draft_revision FROM submission_publication_state WHERE item_kind = "reuse" AND item_id = :id',
            [':id' => $this->itemId]
        )->queryScalar();
        $this->request($I, 'POST', 'workflow-claim/claim', [], $params);
        $I->seeResponseCodeIs(200);
        $this->request($I, 'POST', 'workflow-flow/step-result', [
            'step_key' => 'publish', 'outcome_key' => 'done',
        ], $params);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('available_online', $this->response($I)['finished']['finish_state']);

        $this->request($I, 'GET', 'workflow-publication/state', [], $params);
        $I->seeResponseCodeIs(200);
        $publication = $this->response($I)['publication'];
        Assert::assertSame($draftRevision, (int)$publication['revision']['draft']);
        Assert::assertSame('ready', $publication['state']);
        Assert::assertSame('available_online', $publication['readiness']['context']['finish_state']);
        $row = \Yii::$app->db->createCommand(
            'SELECT materialized_resource_id, materialized_course_resource_id, '
            . 'materialized_physical_reference_id FROM submission_reuse_resources WHERE id = :id',
            [':id' => $this->itemId]
        )->queryOne();
        Assert::assertSame(['materialized_resource_id' => null, 'materialized_course_resource_id' => null,
            'materialized_physical_reference_id' => null], $row);
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, array $params)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function token()
    {
        $username = $this->prefix . 'staff';
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1, 'exp' => time() + 3600, 'username' => $username,
            'role' => 'staff', 'id' => $username, 'internal_id' => '999105020',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $submissionIds = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE course_title LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($submissionIds) {
            $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionIds])->execute();
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        if ($this->flowId) {
            $db->createCommand()->delete('item_flow_runs', ['flow_id' => $this->flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $this->flowId])->execute();
        }
        if ($this->materialTypeId) {
            $db->createCommand()->delete('material_types', ['material_type_id' => $this->materialTypeId])->execute();
        }
        $resourceIds = $db->createCommand(
            'SELECT resource_id FROM resources WHERE name LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($resourceIds) {
            $db->createCommand()->delete('resources', ['resource_id' => $resourceIds])->execute();
        }
        $db->createCommand()->delete('users', ['username' => $this->prefix . 'staff'])->execute();
        $this->submissionId = null;
        $this->itemId = null;
        $this->flowId = null;
        $this->materialTypeId = null;
    }
}
