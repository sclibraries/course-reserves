<?php

require_once __DIR__ . '/TestSubmissionFixture.php';

use PHPUnit\Framework\Assert;

/** Shared synthetic fixtures and cleanup for API-109 functional coverage. */
abstract class Api109FunctionalCest extends BaseFunctionalCest
{
    protected $prefix = 'test-api109-';
    protected $staffToken;
    protected $resourceIds = [];
    protected $savedMappings = [];
    protected $flowId;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        $this->insertStaff();
        $this->staffToken = $this->token();
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    protected function createSubmission($suffix)
    {
        $uuid = $this->uuid();
        return TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 109-' . substr(str_replace('-', '', $uuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
    }

    protected function createSource($materialTypeId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('resources', [
            'name' => 'Synthetic API-109 source',
            'item_url' => 'https://shared.example.test/source',
            'description' => 'Synthetic source description',
            'material_type_id' => $materialTypeId,
            'use_proxy' => 0,
        ])->execute();
        $id = (int)$db->getLastInsertID();
        $this->resourceIds[] = $id;
        return $id;
    }

    protected function mapTypesToSameFlow(array $typeIds)
    {
        $db = \Yii::$app->db;
        $typeIds = array_values(array_unique($typeIds));
        foreach ($typeIds as $typeId) {
            $this->savedMappings[$typeId] = $db->createCommand(
                'SELECT material_type_id, flow_id FROM material_type_flows WHERE material_type_id = :id',
                [':id' => $typeId]
            )->queryAll();
        }
        $db->createCommand()->delete('material_type_flows', ['material_type_id' => $typeIds])->execute();
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . 'same flow',
            'description' => 'Synthetic API-109 flow',
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $this->flowId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $this->flowId,
            'version' => 1,
            'steps_json' => json_encode([[
                'key' => 'start', 'kind' => 'manual', 'label' => 'Synthetic start', 'outcomes' => [],
            ]]),
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        foreach ($typeIds as $typeId) {
            $db->createCommand()->insert('material_type_flows', [
                'material_type_id' => $typeId,
                'flow_id' => $this->flowId,
            ])->execute();
        }
    }

    protected function materialTypeId($name)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE LOWER(name) = :name LIMIT 1',
            [':name' => $name]
        )->queryScalar();
    }

    protected function latestRun($kind, $itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM item_flow_runs WHERE item_kind = :kind AND item_id = :id ORDER BY id DESC LIMIT 1',
            [':kind' => $kind, ':id' => $itemId]
        )->queryOne();
    }

    protected function runs($kind, $itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM item_flow_runs WHERE item_kind = :kind AND item_id = :id ORDER BY id',
            [':kind' => $kind, ':id' => $itemId]
        )->queryAll();
    }

    protected function publicationRevision($kind, $itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT draft_revision FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
            [':kind' => $kind, ':id' => $itemId]
        )->queryScalar();
    }

    protected function detailAuditCount($kind, $itemId)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE item_kind = :kind AND item_id = :id '
            . 'AND event_type = "item_details_updated"',
            [':kind' => $kind, ':id' => $itemId]
        )->queryScalar();
    }

    protected function claim(FunctionalTester $I, $kind, $id)
    {
        $this->request($I, 'POST', 'workflow-claim/claim', [], ['kind' => $kind, 'id' => $id]);
        $I->seeResponseCodeIs(200);
    }

    protected function request(FunctionalTester $I, $method, $route, array $payload, array $params = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->staffToken);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    protected function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    protected function assertNoDestination($kind, $id)
    {
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $row = \Yii::$app->db->createCommand(
            'SELECT materialized_resource_id, materialized_course_resource_id, '
            . 'materialized_physical_reference_id, materialized_at FROM ' . $table . ' WHERE id = :id',
            [':id' => $id]
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
            'full_name' => 'Synthetic API-109 Staff',
            'email' => $this->prefix . 'staff@example.test',
            'role' => 'staff',
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function token()
    {
        $username = $this->prefix . 'staff';
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => 'staff',
            'id' => $username,
            'internal_id' => '999109001',
            'full_name' => 'Synthetic API-109 Staff',
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

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $submissionIds = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE course_title LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($submissionIds) {
            $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionIds])->execute();
            $db->createCommand()->delete('submission_publication_state', ['submission_id' => $submissionIds])->execute();
            foreach (['submission_new_resources' => 'new', 'submission_reuse_resources' => 'reuse'] as $table => $kind) {
                $ids = $db->createCommand(
                    'SELECT id FROM ' . $table . ' WHERE submission_id IN (' . implode(',', array_map('intval', $submissionIds)) . ')'
                )->queryColumn();
                if ($ids) {
                    $db->createCommand()->delete('item_flow_runs', [
                        'and', ['item_kind' => $kind], ['item_id' => $ids],
                    ])->execute();
                }
            }
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        foreach ($this->resourceIds as $resourceId) {
            $db->createCommand()->delete('resources', ['resource_id' => $resourceId])->execute();
        }
        if ($this->flowId) {
            $db->createCommand()->delete('material_type_flows', ['flow_id' => $this->flowId])->execute();
            $db->createCommand()->delete('flow_versions', ['flow_id' => $this->flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $this->flowId])->execute();
        }
        foreach ($this->savedMappings as $typeId => $mappings) {
            $db->createCommand()->delete('material_type_flows', ['material_type_id' => $typeId])->execute();
            foreach ($mappings as $mapping) {
                $db->createCommand()->insert('material_type_flows', $mapping)->execute();
            }
        }
        $db->createCommand()->delete('users', ['username' => $this->prefix . 'staff'])->execute();
        $this->resourceIds = [];
        $this->savedMappings = [];
        $this->flowId = null;
    }
}
