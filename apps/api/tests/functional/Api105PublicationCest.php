<?php

use PHPUnit\Framework\Assert;

class Api105PublicationCest extends BaseFunctionalCest
{
    private $prefix = 'test-api105-';
    private $staffToken;
    private $otherToken;
    private $submissionIds = [];
    private $customMaterialTypeId;
    private $customFlowId;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->insertUser('staff');
        $this->insertUser('other');
        $this->staffToken = $this->token('staff');
        $this->otherToken = $this->token('other');
        $this->createPublishOnlineFlow();
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }
    public function manualReadyNeedsTheClaimAndReasonAndNeverPublishes(FunctionalTester $I)
    {
        $item = $this->createItem('manual');

        $this->request($I, 'POST', 'workflow-publication/ready', [], $this->staffToken, $item);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('not_claimed_by_you', $this->response($I)['error_code']);

        $this->claim($I, $item);
        $this->request($I, 'POST', 'workflow-publication/ready', [], $this->staffToken, $item);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('reason_required', $this->response($I)['error_code']);

        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic manual readiness reason',
        ], $this->staffToken, $item);
        $I->seeResponseCodeIs(200);
        $publication = $this->response($I)['publication'];
        Assert::assertSame('ready', $publication['state']);
        Assert::assertSame('manual', $publication['readiness']['source']);
        Assert::assertSame('Synthetic manual readiness reason', $publication['readiness']['reason']);
        Assert::assertTrue($publication['actions']['can_publish'] === false);
        Assert::assertContains('publication_not_available_yet', $publication['actions']['blockers']);
        $this->assertNoDestination($item['id']);
        $event = \Yii::$app->db->createCommand(
            'SELECT actor_username, reason FROM workflow_events WHERE item_kind = "new" '
            . 'AND item_id = :id AND event_type = "item_marked_ready"', [':id' => $item['id']]
        )->queryOne();
        Assert::assertSame(['test-api105-staff', 'Synthetic manual readiness reason'], array_values($event));

        $this->request($I, 'POST', 'submission-workflow/complete-processing', [], $this->staffToken, [
            'itemId' => $item['id'],
        ]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('publication_not_available_yet', $this->response($I)['error_code']);
        $this->assertNoDestination($item['id']);
    }
    public function staffDetailContainsTheSameContractAndItemEditsInvalidateReadiness(FunctionalTester $I)
    {
        $item = $this->createItem('details');
        $this->claim($I, $item);
        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic readiness reason',
        ], $this->staffToken, $item);
        $I->seeResponseCodeIs(200);

        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'public_note' => 'Synthetic student note',
        ], $this->staffToken, $item);
        $I->seeResponseCodeIs(200);

        $this->request($I, 'GET', 'submission-workflow/view-submission', [], $this->staffToken, [
            'id' => $item['submission_id'],
        ]);
        $I->seeResponseCodeIs(200);
        $detail = $this->response($I)['newResources'][0]['publication'];
        Assert::assertSame('pending', $detail['state']);
        Assert::assertNull($detail['readiness']['source']);
        Assert::assertSame(2, $detail['revision']['draft']);
        Assert::assertFalse($detail['has_published_version']);
    }

    public function customPublishOnlineStepPreparesWithoutCreatingADestination(FunctionalTester $I)
    {
        $item = $this->createItem('online', 'new', $this->customMaterialTypeId);
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], $this->staffToken, $item);
        $I->seeResponseCodeIs(200);
        $this->claim($I, $item);
        $this->request($I, 'POST', 'workflow-flow/step-result', [
            'step_key' => 'publish',
            'outcome_key' => 'done',
        ], $this->staffToken, $item);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('available_online', $this->response($I)['finished']['finish_state']);

        $this->request($I, 'GET', 'workflow-publication/state', [], $this->staffToken, $item);
        $I->seeResponseCodeIs(200);
        $publication = $this->response($I)['publication'];
        Assert::assertSame('ready', $publication['state']);
        Assert::assertSame('flow', $publication['readiness']['source']);
        Assert::assertSame(1, $publication['readiness']['context']['flow_version']);
        Assert::assertSame('available_online', $publication['readiness']['context']['finish_state']);
        $this->assertNoDestination($item['id']);
    }

    public function expiredClaimsRemainVisibleAsPolicyBlockers(FunctionalTester $I)
    {
        $item = $this->createItem('expired');
        $this->claim($I, $item);
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'last_activity_at' => '2026-10-20 12:00:00',
            'claimed_at' => '2026-10-20 12:00:00',
        ], ['id' => $item['id']])->execute();

        $this->request($I, 'GET', 'workflow-publication/state', [], $this->staffToken, $item);
        $I->seeResponseCodeIs(200);
        Assert::assertContains('claim_expired', $this->response($I)['publication']['actions']['blockers']);
    }

    private function createPublishOnlineFlow()
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('material_types', [
            'name' => $this->prefix . 'electronic',
            'description' => 'Synthetic API-105 material type',
        ])->execute();
        $this->customMaterialTypeId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . 'publish online',
            'description' => 'Synthetic API-105 preparation flow',
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $this->customFlowId = (int)$db->getLastInsertID();
        $steps = [[
            'key' => 'publish',
            'kind' => 'publish_online',
            'label' => 'Record online preparation',
            'outcomes' => [[
                'key' => 'done',
                'label' => 'Done',
                'next' => ['finish' => 'online'],
            ]],
        ], [
            'key' => 'online',
            'kind' => 'finish',
            'label' => 'Available online',
            'finish_state' => 'available_online',
            'reason_required' => false,
            'outcomes' => [],
        ]];
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $this->customFlowId,
            'version' => 1,
            'steps_json' => json_encode($steps),
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $db->createCommand()->insert('material_type_flows', [
            'material_type_id' => $this->customMaterialTypeId,
            'flow_id' => $this->customFlowId,
        ])->execute();
    }

    private function createItem($suffix, $kind = 'new', $materialTypeId = null)
    {
        $uuid = $this->uuid();
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 105-' . substr(str_replace('-', '', $uuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $this->submissionIds[] = $submissionId;
        $db = \Yii::$app->db;
        if ($kind === 'new') {
            $id = (int)$db->createCommand(
                'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
                [':id' => $submissionId]
            )->queryScalar();
            $db->createCommand()->update('submission_new_resources', [
                'material_type_id' => $materialTypeId,
                'resource_data' => json_encode(['title' => 'Synthetic API-105 ' . $suffix]),
            ], ['id' => $id])->execute();
        } else {
            $db->createCommand()->insert('submission_reuse_resources', [
                'submission_id' => $submissionId,
                'faculty_notes' => 'Synthetic faculty note',
            ])->execute();
            $id = (int)$db->getLastInsertID();
        }
        return ['kind' => $kind, 'id' => $id, 'submission_id' => $submissionId];
    }

    private function claim(FunctionalTester $I, array $item)
    {
        $this->request($I, 'POST', 'workflow-claim/claim', [], $this->staffToken, $item);
        $I->seeResponseCodeIs(200);
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, $token, array $params = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function insertUser($type)
    {
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $this->prefix . $type,
            'full_name' => 'Synthetic API-105 ' . ucfirst($type),
            'email' => $this->prefix . $type . '@example.test',
            'role' => 'staff',
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function token($type)
    {
        $username = $this->prefix . $type;
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => 'staff',
            'id' => $username,
            'internal_id' => '999105001',
            'full_name' => 'Synthetic API-105 ' . ucfirst($type),
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    private function assertNoDestination($itemId)
    {
        $row = \Yii::$app->db->createCommand(
            'SELECT materialized_resource_id, materialized_course_resource_id, '
            . 'materialized_physical_reference_id, materialized_at FROM submission_new_resources WHERE id = :id',
            [':id' => $itemId]
        )->queryOne();
        Assert::assertSame([
            'materialized_resource_id' => null,
            'materialized_course_resource_id' => null,
            'materialized_physical_reference_id' => null,
            'materialized_at' => null,
        ], $row);
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
        if ($this->customMaterialTypeId) {
            $db->createCommand()->delete('material_type_flows', [
                'material_type_id' => $this->customMaterialTypeId,
            ])->execute();
            $db->createCommand()->delete('material_types', ['material_type_id' => $this->customMaterialTypeId])->execute();
        }
        if ($this->customFlowId) {
            $db->createCommand()->delete('item_flow_runs', ['flow_id' => $this->customFlowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $this->customFlowId])->execute();
        }
        $db->createCommand()->delete('users', ['like', 'username', $this->prefix . '%', false])->execute();
        $this->submissionIds = [];
        $this->customMaterialTypeId = null;
        $this->customFlowId = null;
    }
}
