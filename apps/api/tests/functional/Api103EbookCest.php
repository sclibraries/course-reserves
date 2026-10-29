<?php

use PHPUnit\Framework\Assert;
use app\services\AccessPathPolicy;

/** Covers Ebook preparation, staff item details, and the privacy boundaries. */
class Api103EbookCest extends BaseFunctionalCest
{
    private $prefix = 'test-api103-';
    private $token;
    private $materialTypeId;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->insertStaff();
        $this->token = $this->token();
        $this->materialTypeId = (int)\Yii::$app->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE LOWER(name) = :name LIMIT 1',
            [':name' => 'ebook']
        )->queryScalar();
        Assert::assertGreaterThan(0, $this->materialTypeId, 'API-103 must install the Ebook material type.');
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    public function seededFlowOnlyPreparesItemsAndCoversEveryBranch(FunctionalTester $I)
    {
        $flow = $this->ebookFlow();
        $steps = json_decode($flow['steps_json'], true);
        Assert::assertSame('Do we have access?', $steps[0]['label']);
        Assert::assertSame('readers', $steps[0]['outcomes'][0]['next']['step']);
        Assert::assertSame("Can't get it", $steps[0]['outcomes'][2]['label']);
        Assert::assertSame(['finish' => 'needs_access_path'], $steps[0]['outcomes'][1]['next']);
        Assert::assertSame(['finish' => 'unavailable'], $steps[0]['outcomes'][2]['next']);
        Assert::assertSame('How many readers at once?', $steps[1]['label']);
        Assert::assertSame(['finish' => 'prepared'], $steps[1]['outcomes'][0]['next']);
        Assert::assertSame(['finish' => 'prepared'], $steps[1]['outcomes'][1]['next']);
        Assert::assertSame(['handoff_group' => 'Acquisitions'], $steps[1]['outcomes'][2]['next']);
        Assert::assertNotContains('publish_online', array_column($steps, 'kind'));

        $unlimited = $this->createEbookItem('unlimited');
        $this->startAndClaim($I, $unlimited['id']);
        $this->postStep($I, $unlimited['id'], 'own_it', 'yes');
        $this->postStep($I, $unlimited['id'], 'readers', 'unlimited');
        Assert::assertSame('prepared', $this->response($I)['finished']['finish_state']);
        $this->assertNotMaterialized($unlimited['id']);
        $this->request($I, 'POST', 'submission-workflow/complete-processing', [], ['itemId' => $unlimited['id']]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('publication_not_available_yet', $this->response($I)['error_code']);
        $this->assertNotMaterialized($unlimited['id']);

        $limited = $this->createEbookItem('limited');
        $this->startAndClaim($I, $limited['id']);
        $this->postStep($I, $limited['id'], 'own_it', 'yes');
        $this->postStep($I, $limited['id'], 'readers', 'limited_note');
        Assert::assertSame('prepared', $this->response($I)['finished']['finish_state']);
        $this->assertNotMaterialized($limited['id']);

        $needsAccess = $this->createEbookItem('needs-access');
        $this->startAndClaim($I, $needsAccess['id']);
        $this->postStep($I, $needsAccess['id'], 'own_it', 'no');
        Assert::assertSame('needs_access_path', $this->response($I)['finished']['finish_state']);
        Assert::assertSame(
            ['purchase', 'faculty_supplies'],
            AccessPathPolicy::allowedForItem(['resource_data' => json_encode(['materialType' => 'ebook'])])
        );
        $this->assertNotMaterialized($needsAccess['id']);

        $unavailable = $this->createEbookItem('unavailable');
        $this->startAndClaim($I, $unavailable['id']);
        $this->postStep($I, $unavailable['id'], 'own_it', 'cannot_get');
        $I->seeResponseCodeIs(400);
        Assert::assertSame('reason_required', $this->response($I)['error_code']);
        $this->postStep($I, $unavailable['id'], 'own_it', 'cannot_get', [
            'reason' => 'Synthetic Ebook unavailable reason',
        ]);
        Assert::assertSame('unavailable', $this->response($I)['finished']['finish_state']);
        $this->assertNotMaterialized($unavailable['id']);

        $this->createGroup();
        $purchase = $this->createEbookItem('buy-seats');
        $this->startAndClaim($I, $purchase['id']);
        $this->postStep($I, $purchase['id'], 'own_it', 'yes');
        $this->postStep($I, $purchase['id'], 'readers', 'limited_buy');
        $groupId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM staff_groups WHERE name = "Acquisitions" LIMIT 1'
        )->queryScalar();
        $handoff = \Yii::$app->db->createCommand(
            'SELECT claimed_by, assigned_group_id FROM submission_new_resources WHERE id = :id',
            [':id' => $purchase['id']]
        )->queryOne();
        Assert::assertNull($handoff['claimed_by']);
        Assert::assertSame($groupId, (int)$handoff['assigned_group_id']);
        $this->assertNotMaterialized($purchase['id']);
    }

    public function purchaseMoreSeatsReturnsClearErrorWhenAcquisitionsIsMissing(FunctionalTester $I)
    {
        $hiddenGroup = $this->hideAcquisitionsGroup();
        try {
            $item = $this->createEbookItem('missing-group');
            $this->startAndClaim($I, $item['id']);
            $this->postStep($I, $item['id'], 'own_it', 'yes');
            $this->postStep($I, $item['id'], 'readers', 'limited_buy');
            $I->seeResponseCodeIs(409);
            Assert::assertSame('unknown_group', $this->response($I)['error_code']);
            $this->assertNotMaterialized($item['id']);
        } finally {
            $this->restoreAcquisitionsGroup($hiddenGroup);
        }
    }

    public function staffDetailsRequireTheClaimAndAuditBothItemKinds(FunctionalTester $I)
    {
        $new = $this->createEbookItem('details-new', 'test-faculty-note');
        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'public_note' => 'Limited to 1 reader at a time',
            'assigned_pages' => '12-18',
        ], ['kind' => 'new', 'id' => $new['id']]);
        $I->seeResponseCodeIs(409);
        Assert::assertSame('not_claimed_by_you', $this->response($I)['error_code']);

        $this->claim($I, 'new', $new['id']);
        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'public_note' => 'Limited to 1 reader at a time',
            'assigned_pages' => '12-18',
        ], ['kind' => 'new', 'id' => $new['id']]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('Limited to 1 reader at a time', $this->response($I)['item']['public_note']);
        Assert::assertSame('12-18', $this->response($I)['item']['assigned_pages']);
        $this->assertNotMaterialized($new['id']);
        $resourceData = json_decode(\Yii::$app->db->createCommand(
            'SELECT resource_data FROM submission_new_resources WHERE id = :id', [':id' => $new['id']]
        )->queryScalar(), true);
        Assert::assertArrayNotHasKey('assignedPages', $resourceData);
        Assert::assertSame('101-108', $resourceData['pages']);
        $event = $this->lastDetailEvent('new', $new['id']);
        Assert::assertSame(['public_note' => null, 'assigned_pages' => null], $event['before']);
        Assert::assertSame([
            'public_note' => 'Limited to 1 reader at a time',
            'assigned_pages' => '12-18',
        ], $event['after']);

        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $new['submission_id'],
            'source_resource_id' => null,
            'faculty_notes' => 'test-reuse-faculty-note',
        ])->execute();
        $reuseId = (int)\Yii::$app->db->getLastInsertID();
        $this->claim($I, 'reuse', $reuseId);
        $this->request($I, 'PUT', 'workflow-item-details/update', [
            'public_note' => 'Synthetic reuse public note',
            'assigned_pages' => '44-46',
        ], ['kind' => 'reuse', 'id' => $reuseId]);
        $I->seeResponseCodeIs(200);
        Assert::assertSame('Synthetic reuse public note', $this->response($I)['item']['public_note']);
        Assert::assertSame('44-46', $this->response($I)['item']['assigned_pages']);
        $reuseEvent = $this->lastDetailEvent('reuse', $reuseId);
        Assert::assertSame(['public_note' => null, 'assigned_pages' => null], $reuseEvent['before']);
        Assert::assertSame([
            'public_note' => 'Synthetic reuse public note',
            'assigned_pages' => '44-46',
        ], $reuseEvent['after']);

        $this->request($I, 'GET', 'submission-workflow/view-submission', [], ['id' => $new['submission_id']]);
        $I->seeResponseCodeIs(200);
        $detail = $this->response($I);
        Assert::assertSame('Limited to 1 reader at a time', $detail['newResources'][0]['public_note']);
        Assert::assertSame('12-18', $detail['newResources'][0]['assigned_pages']);
        Assert::assertSame('Synthetic reuse public note', $detail['reuseResources'][0]['public_note']);
        Assert::assertSame('44-46', $detail['reuseResources'][0]['assigned_pages']);

        $this->request($I, 'OPTIONS', 'workflow-item-details/options', [], ['kind' => 'new', 'id' => $new['id']]);
        $I->seeResponseCodeIs(204);
    }

    private function createEbookItem($suffix, $facultyNote = null)
    {
        $uuid = $this->uuid();
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 103-' . substr(str_replace('-', '', $uuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $this->materialTypeId,
            'resource_data' => json_encode([
                'title' => 'Synthetic API-103 Ebook ' . $suffix,
                'materialType' => 'ebook',
                'description' => 'Synthetic abstract',
                'pages' => '101-108',
                'notes' => 'test-faculty-note',
            ]),
            'faculty_notes' => $facultyNote,
        ], ['id' => $itemId])->execute();
        return ['submission_id' => $submissionId, 'id' => $itemId, 'uuid' => $uuid];
    }

    private function startAndClaim(FunctionalTester $I, $itemId)
    {
        $this->request($I, 'GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $this->claim($I, 'new', $itemId);
    }

    private function claim(FunctionalTester $I, $kind, $itemId)
    {
        $this->request($I, 'POST', 'workflow-claim/claim', [], ['kind' => $kind, 'id' => $itemId]);
    }

    private function postStep(FunctionalTester $I, $itemId, $step, $outcome, array $extra = [])
    {
        $this->request($I, 'POST', 'workflow-flow/step-result', array_merge([
            'step_key' => $step,
            'outcome_key' => $outcome,
        ], $extra), ['kind' => 'new', 'id' => $itemId]);
        if (Yii::$app->response->statusCode === 200) {
            Assert::assertArrayHasKey('finished', $this->response($I));
        }
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, array $params = [])
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

    private function ebookFlow()
    {
        return \Yii::$app->db->createCommand(
            'SELECT f.id, v.steps_json FROM flows f '
            . 'INNER JOIN material_type_flows m ON m.flow_id = f.id '
            . 'INNER JOIN flow_versions v ON v.flow_id = f.id '
            . 'WHERE m.material_type_id = :type_id AND f.name = :name ORDER BY v.version DESC LIMIT 1',
            [':type_id' => $this->materialTypeId, ':name' => 'Ebook']
        )->queryOne();
    }

    private function createGroup()
    {
        $existing = \Yii::$app->db->createCommand(
            'SELECT id FROM staff_groups WHERE name = :name LIMIT 1', [':name' => 'Acquisitions']
        )->queryOne();
        if ($existing) {
            return;
        }
        \Yii::$app->db->createCommand()->insert('staff_groups', [
            'name' => 'Acquisitions',
            'description' => 'Synthetic API-103 Acquisitions group',
            'created_by' => $this->prefix . 'staff',
        ])->execute();
    }

    private function hideAcquisitionsGroup()
    {
        $db = \Yii::$app->db;
        $group = $db->createCommand(
            'SELECT id FROM staff_groups WHERE name = :name LIMIT 1', [':name' => 'Acquisitions']
        )->queryOne();
        if (!$group) {
            return null;
        }
        $db->createCommand()->update('staff_groups', [
            'name' => $this->prefix . 'hidden-' . bin2hex(random_bytes(3)),
        ], ['id' => (int)$group['id']])->execute();
        return (int)$group['id'];
    }

    private function restoreAcquisitionsGroup($groupId)
    {
        if ($groupId !== null) {
            \Yii::$app->db->createCommand()->update('staff_groups', [
                'name' => 'Acquisitions',
            ], ['id' => (int)$groupId])->execute();
        }
    }

    private function lastDetailEvent($kind, $itemId)
    {
        $event = \Yii::$app->db->createCommand(
            'SELECT before_json, after_json FROM workflow_events '
            . 'WHERE item_kind = :kind AND item_id = :id AND event_type = :event '
            . 'ORDER BY id DESC LIMIT 1',
            [':kind' => $kind, ':id' => $itemId, ':event' => 'item_details_updated']
        )->queryOne();
        return [
            'before' => json_decode($event['before_json'], true),
            'after' => json_decode($event['after_json'], true),
        ];
    }

    private function assertNotMaterialized($itemId)
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

    private function insertStaff()
    {
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $this->prefix . 'staff',
            'full_name' => 'Synthetic API-103 Staff',
            'email' => $this->prefix . 'staff@example.test',
            'role' => 'staff',
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function token()
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $this->prefix . 'staff',
            'role' => 'staff',
            'id' => $this->prefix . 'staff',
            'internal_id' => '999103001',
            'full_name' => 'Synthetic API-103 Staff',
            'email' => $this->prefix . 'staff@example.test',
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

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $submissionIds = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE course_title LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($submissionIds) {
            foreach (['new' => 'submission_new_resources', 'reuse' => 'submission_reuse_resources'] as $kind => $table) {
                $ids = $db->createCommand(
                    'SELECT id FROM ' . $table . ' WHERE submission_id IN ('
                    . implode(',', array_map('intval', $submissionIds)) . ')'
                )->queryColumn();
                if ($ids) {
                    $db->createCommand()->delete('item_flow_runs', ['item_kind' => $kind, 'item_id' => $ids])->execute();
                }
            }
            $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionIds])->execute();
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        $db->createCommand()->delete('staff_group_events', [
            'group_name' => 'Acquisitions',
            'actor_username' => $this->prefix . 'staff',
        ])->execute();
        $groupIds = $db->createCommand(
            'SELECT id FROM staff_groups WHERE created_by = :created_by',
            [':created_by' => $this->prefix . 'staff']
        )->queryColumn();
        if ($groupIds) {
            $db->createCommand()->delete('staff_groups', ['id' => $groupIds])->execute();
        }
        $db->createCommand()->delete('users', ['username' => $this->prefix . 'staff'])->execute();
    }
}
