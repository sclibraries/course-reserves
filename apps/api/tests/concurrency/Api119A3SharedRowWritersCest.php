<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';

use PHPUnit\Framework\Assert;

class Api119A3SharedRowWritersCest extends Api116B1ConcurrencyCase
{
    private $prefix;
    private $flowIds = [];
    private $materialTypeId;
    private $savedMaterialMappings;

    public function _before(ConcurrencyTester $I)
    {
        parent::_before($I);
        $this->prefix = 'test-api119a3-' . substr(md5(uniqid('', true)), 0, 8) . '-';
    }

    public function _after(ConcurrencyTester $I)
    {
        $this->supervisor->stopAll();
        $db = \Yii::$app->db;
        if ($this->materialTypeId) {
            $db->createCommand()->delete('material_type_flows', ['material_type_id' => $this->materialTypeId])->execute();
            foreach ($this->savedMaterialMappings ?: [] as $row) {
                $db->createCommand()->insert('material_type_flows', $row)->execute();
            }
        }
        $db->createCommand('DELETE FROM workflow_events WHERE actor_username LIKE :prefix', [
            ':prefix' => $this->prefix . '%',
        ])->execute();
        foreach ($this->flowIds as $flowId) {
            $db->createCommand()->delete('item_flow_runs', ['flow_id' => $flowId])->execute();
            $db->createCommand()->delete('flow_versions', ['flow_id' => $flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $flowId])->execute();
        }
        parent::_after($I);
    }

