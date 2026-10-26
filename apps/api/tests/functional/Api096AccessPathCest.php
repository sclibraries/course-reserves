<?php

use PHPUnit\Framework\Assert;
use app\services\AccessPathPolicy;

/** Covers staff access paths and their mapped item flows. */
class Api096AccessPathCest extends BaseFunctionalCest
{
    private $prefix = 'test-api096-';
    private $uuid = '77000000-0000-4000-8000-000000000096';
    private $submissionId;
    private $itemId;
    private $tokens = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->insertUser('staff');
        $this->insertUser('admin');
        $this->tokens['staff'] = $this->token('staff');
        $this->tokens['admin'] = $this->token('admin');
        $this->submissionId = TestSubmissionFixture::create($this->uuid, $this->prefix . 'faculty', [
            'course_title' => 'Synthetic API-096 course',
            'link_state' => 'linked',
        ]);
        $this->itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id ASC LIMIT 1',
            [':id' => $this->submissionId]
        )->queryScalar();
        $this->setMaterialType('book');
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    public function accessPathIsValidatedAgainstTheItemsOwnType(FunctionalTester $I)
    {
        $this->claim($I);

        $this->request($I, 'POST', 'workflow-flow/access-path', ['access_path' => 'ill'], ['kind' => 'new', 'id' => $this->itemId]);

        $I->seeResponseCodeIs(422);
        Assert::assertSame('access_path_not_allowed', $this->response($I)['error_code']);
    }

    public function reusedItemsWithoutTheirOwnTypeUseTheFallbackPaths(FunctionalTester $I)
    {
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $this->submissionId, 'display_order' => 1,
        ])->execute();
        $itemId = (int)\Yii::$app->db->getLastInsertID();
        $this->request($I, 'POST', 'workflow-claim/claim', [], [
            'role' => 'staff', 'kind' => 'reuse', 'id' => $itemId,
        ]);
        $I->seeResponseCodeIs(200);
        $this->request($I, 'POST', 'workflow-flow/access-path', ['access_path' => 'ill'], [
            'role' => 'staff', 'kind' => 'reuse', 'id' => $itemId,
        ]);
        $I->seeResponseCodeIs(422);
        Assert::assertSame('access_path_not_allowed', $this->response($I)['error_code']);
        $this->request($I, 'POST', 'workflow-flow/access-path', ['access_path' => 'purchase'], [
            'role' => 'staff', 'kind' => 'reuse', 'id' => $itemId,
        ]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('purchase', $this->response($I)['access_path']);
        Assert::assertSame('purchase', (string)\Yii::$app->db->createCommand(
            'SELECT access_path FROM submission_reuse_resources WHERE id = :id', [':id' => $itemId]
        )->queryScalar());
    }

    public function accessPathRulesCoverKnownAndUnknownTypes(FunctionalTester $I)
    {
        $this->claim($I);
        foreach (['book', 'video', 'website', 'other', 'unknown', null] as $type) {
            $this->setMaterialType($type);
            foreach (['ill', 'ags', 'in_house_copy'] as $path) {
                $this->setStoredPath(null);
                $this->setPath($I, $path);
                $I->seeResponseCodeIs(422);
                Assert::assertSame('access_path_not_allowed', $this->response($I)['error_code']);
            }
            foreach (['purchase', 'faculty_supplies'] as $path) {
                $this->setStoredPath(null);
                $this->setPath($I, $path);
                $I->seeResponseCodeIs(200);
            }
        }
        foreach (['article', 'chapter'] as $type) {
            $this->setMaterialType($type);
            foreach (['purchase', 'ags', 'ill', 'in_house_copy', 'faculty_supplies'] as $path) {
                $this->setStoredPath(null);
                $this->setPath($I, $path);
                $I->seeResponseCodeIs(200);
            }
        }
    }

    public function accessPathRequiresTheClaimAndAReasonOnlyForChanges(FunctionalTester $I)
    {
        $this->setPath($I, 'purchase');
        $I->seeResponseCodeIs(409);
        Assert::assertSame('not_claimed_by_you', $this->response($I)['error_code']);

        $this->claim($I);
        $this->setPath($I, 'purchase');
        $I->seeResponseCodeIs(200);
        $this->setPath($I, 'faculty_supplies');
        $I->seeResponseCodeIs(400);
        Assert::assertSame('reason_required', $this->response($I)['error_code']);
        Assert::assertSame('purchase', $this->storedPath());

        $this->setPath($I, 'faculty_supplies', 'Change reason');
        $I->seeResponseCodeIs(200);
        $this->setPath($I, 'faculty_supplies');
        $I->seeResponseCodeIs(200);
        Assert::assertSame(2, $this->eventCount('access_path_set'));
    }

    public function mappedAccessPathStartsFlowAndQueuesItemInItsGroup(FunctionalTester $I)
    {
        $this->setMaterialType('article');
        $groupId = $this->createGroup();
        $this->addGroupMember($groupId);
        $oldFlowId = $this->createFlow($this->prefix . 'old', $this->steps('Old start'));
        $newFlowId = $this->createFlow($this->prefix . 'ill', $this->steps('ILL intake'));
        $this->claim($I);
        $this->switchFlow($I, $oldFlowId);
        $oldRunId = $this->latestRunId();
        $this->mapPath('ill', $newFlowId, $groupId);

        $this->setPath($I, 'ill', 'Route to ILL');

        $I->seeResponseCodeIs(200);
        $body = $this->response($I);
        Assert::assertSame($newFlowId, $body['flow_id']);
        Assert::assertSame($groupId, $body['group_id']);
        Assert::assertNull($body['warning']);
        $runs = $this->runs();
        Assert::assertCount(2, $runs);
        Assert::assertNotNull($runs[0]['closed_at']);
        Assert::assertSame('Route to ILL', $runs[0]['closed_reason']);
        Assert::assertSame('start', $runs[1]['current_step_key']);
        Assert::assertSame($newFlowId, (int)$runs[1]['flow_id']);
        Assert::assertSame($oldRunId, (int)$runs[0]['id']);
        Assert::assertSame($groupId, (int)$this->item()['assigned_group_id']);
        Assert::assertNull($this->item()['claimed_by']);

        $this->request($I, 'GET', 'workflow-group/group-queue', [], ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($this->itemId, (int)$this->response($I)['items'][0]['id']);
        $event = $this->lastAccessPathEvent();
        Assert::assertSame(['access_path' => null], $event['before']);
        Assert::assertSame([
            'access_path' => 'ill', 'flow_id' => $newFlowId, 'run_id' => (int)$runs[1]['id'], 'group_id' => $groupId,
        ], $event['after']);
    }

    public function mappingAnAlreadyOpenFlowKeepsItsRun(FunctionalTester $I)
    {
        $this->setMaterialType('article');
        $flowId = $this->createFlow($this->prefix . 'same-flow', $this->steps('Same flow'));
        $this->mapPath('ill', $flowId, null);
        $this->claim($I);
        $this->switchFlow($I, $flowId);
        $runId = $this->latestRunId();

        $this->setPath($I, 'ill');

        $I->seeResponseCodeIs(200);
        Assert::assertSame($runId, $this->latestRunId());
        Assert::assertCount(1, $this->runs());
        Assert::assertSame('no_group_mapped', $this->response($I)['warning']);
    }

    public function unmappedPathIsSavedWithAnAuditEventAndWarning(FunctionalTester $I)
    {
        $this->claim($I);

        $this->setPath($I, 'purchase');

        $I->seeResponseCodeIs(200);
        Assert::assertSame('no_flow_mapped', $this->response($I)['warning']);
        Assert::assertSame('purchase', $this->storedPath());
        Assert::assertSame(['access_path' => null], $this->lastAccessPathEvent()['before']);
        Assert::assertSame('purchase', $this->lastAccessPathEvent()['after']['access_path']);
        Assert::assertNull($this->lastAccessPathEvent()['after']['flow_id']);
        Assert::assertNull($this->lastAccessPathEvent()['after']['run_id']);
        Assert::assertSame($this->prefix . 'staff', $this->lastAccessPathEvent()['actor_username']);
    }

    public function invalidMappedFlowsReturnClearErrorsWithoutPartialWrites(FunctionalTester $I)
    {
        $validFlowId = $this->createFlow($this->prefix . 'current', $this->steps('Current'));
        $missingVersionFlowId = $this->createFlow($this->prefix . 'no-version');
        $emptyFlowId = $this->createFlow($this->prefix . 'empty', []);
        $this->claim($I);
        $this->switchFlow($I, $validFlowId);
        $currentRunId = $this->latestRunId();

        $this->mapPath('purchase', $missingVersionFlowId, null);
        $this->setPath($I, 'purchase');
        $I->seeResponseCodeIs(409);
        Assert::assertSame('flow_version_missing', $this->response($I)['error_code']);
        Assert::assertNull($this->storedPath());
        Assert::assertSame($currentRunId, $this->latestRunId());
        Assert::assertSame(0, $this->eventCount('access_path_set'));

        $this->mapPath('faculty_supplies', $emptyFlowId, null);
        $this->setPath($I, 'faculty_supplies');
        $I->seeResponseCodeIs(409);
        Assert::assertSame('flow_has_no_steps', $this->response($I)['error_code']);
        Assert::assertNull($this->storedPath());
        Assert::assertSame($currentRunId, $this->latestRunId());
        Assert::assertSame(0, $this->eventCount('access_path_set'));

        $this->switchFlow($I, $emptyFlowId);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('flow_has_no_steps', $this->response($I)['error_code']);
        Assert::assertSame($currentRunId, $this->latestRunId());
    }

    public function adminCanReadAndReplaceMappingsButInvalidIdsAndStaffAreRejected(FunctionalTester $I)
    {
        $flowId = $this->createFlow($this->prefix . 'mapped', $this->steps('Mapped'));
        $groupId = $this->createGroup();
        $this->request($I, 'GET', 'workflow-flow-admin/access-path-mapping', [], ['role' => 'staff']);
        $I->seeResponseCodeIs(403);
        $this->request($I, 'GET', 'workflow-flow-admin/access-path-mapping', [], ['role' => 'admin']);
        $I->seeResponseCodeIs(200);
        $mapping = $this->response($I)['mapping'];
        Assert::assertSame(AccessPathPolicy::PATHS, array_column($mapping, 'access_path'));
        foreach ($mapping as &$row) {
            if ($row['access_path'] === 'ill') {
                $row['flow_id'] = $flowId;
                $row['group_id'] = $groupId;
            }
        }
        unset($row);
        $this->request($I, 'PUT', 'workflow-flow-admin/access-path-mapping', ['mapping' => $mapping], ['role' => 'admin']);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($flowId, $this->mappingValue('ill', 'flow_id'));
        Assert::assertSame($groupId, $this->mappingValue('ill', 'group_id'));

        $invalidFlow = $mapping;
        $invalidFlow[0]['flow_id'] = 999999;
        $this->request($I, 'PUT', 'workflow-flow-admin/access-path-mapping', ['mapping' => $invalidFlow], ['role' => 'admin']);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('invalid_mapping', $this->response($I)['error_code']);
        $invalidGroup = $mapping;
        $invalidGroup[0]['group_id'] = 999999;
        $this->request($I, 'PUT', 'workflow-flow-admin/access-path-mapping', ['mapping' => $invalidGroup], ['role' => 'admin']);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('invalid_mapping', $this->response($I)['error_code']);
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id IS NULL AND actor_username = :actor '
            . 'AND event_type = "flow_mapping_updated"', [':actor' => $this->prefix . 'admin']
        )->queryScalar());
    }

    public function detailReadinessShowsAnOpenAccessPathRunAsInProgress(FunctionalTester $I)
    {
        $flowId = $this->createFlow($this->prefix . 'readiness', $this->steps('Processing'));
        $this->setStoredPath('ill');
        $flows = new \app\services\FlowRepository();
        $runId = $flows->insertRun('new', $this->itemId, $flowId, 1, 'start');
        $this->request($I, 'GET', 'submission-workflow/view-submission', [], ['role' => 'staff', 'id' => $this->submissionId]);
        $I->seeResponseCodeIs(200);
        $item = $this->response($I)['newResources'][0];
        Assert::assertSame('ill', $item['access_path']);
        Assert::assertSame('in_progress', $item['readiness']);
        Assert::assertSame('The access path is being processed.', $item['readiness_reason']);

        $latestRunId = $flows->insertRun('new', $this->itemId, $flowId, 1, 'start');
        \Yii::$app->db->createCommand()->update(
            'item_flow_runs', ['closed_at' => date('Y-m-d H:i:s')], ['id' => $latestRunId]
        )->execute();
        $this->request($I, 'GET', 'submission-workflow/view-submission', [], ['role' => 'staff', 'id' => $this->submissionId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('unknown', $this->response($I)['newResources'][0]['readiness']);
        Assert::assertNull(\Yii::$app->db->createCommand(
            'SELECT closed_at FROM item_flow_runs WHERE id = :id', [':id' => $runId]
        )->queryScalar());
    }

    private function setMaterialType($materialType)
    {
        $data = ['title' => 'Synthetic API-096 item'];
        if ($materialType !== null && $materialType !== 'unknown') {
            $data['materialType'] = $materialType;
        }
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'resource_data' => json_encode($data),
        ], ['id' => $this->itemId])->execute();
    }

    private function claim(FunctionalTester $I)
    {
        $this->request($I, 'POST', 'workflow-claim/claim', [], ['role' => 'staff', 'kind' => 'new', 'id' => $this->itemId]);
        $I->seeResponseCodeIs(200);
    }

    private function setPath(FunctionalTester $I, $accessPath, $reason = null)
    {
        $payload = ['access_path' => $accessPath];
        if ($reason !== null) {
            $payload['reason'] = $reason;
        }
        $this->request($I, 'POST', 'workflow-flow/access-path', $payload, [
            'role' => 'staff', 'kind' => 'new', 'id' => $this->itemId,
        ]);
    }

    private function switchFlow(FunctionalTester $I, $flowId)
    {
        $this->request($I, 'POST', 'workflow-flow/switch-flow', [
            'flow_id' => $flowId, 'reason' => 'Synthetic flow change',
        ], ['role' => 'staff', 'kind' => 'new', 'id' => $this->itemId]);
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, array $params)
    {
        $role = $params['role'] ?? 'staff';
        unset($params['role']);
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->tokens[$role]);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = $I->grabJsonResponse();
        Assert::assertIsArray($response);
        return $response;
    }

    private function token($role)
    {
        $username = $this->prefix . $role;
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'internal_id' => '999096001',
            'full_name' => 'Synthetic API-096 ' . ucfirst($role),
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertUser($role)
    {
        $username = $this->prefix . $role;
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $username, 'full_name' => 'Synthetic API-096 ' . ucfirst($role),
            'email' => $username . '@example.test', 'role' => $role, 'institution' => 'SM', 'approved' => 1,
        ])->execute();
    }

    private function steps($label)
    {
        return [[
            'key' => 'start', 'kind' => 'question', 'label' => $label, 'outcomes' => [],
        ]];
    }

    private function createFlow($name, $steps = null)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('flows', [
            'name' => $name, 'description' => 'Synthetic API-096 flow', 'created_by' => $this->prefix . 'staff',
        ])->execute();
        $flowId = (int)$db->getLastInsertID();
        if (is_array($steps)) {
            $db->createCommand()->insert('flow_versions', [
                'flow_id' => $flowId, 'version' => 1, 'steps_json' => json_encode($steps),
                'created_by' => $this->prefix . 'staff',
            ])->execute();
        }
        return $flowId;
    }

    private function createGroup()
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('staff_groups', [
            'name' => $this->prefix . 'Acquisitions', 'description' => 'Synthetic API-096 group',
            'created_by' => $this->prefix . 'admin',
        ])->execute();
        return (int)$db->getLastInsertID();
    }

    private function addGroupMember($groupId)
    {
        \Yii::$app->db->createCommand()->insert('staff_group_members', [
            'group_id' => $groupId, 'username' => $this->prefix . 'staff', 'added_by' => $this->prefix . 'admin',
        ])->execute();
    }

    private function mapPath($path, $flowId, $groupId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('access_path_flows', ['access_path' => $path])->execute();
        $db->createCommand()->insert('access_path_flows', [
            'access_path' => $path, 'flow_id' => $flowId, 'group_id' => $groupId,
        ])->execute();
    }

    private function storedPath()
    {
        return $this->item()['access_path'];
    }

    private function setStoredPath($path)
    {
        \Yii::$app->db->createCommand()->update('submission_new_resources', ['access_path' => $path], ['id' => $this->itemId])->execute();
    }

    private function item()
    {
        return \Yii::$app->db->createCommand(
            'SELECT access_path, assigned_group_id, claimed_by FROM submission_new_resources WHERE id = :id',
            [':id' => $this->itemId]
        )->queryOne();
    }

    private function latestRunId()
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT id FROM item_flow_runs WHERE item_kind = "new" AND item_id = :id ORDER BY id DESC LIMIT 1',
            [':id' => $this->itemId]
        )->queryScalar();
    }

    private function runs()
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM item_flow_runs WHERE item_kind = "new" AND item_id = :id ORDER BY id ASC',
            [':id' => $this->itemId]
        )->queryAll();
    }

    private function eventCount($eventType)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :submission_id AND event_type = :type',
            [':submission_id' => $this->submissionId, ':type' => $eventType]
        )->queryScalar();
    }

    private function lastAccessPathEvent()
    {
        $row = \Yii::$app->db->createCommand(
            'SELECT actor_username, before_json, after_json FROM workflow_events '
            . 'WHERE submission_id = :id AND event_type = "access_path_set" ORDER BY id DESC LIMIT 1',
            [':id' => $this->submissionId]
        )->queryOne();
        return [
            'actor_username' => $row['actor_username'],
            'before' => json_decode($row['before_json'], true),
            'after' => json_decode($row['after_json'], true),
        ];
    }

    private function mappingValue($path, $column)
    {
        $value = \Yii::$app->db->createCommand(
            'SELECT ' . $column . ' FROM access_path_flows WHERE access_path = :path', [':path' => $path]
        )->queryScalar();
        return $value === false || $value === null ? null : (int)$value;
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $itemIds = $db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id IN '
            . '(SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid)',
            [':uuid' => $this->uuid]
        )->queryColumn();
        if ($itemIds) {
            $db->createCommand()->delete('item_flow_runs', ['item_kind' => 'new', 'item_id' => $itemIds])->execute();
            $db->createCommand()->delete('workflow_events', ['item_kind' => 'new', 'item_id' => $itemIds])->execute();
        }
        $db->createCommand()->delete('workflow_events', [
            'and', ['submission_id' => null], ['like', 'actor_username', $this->prefix . '%', false],
        ])->execute();
        $submissionId = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid', [':uuid' => $this->uuid]
        )->queryScalar();
        if ($submissionId) {
            $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionId])->execute();
        }
        TestSubmissionFixture::delete($this->uuid);
        $db->createCommand()->delete('access_path_flows')->execute();
        $db->createCommand()->delete('staff_group_members', ['like', 'username', $this->prefix . '%', false])->execute();
        $groupIds = $db->createCommand('SELECT id FROM staff_groups WHERE name LIKE :name', [':name' => $this->prefix . '%'])->queryColumn();
        if ($groupIds) {
            $db->createCommand()->delete('staff_group_events', ['group_id' => $groupIds])->execute();
            $db->createCommand()->delete('staff_groups', ['id' => $groupIds])->execute();
        }
        $flowIds = $db->createCommand('SELECT id FROM flows WHERE created_by LIKE :actor', [':actor' => $this->prefix . '%'])->queryColumn();
        if ($flowIds) {
            $db->createCommand()->delete('flow_versions', ['flow_id' => $flowIds])->execute();
            $db->createCommand()->delete('flows', ['id' => $flowIds])->execute();
        }
        $db->createCommand()->delete('users', ['like', 'username', $this->prefix . '%', false])->execute();
    }
}
