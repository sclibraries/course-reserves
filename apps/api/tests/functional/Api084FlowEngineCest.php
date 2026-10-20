<?php

use PHPUnit\Framework\Assert;
use app\services\ItemClaimService;

/** Covers versioned staff flows, mappings, item history, and access control. */
class Api084FlowEngineCest extends BaseFunctionalCest
{
    private $prefix = 'test-api084-';
    private $tokens = [];
    private $materialTypeId;
    private $courseIds = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        foreach (['staff', 'member', 'admin', 'faculty', 'employee'] as $userType) {
            $this->insertUser($userType);
            $this->tokens[$userType] = $this->token($userType);
        }
        \Yii::$app->db->createCommand()->insert('material_types', [
            'name' => $this->prefix . 'book',
            'description' => 'Synthetic API-084 material type',
        ])->execute();
        $this->materialTypeId = (int)\Yii::$app->db->getLastInsertID();
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        \Yii::$container->clear(ItemClaimService::class);
    }

    public function adminRoutesValidateFlowDefinitionsAndRejectStaff(FunctionalTester $I)
    {
        $steps = $this->simpleSteps();
        $this->request($I, 'GET', 'workflow-flow-admin/flows', [], 'staff');
        $I->seeResponseCodeIs(403);
        $this->request($I, 'POST', 'workflow-flow-admin/flows', [
            'name' => $this->prefix . 'denied', 'steps' => $steps,
        ], 'staff');
        $I->seeResponseCodeIs(403);

        $this->request($I, 'POST', 'workflow-flow-admin/flows', [
            'name' => $this->prefix . 'invalid',
            'steps' => [[
                'key' => 'start', 'kind' => 'action', 'label' => 'Invalid', 'outcomes' => [],
            ]],
        ], 'admin');
        $I->seeResponseCodeIs(400);
        Assert::assertSame('invalid_flow', $this->response($I)['error_code']);

        $this->request($I, 'POST', 'workflow-flow-admin/flows', [
            'name' => $this->prefix . 'unused', 'description' => 'Synthetic flow', 'steps' => $steps,
        ], 'admin');
        $I->seeResponseCodeIs(201);
        $flowId = (int)$this->response($I)['flow']['id'];
        $this->request($I, 'GET', 'workflow-flow-admin/flow', [], 'staff', ['id' => $flowId]);
        $I->seeResponseCodeIs(403);
        $this->request($I, 'POST', 'workflow-flow-admin/versions', ['steps' => $steps], 'staff', ['id' => $flowId]);
        $I->seeResponseCodeIs(403);
        $this->request($I, 'GET', 'workflow-flow-admin/mapping', [], 'staff');
        $I->seeResponseCodeIs(403);

        $this->request($I, 'PUT', 'workflow-flow-admin/flow', [
            'name' => $this->prefix . 'unused-updated', 'description' => 'Updated synthetic flow',
        ], 'admin', ['id' => $flowId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($this->prefix . 'unused-updated', $this->response($I)['flow']['name']);
        $this->request($I, 'GET', 'workflow-flow-admin/flow', [], 'admin', ['id' => $flowId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(1, $this->response($I)['latest']['version']);
        Assert::assertSame('start', $this->response($I)['latest']['steps'][0]['key']);

        $this->request($I, 'DELETE', 'workflow-flow-admin/flow', [], 'admin', ['id' => $flowId]);
        $I->seeResponseCodeIs(204);
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id IS NULL AND event_type = "flow_created"'
        )->queryScalar());
    }

    public function mappingStartsFlowAndConfirmWaitsForLaterBuildStep(FunctionalTester $I)
    {
        $this->createGroup($I, 'Acquisitions');
        $flowId = $this->createFlow($I, $this->prefix . 'Print book', $this->printBookSteps());
        $this->mapFlow($I, $flowId);
        $item = $this->createItem('mapped');

        $this->request($I, 'GET', 'workflow-flow/flows', [], 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame($flowId, $this->findPickerFlow($this->response($I)['flows'], $flowId)['id']);
        Assert::assertContains($this->prefix . 'book', $this->findPickerFlow($this->response($I)['flows'], $flowId)['material_types']);

        $this->request($I, 'GET', 'workflow-flow/item-flow', [], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(200);
        $state = $this->response($I);
        Assert::assertSame($flowId, $state['flow']['id']);
        Assert::assertSame('own_it', $state['current_step']['step']['key']);
        Assert::assertFalse($state['can_act']);
        Assert::assertSame(1, $this->eventCount($item['submission_id'], 'flow_selected'));

        $this->postStep($I, $item['id'], 'own_it', 'yes', 'staff');
        $I->seeResponseCodeIs(409);
        Assert::assertSame('not_claimed_by_you', $this->response($I)['error_code']);
        $this->claim($I, $item['id'], 'staff');

        $this->postStep($I, $item['id'], 'stale', 'yes', 'staff');
        $I->seeResponseCodeIs(409);
        Assert::assertSame('stale_step', $this->response($I)['error_code']);
        $this->postStep($I, $item['id'], 'own_it', 'unknown', 'staff');
        $I->seeResponseCodeIs(400);
        Assert::assertSame('unknown_outcome', $this->response($I)['error_code']);

        $this->postStep($I, $item['id'], 'own_it', 'yes', 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame('available', $this->response($I)['current_step']['step']['key']);
        $this->postStep($I, $item['id'], 'available', 'available', 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame('pull', $this->response($I)['current_step']['step']['key']);
        $this->postStep($I, $item['id'], 'pull', 'done', 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame('folio_reserve', $this->response($I)['current_step']['step']['key']);
        $this->postStep($I, $item['id'], 'folio_reserve', 'done', 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame('confirm', $this->response($I)['current_step']['step']['key']);
        $this->postStep($I, $item['id'], 'confirm', 'done', 'staff');
        $I->seeResponseCodeIs(409);
        Assert::assertSame('step_not_available_yet', $this->response($I)['error_code']);

        $this->request($I, 'GET', 'workflow-claim/my-items', [], 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame(
            'Confirm on reserve in FOLIO',
            $this->findClaimedItem($this->response($I)['items'], $item['id'])['current_step_label']
        );
        Assert::assertNull($this->findClaimedItem($this->response($I)['items'], $item['id'])['finish_state']);
    }

    public function groupHandoffUsesSharedQueueAndFinishRequiresReason(FunctionalTester $I)
    {
        $groupId = $this->createGroup($I, 'Acquisitions');
        $this->addGroupMember($I, $groupId, 'member');
        $flowId = $this->createFlow($I, $this->prefix . 'group flow', $this->groupHandoffSteps('Acquisitions'));
        $this->mapFlow($I, $flowId);
        $item = $this->createItem('group-handoff');
        $this->claim($I, $item['id'], 'staff');
        $this->getItemFlow($I, $item['id'], 'staff');

        $this->postStep($I, $item['id'], 'own_it', 'no', 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertFalse($this->response($I)['can_act']);
        Assert::assertSame('no', $this->response($I)['history'][0]['outcome_key']);
        Assert::assertSame(1, $this->eventCount($item['submission_id'], 'group_handoff'));
        $this->request($I, 'GET', 'workflow-group/group-queue', [], 'member', ['id' => $groupId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame($item['id'], (int)$this->response($I)['items'][0]['id']);

        $this->claim($I, $item['id'], 'member');
        $this->postStep($I, $item['id'], 'own_it', 'cannot_get', 'member');
        $I->seeResponseCodeIs(400);
        Assert::assertSame('reason_required', $this->response($I)['error_code']);
        $this->postStep($I, $item['id'], 'own_it', 'cannot_get', 'member', ['reason' => 'Synthetic unavailable reason']);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('unavailable', $this->response($I)['finished']['finish_state']);
        Assert::assertSame('Synthetic unavailable reason', $this->response($I)['finished']['reason']);
        Assert::assertSame('Synthetic unavailable reason', $this->response($I)['history'][1]['reason']);
        Assert::assertSame(1, $this->eventCount($item['submission_id'], 'finished'));
        $this->request($I, 'GET', 'workflow-claim/my-items', [], 'member');
        $I->seeResponseCodeIs(200);
        $summary = $this->findClaimedItem($this->response($I)['items'], $item['id']);
        Assert::assertNull($summary['current_step_label']);
        Assert::assertSame('unavailable', $summary['finish_state']);
    }

    public function flowVersionsStayPinnedAndSwitchKeepsOldHistory(FunctionalTester $I)
    {
        $oldFlowId = $this->createFlow($I, $this->prefix . 'old flow', $this->middleSteps('Version one middle'));
        $otherFlowId = $this->createFlow($I, $this->prefix . 'other flow', $this->simpleSteps('Other start'));
        $this->mapFlow($I, $oldFlowId);
        $item = $this->createItem('switch');
        $this->claim($I, $item['id'], 'staff');
        $this->getItemFlow($I, $item['id'], 'staff');
        $this->postStep($I, $item['id'], 'start', 'done', 'staff');
        $I->seeResponseCodeIs(200);

        $this->request($I, 'POST', 'workflow-flow-admin/versions', [
            'steps' => $this->middleSteps('Version two middle'),
        ], 'admin', ['id' => $oldFlowId]);
        $I->seeResponseCodeIs(201);
        Assert::assertSame(2, $this->response($I)['version']['version']);
        $this->getItemFlow($I, $item['id'], 'staff');
        Assert::assertSame(1, $this->response($I)['flow']['version']);
        Assert::assertSame('Version one middle', $this->response($I)['current_step']['step']['label']);

        $this->request($I, 'POST', 'workflow-flow/switch-flow', [], 'staff', ['kind' => 'new', 'id' => $item['id']]);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('reason_required', $this->response($I)['error_code']);
        $this->switchFlow($I, $item['id'], 999999, 'staff', 'Synthetic reason');
        $I->seeResponseCodeIs(404);
        Assert::assertSame('unknown_flow', $this->response($I)['error_code']);
        $this->switchFlow($I, $item['id'], $otherFlowId, 'staff', 'Synthetic flow switch');
        $I->seeResponseCodeIs(200);
        Assert::assertSame($otherFlowId, $this->response($I)['flow']['id']);
        Assert::assertSame(1, $this->response($I)['flow']['version']);
        Assert::assertSame('start', $this->response($I)['history'][0]['step_key']);
        Assert::assertSame('Start', $this->response($I)['history'][0]['step_label']);
        Assert::assertSame(1, $this->eventCount($item['submission_id'], 'flow_changed'));

        $this->request($I, 'DELETE', 'workflow-flow-admin/flow', [], 'admin', ['id' => $oldFlowId]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('flow_in_use', $this->response($I)['error_code']);
    }

    public function unmappedItemsReturnNullAndMissingHandoffGroupsAreReported(FunctionalTester $I)
    {
        $unmapped = $this->createItem('unmapped');
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], 'staff', ['kind' => 'new', 'id' => $unmapped['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertNull($this->response($I)['flow']);
        Assert::assertNull($this->response($I)['run_id']);

        $groupId = $this->createGroup($I, $this->prefix . 'vanishing-group');
        $flowId = $this->createFlow($I, $this->prefix . 'vanishing flow', $this->groupHandoffSteps($this->prefix . 'vanishing-group'));
        $this->mapFlow($I, $flowId);
        $item = $this->createItem('missing-group');
        $this->claim($I, $item['id'], 'staff');
        $this->getItemFlow($I, $item['id'], 'staff');
        $this->request($I, 'DELETE', 'workflow-group/admin-group', [], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(204);
        $this->postStep($I, $item['id'], 'own_it', 'no', 'staff');
        $I->seeResponseCodeIs(409);
        Assert::assertSame('unknown_group', $this->response($I)['error_code']);
    }

    private function createFlow(FunctionalTester $I, $name, array $steps)
    {
        $this->request($I, 'POST', 'workflow-flow-admin/flows', [
            'name' => $name, 'description' => 'Synthetic API-084 flow', 'steps' => $steps,
        ], 'admin');
        $I->seeResponseCodeIs(201);
        return (int)$this->response($I)['flow']['id'];
    }

    private function mapFlow(FunctionalTester $I, $flowId)
    {
        $this->request($I, 'GET', 'workflow-flow-admin/mapping', [], 'admin');
        $I->seeResponseCodeIs(200);
        $mapping = $this->response($I)['mapping'];
        foreach ($mapping as &$row) {
            if ($row['material_type'] === $this->prefix . 'book') {
                $row['flow_id'] = $flowId;
            }
        }
        unset($row);
        $this->request($I, 'PUT', 'workflow-flow-admin/mapping', ['mapping' => $mapping], 'admin');
        $I->seeResponseCodeIs(200);
    }

    private function createGroup(FunctionalTester $I, $name)
    {
        $this->request($I, 'POST', 'workflow-group/admin-groups', [
            'name' => $name, 'description' => 'Synthetic API-084 group',
        ], 'admin');
        $I->seeResponseCodeIs(201);
        return (int)$this->response($I)['group']['id'];
    }

    private function addGroupMember(FunctionalTester $I, $groupId, $userType)
    {
        $this->request($I, 'POST', 'workflow-group/admin-group-members', [
            'username' => $this->prefix . $userType,
        ], 'admin', ['id' => $groupId]);
        $I->seeResponseCodeIs(201);
    }

    private function claim(FunctionalTester $I, $itemId, $userType)
    {
        $this->request($I, 'POST', 'workflow-claim/claim', [], $userType, ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
    }

    private function getItemFlow(FunctionalTester $I, $itemId, $userType)
    {
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], $userType, ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
    }

    private function postStep(FunctionalTester $I, $itemId, $stepKey, $outcomeKey, $userType, array $extra = [])
    {
        $this->request($I, 'POST', 'workflow-flow/step-result', array_merge([
            'step_key' => $stepKey, 'outcome_key' => $outcomeKey,
        ], $extra), $userType, ['kind' => 'new', 'id' => $itemId]);
    }

    private function switchFlow(FunctionalTester $I, $itemId, $flowId, $userType, $reason)
    {
        $this->request($I, 'POST', 'workflow-flow/switch-flow', [
            'flow_id' => $flowId, 'reason' => $reason,
        ], $userType, ['kind' => 'new', 'id' => $itemId]);
    }

    private function simpleSteps($label = 'Start question')
    {
        return [
            [
                'key' => 'start', 'kind' => 'question', 'label' => $label, 'help_text' => null,
                'outcomes' => [
                    ['key' => 'done', 'label' => 'Done', 'next' => ['finish' => 'finish']],
                    ['key' => 'skip', 'label' => 'Skip', 'next' => ['finish' => 'finish']],
                ],
            ],
            [
                'key' => 'finish', 'kind' => 'finish', 'label' => 'Finished', 'help_text' => null,
                'finish_state' => 'available_online', 'reason_required' => false, 'outcomes' => [],
            ],
        ];
    }

    private function middleSteps($middleLabel)
    {
        return [
            [
                'key' => 'start', 'kind' => 'question', 'label' => 'Start', 'help_text' => null,
                'outcomes' => [
                    ['key' => 'done', 'label' => 'Done', 'next' => ['step' => 'middle']],
                    ['key' => 'skip', 'label' => 'Skip', 'next' => ['finish' => 'finish']],
                ],
            ],
            [
                'key' => 'middle', 'kind' => 'action', 'label' => $middleLabel, 'help_text' => null,
                'outcomes' => [['key' => 'done', 'label' => 'Done', 'next' => ['finish' => 'finish']]],
            ],
            [
                'key' => 'finish', 'kind' => 'finish', 'label' => 'Finished', 'help_text' => null,
                'finish_state' => 'available_online', 'reason_required' => false, 'outcomes' => [],
            ],
        ];
    }

    private function groupHandoffSteps($groupName)
    {
        return [
            [
                'key' => 'own_it', 'kind' => 'question', 'label' => 'Do we own it?', 'help_text' => null,
                'outcomes' => [
                    ['key' => 'yes', 'label' => 'Yes', 'next' => ['finish' => 'on_reserve']],
                    ['key' => 'no', 'label' => 'No', 'next' => ['handoff_group' => $groupName]],
                    ['key' => 'cannot_get', 'label' => "We can't get this", 'next' => ['step' => 'unavailable']],
                ],
            ],
            [
                'key' => 'on_reserve', 'kind' => 'finish', 'label' => 'On reserve', 'help_text' => null,
                'finish_state' => 'on_reserve', 'reason_required' => false, 'outcomes' => [],
            ],
            [
                'key' => 'unavailable', 'kind' => 'finish', 'label' => 'Unavailable', 'help_text' => null,
                'finish_state' => 'unavailable', 'reason_required' => true, 'outcomes' => [],
            ],
        ];
    }

    private function printBookSteps()
    {
        return [
            [
                'key' => 'own_it', 'kind' => 'question', 'label' => 'Do we own it?', 'help_text' => null,
                'outcomes' => [
                    ['key' => 'yes', 'label' => 'Yes', 'next' => ['step' => 'available']],
                    ['key' => 'no', 'label' => 'No', 'next' => ['handoff_group' => 'Acquisitions']],
                    ['key' => 'cannot_get', 'label' => "We can't get this", 'next' => ['finish' => 'unavailable']],
                ],
            ],
            [
                'key' => 'available', 'kind' => 'question', 'label' => 'Is it available?', 'help_text' => null,
                'outcomes' => [
                    ['key' => 'available', 'label' => 'Available', 'next' => ['step' => 'pull']],
                    ['key' => 'checked_out', 'label' => 'Checked out', 'next' => ['step' => 'recall']],
                    ['key' => 'lost', 'label' => 'Lost', 'next' => ['handoff_group' => 'Acquisitions']],
                    ['key' => 'cannot_get', 'label' => "We can't get this", 'next' => ['finish' => 'unavailable']],
                ],
            ],
            [
                'key' => 'recall', 'kind' => 'action', 'label' => 'Recall it', 'help_text' => null,
                'outcomes' => [['key' => 'done', 'label' => 'Done', 'next' => ['step' => 'available']]],
            ],
            [
                'key' => 'pull', 'kind' => 'action', 'label' => 'Pull it from the shelf', 'help_text' => null,
                'outcomes' => [['key' => 'done', 'label' => 'Done', 'next' => ['step' => 'folio_reserve']]],
            ],
            [
                'key' => 'folio_reserve', 'kind' => 'action',
                'label' => 'Change its location to on reserve and attach it to the course in FOLIO', 'help_text' => null,
                'outcomes' => [['key' => 'done', 'label' => 'Done', 'next' => ['step' => 'confirm']]],
            ],
            [
                'key' => 'confirm', 'kind' => 'confirm_on_reserve', 'label' => 'Confirm on reserve in FOLIO',
                'help_text' => null, 'outcomes' => [['key' => 'done', 'label' => 'Done', 'next' => ['finish' => 'on_reserve']]],
            ],
            [
                'key' => 'on_reserve', 'kind' => 'finish', 'label' => 'On reserve', 'help_text' => null,
                'finish_state' => 'on_reserve', 'reason_required' => false, 'outcomes' => [],
            ],
            [
                'key' => 'unavailable', 'kind' => 'finish', 'label' => 'Unavailable', 'help_text' => null,
                'finish_state' => 'unavailable', 'reason_required' => true, 'outcomes' => [],
            ],
        ];
    }

    private function createItem($suffix)
    {
        $uuid = $this->uuid();
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 084-' . substr(str_replace('-', '', $uuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id ASC LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $this->materialTypeId,
            'resource_data' => json_encode(['title' => 'Synthetic API-084 item']),
        ], ['id' => $itemId])->execute();
        return ['submission_id' => $submissionId, 'id' => $itemId, 'uuid' => $uuid];
    }

    private function findPickerFlow(array $flows, $id)
    {
        foreach ($flows as $flow) {
            if ((int)$flow['id'] === (int)$id) {
                return $flow;
            }
        }
        $this->fail('Expected flow in picker: ' . $id);
    }

    private function findClaimedItem(array $items, $id)
    {
        foreach ($items as $item) {
            if ((int)$item['id'] === (int)$id) {
                return $item;
            }
        }
        $this->fail('Expected item in claims list: ' . $id);
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, $userType, array $params = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->tokens[$userType]);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function token($userType)
    {
        $username = $this->prefix . $userType;
        $role = $userType === 'admin' ? 'admin' : ($userType === 'faculty' ? 'faculty' : ($userType === 'employee' ? 'employee' : 'staff'));
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1, 'exp' => time() + 3600, 'username' => $username, 'role' => $role,
            'id' => $username, 'internal_id' => '999084001', 'full_name' => 'Synthetic API-084 ' . ucfirst($userType),
            'email' => $username . '@example.test', 'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertUser($userType)
    {
        $role = $userType === 'admin' ? 'admin' : ($userType === 'faculty' ? 'faculty' : ($userType === 'employee' ? 'employee' : 'staff'));
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $this->prefix . $userType,
            'full_name' => 'Synthetic API-084 ' . ucfirst($userType),
            'email' => $this->prefix . $userType . '@example.test',
            'role' => $role,
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function eventCount($submissionId, $eventType)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :submission_id AND event_type = :event_type',
            [':submission_id' => $submissionId, ':event_type' => $eventType]
        )->queryScalar();
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
            $newIds = $db->createCommand(
                'SELECT id FROM submission_new_resources WHERE submission_id IN (' . implode(',', array_map('intval', $submissionIds)) . ')'
            )->queryColumn();
            $reuseIds = $db->createCommand(
                'SELECT id FROM submission_reuse_resources WHERE submission_id IN (' . implode(',', array_map('intval', $submissionIds)) . ')'
            )->queryColumn();
            if ($newIds) {
                $db->createCommand()->delete('item_flow_runs', ['item_kind' => 'new', 'item_id' => $newIds])->execute();
            }
            if ($reuseIds) {
                $db->createCommand()->delete('item_flow_runs', ['item_kind' => 'reuse', 'item_id' => $reuseIds])->execute();
            }
            $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionIds])->execute();
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        $db->createCommand()->delete('workflow_events', [
            'and', ['submission_id' => null], ['like', 'actor_username', $this->prefix . '%', false],
        ])->execute();
        $db->createCommand()->delete('material_types', ['like', 'name', $this->prefix . '%', false])->execute();
        $db->createCommand()->delete('flows', ['like', 'created_by', $this->prefix . '%', false])->execute();
        $db->createCommand()->delete('staff_group_events', ['like', 'group_name', $this->prefix . '%', false])->execute();
        $db->createCommand()->delete('staff_group_events', ['group_name' => 'Acquisitions'])->execute();
        $groupIds = $db->createCommand(
            'SELECT id FROM staff_groups WHERE name LIKE :prefix OR name = :acquisitions',
            [':prefix' => $this->prefix . '%', ':acquisitions' => 'Acquisitions']
        )->queryColumn();
        if ($groupIds) {
            $db->createCommand()->delete('staff_groups', ['id' => $groupIds])->execute();
        }
        $db->createCommand()->delete('users', ['like', 'username', $this->prefix . '%', false])->execute();
        $this->courseIds = [];
    }
}