    public function resourceDeletionAndRegistryAttachResolveTheirRealLockCycle(ConcurrencyTester $I)
    {
        $item = $this->item('source-delete-race');
        $pointer = $this->electronic('source-delete-race');
        $this->tracker->fixture()->setMarkers($item, [
            'source_resource_id' => (string)$pointer['resource_id'],
        ]);
        $destinationId = $this->tracker->insertDestination($pointer);

        $this->startOperation('a3-delete', 'shared_resource_delete', [
            'resource_id' => $pointer['resource_id'],
            'pause_after' => 'resource_locked',
        ]);
        $locked = $this->supervisor->awaitPhase('a3-delete', 'locked', 1);
        Assert::assertRegExp('/FROM resources/', $locked['context']['sql']);
        $this->startOperation('a3-attach', 'shared_attach', [
            'item' => $item,
            'destination_id' => $destinationId,
            'pause_after' => 'course_resource_locked',
        ]);
        $locked = $this->supervisor->awaitPhase('a3-attach', 'locked', 1);
        Assert::assertRegExp('/FROM course_resources/', $locked['context']['sql']);
        $this->supervisor->release('a3-delete', 'locked', 1);
        $this->awaitWorkerQuery('a3-delete', '/DELETE FROM `?resources`?/i');
        $this->supervisor->release('a3-attach', 'locked', 1);

        $deleted = $this->supervisor->complete('a3-delete');
        $attached = $this->supervisor->complete('a3-attach');
        Assert::assertContains(1213, $deleted['sql_failures'], 'Resource deletion must be a real deadlock victim and retry.');
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM resources WHERE resource_id = :id', [':id' => $pointer['resource_id']]
        )->queryScalar());
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM course_resources WHERE resource_id = :id', [':id' => $pointer['resource_id']]
        )->queryScalar());
        $destination = \Yii::$app->db->createCommand(
            'SELECT course_resource_id FROM publication_destinations WHERE id = :id', [':id' => $destinationId]
        )->queryOne();
        Assert::assertSame(['course_resource_id' => null], $destination);
        $attachments = (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM publication_attachments WHERE destination_id = :id AND live = 1',
            [':id' => $destinationId]
        )->queryScalar();
        Assert::assertSame(200, $attached['result']['status']);
        Assert::assertSame(1, $attachments);
    }

    public function flowVersionCreationAndSwitchResolveTheirActual1213Race(ConcurrencyTester $I)
    {
        $item = $this->item('flow-version-switch-race');
        $this->materialTypeId = (int)\Yii::$app->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE name = "ebook" LIMIT 1'
        )->queryScalar();
        Assert::assertGreaterThan(0, $this->materialTypeId);
        $this->savedMaterialMappings = \Yii::$app->db->createCommand(
            'SELECT material_type_id, flow_id FROM material_type_flows WHERE material_type_id = :id',
            [':id' => $this->materialTypeId]
        )->queryAll();
        $flowId = $this->createFlow();
        $db = \Yii::$app->db;
        $db->createCommand()->delete('material_type_flows', ['material_type_id' => $this->materialTypeId])->execute();
        $db->createCommand()->insert('material_type_flows', [
            'material_type_id' => $this->materialTypeId, 'flow_id' => $flowId,
        ])->execute();
        $this->tracker->fixture()->setMarkers($item, ['material_type_id' => $this->materialTypeId]);
        $db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $this->prefix . 'staff', 'claimed_at' => '2026-11-17 11:00:00',
            'last_activity_at' => '2026-11-17 11:00:00',
        ], ['id' => $item['id']])->execute();

        $steps = [[
            'key' => 'finish', 'kind' => 'finish', 'label' => 'Synthetic version two',
            'finish_state' => 'prepared', 'outcomes' => [],
        ]];
        $this->startOperation('a3-switch', 'shared_switch_flow', [
            'kind' => 'new', 'item_id' => $item['id'],
            'actor' => ['username' => $this->prefix . 'staff', 'role' => 'staff'],
            'body' => ['flow_id' => $flowId, 'reason' => 'Synthetic race switch'],
            'pause_after' => 'item_locked',
        ]);
        $locked = $this->supervisor->awaitPhase('a3-switch', 'locked', 1);
        Assert::assertRegExp('/submission_new_resources/', $locked['context']['sql']);
        $this->startOperation('a3-version', 'shared_create_version', [
            'flow_id' => $flowId,
            'actor' => ['username' => $this->prefix . 'admin', 'role' => 'admin'],
            'body' => ['steps' => $steps],
            'pause_after' => 'flow_locked',
        ]);
        $locked = $this->supervisor->awaitPhase('a3-version', 'locked', 1);
        Assert::assertRegExp('/FROM flows/', $locked['context']['sql']);
        $this->supervisor->release('a3-switch', 'locked', 1);
        $this->awaitWorkerQuery('a3-switch', '/FROM `?flows`? WHERE `?id`?.*FOR UPDATE/i');
        $this->supervisor->release('a3-version', 'locked', 1);

        $version = $this->supervisor->complete('a3-version');
        $switch = $this->supervisor->complete('a3-switch');
        Assert::assertContains(1213, $switch['sql_failures'], 'Switching must retry the real flow-version lock cycle.');
        Assert::assertSame(201, $version['result']['status']);
        Assert::assertSame(200, $switch['result']['status']);
        Assert::assertSame(2, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM flow_versions WHERE flow_id = :id', [':id' => $flowId]
        )->queryScalar());
        $runs = \Yii::$app->db->createCommand(
            'SELECT flow_id, version, closed_at FROM item_flow_runs WHERE item_kind = "new" AND item_id = :id ORDER BY id',
            [':id' => $item['id']]
        )->queryAll();
        Assert::assertCount(1, $runs);
        Assert::assertSame((string)$flowId, $runs[0]['flow_id']);
        Assert::assertContains((int)$runs[0]['version'], [1, 2]);
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE submission_id = :id AND event_type = "flow_changed"',
            [':id' => $item['submission_id']]
        )->queryScalar());
    }

    private function createFlow()
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . 'race-flow', 'description' => 'Synthetic A3 concurrency flow',
            'created_by' => $this->prefix . 'admin',
        ])->execute();
        $flowId = (int)$db->getLastInsertID();
        $this->flowIds[] = $flowId;
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $flowId, 'version' => 1,
            'steps_json' => json_encode([[
                'key' => 'finish', 'kind' => 'finish', 'label' => 'Synthetic version one',
                'finish_state' => 'prepared', 'outcomes' => [],
            ]], JSON_UNESCAPED_SLASHES),
            'created_by' => $this->prefix . 'admin',
        ])->execute();
        return $flowId;
    }

    private function awaitWorkerQuery($label, $pattern)
    {
        $deadline = microtime(true) + 8.0;
        while (microtime(true) < $deadline) {
            $thread = \Yii::$app->db->createCommand(
                'SELECT COMMAND, TIME_MS, INFO FROM information_schema.PROCESSLIST WHERE ID = :id',
                [':id' => $this->connections[$label]]
            )->queryOne();
            if ($thread && $thread['COMMAND'] === 'Query' && preg_match($pattern, (string)$thread['INFO'])) {
                return;
            }
            usleep(50000);
        }
        Assert::fail($label . ' did not block on ' . $pattern . ': ' . json_encode($thread));
    }
}
