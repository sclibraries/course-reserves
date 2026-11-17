<?php

require_once __DIR__ . '/PublicationDestinationConcurrencyWire.php';

use app\services\AccessPathPolicy;

/** Runs A3 services with acknowledged SQL barriers on independent worker connections. */
class SharedRowConcurrencyWorkerOps
{
    private static $request;
    private static $paused = false;

    public static function run($operation, array $request, $db)
    {
        self::$request = $request;
        self::$paused = false;
        SharedRowConcurrencyWorkerCommand::resetFailures();
        SharedRowConcurrencyWorkerCommand::setObserver(function ($sql) {
            self::observe($sql);
        });
        try {
            if ($operation === 'shared_resource_delete') {
                return (new \app\services\ResourceMutationService())->delete($request['resource_id']);
            }
            if ($operation === 'shared_attach') {
                $registry = new \app\services\PublicationDestinationRegistry($db);
                return $registry->attach($request['item'], (int)$request['destination_id']);
            }
            if ($operation === 'shared_create_version') {
                return (new \app\services\FlowAdminService())->createVersion(
                    $request['flow_id'], $request['body'], $request['actor']
                );
            }
            if ($operation === 'shared_switch_flow') {
                return (new \app\services\FlowRunner())->switchFlow(
                    $request['kind'], $request['item_id'], $request['actor'], $request['body']
                );
            }
            throw new \RuntimeException('Unknown shared-row operation: ' . $operation);
        } finally {
            SharedRowConcurrencyWorkerCommand::setObserver(null);
        }
    }

    public static function sqlFailures()
    {
        return SharedRowConcurrencyWorkerCommand::failures();
    }

    private static function observe($sql)
    {
        if (self::$paused || empty(self::$request['pause_after'])) {
            return;
        }
        $selector = self::$request['pause_after'];
        $patterns = [
            'destination_locked' => '/SELECT \* FROM publication_destinations WHERE id = .*FOR UPDATE/i',
            'resource_locked' => '/SELECT resource_id FROM resources WHERE resource_id = .*FOR UPDATE/i',
            'course_resource_locked' => '/SELECT course_resource_id, offering_id, resource_id, .* FROM course_resources WHERE course_resource_id = .*FOR UPDATE/i',
            'flow_locked' => '/SELECT \* FROM flows WHERE id = .*FOR UPDATE/i',
            'item_locked' => '/SELECT .* FROM submission_(?:new|reuse)_resources WHERE id = .*FOR UPDATE/i',
        ];
        if (!isset($patterns[$selector]) || !preg_match($patterns[$selector], $sql)) {
            return;
        }

        self::$paused = true;
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => self::$request['op'], 'attempt' => 1, 'phase' => 'locked',
            'context' => ['selector' => $selector, 'sql' => $sql],
        ]);
        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== 'locked') {
            throw new \RuntimeException('Shared-row worker received an invalid barrier acknowledgement.');
        }
    }
}

/** Observes actual SQL failures while preserving the B1 query log and execution path. */
class SharedRowConcurrencyWorkerCommand extends PublicationDestinationConcurrencyCommand
{
    private static $observer;
    private static $failures = [];

    public static function setObserver($observer)
    {
        self::$observer = $observer;
    }

    public static function resetFailures()
    {
        self::$failures = [];
    }

    public static function failures()
    {
        return self::$failures;
    }

    public function execute()
    {
        try {
            $result = parent::execute();
            self::observe($this->getRawSql());
            return $result;
        } catch (\Throwable $exception) {
            self::recordFailure($exception);
            throw $exception;
        }
    }

    protected function queryInternal($method, $fetchMode = null)
    {
        try {
            $result = parent::queryInternal($method, $fetchMode);
            self::observe($this->getRawSql());
            return $result;
        } catch (\Throwable $exception) {
            self::recordFailure($exception);
            throw $exception;
        }
    }

    private static function observe($sql)
    {
        if (self::$observer !== null) {
            call_user_func(self::$observer, $sql);
        }
    }

    private static function recordFailure(\Throwable $exception)
    {
        for (; $exception !== null; $exception = $exception->getPrevious()) {
            if ($exception instanceof \yii\db\Exception || $exception instanceof \PDOException) {
                $code = (int)($exception->errorInfo[1] ?? 0);
                if ($code) {
                    self::$failures[] = $code;
                    return;
                }
            }
        }
    }
}


trait Api119A3CurrentStateFixtureSupport
{
    private function materialTypeId()
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT material_type_id FROM material_types ORDER BY material_type_id LIMIT 1'
        )->queryScalar();
    }

    private function materialMapping($typeId, $flowId)
    {
        $rows = \Yii::$app->db->createCommand(
            'SELECT mt.name AS material_type, m.flow_id FROM material_types mt '
            . 'LEFT JOIN material_type_flows m ON m.material_type_id = mt.material_type_id ORDER BY mt.name'
        )->queryAll();
        foreach ($rows as &$row) {
            if ((int)\Yii::$app->db->createCommand(
                'SELECT material_type_id FROM material_types WHERE name = :name', [':name' => $row['material_type']]
            )->queryScalar() === (int)$typeId) {
                $row['flow_id'] = (int)$flowId;
            } elseif ($row['flow_id'] !== null) {
                $row['flow_id'] = (int)$row['flow_id'];
            }
        }
        unset($row);
        return $rows;
    }

    private function setMaterialFlow($typeId, $flowId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('material_type_flows', ['material_type_id' => $typeId])->execute();
        $db->createCommand()->insert('material_type_flows', [
            'material_type_id' => $typeId, 'flow_id' => $flowId,
        ])->execute();
    }

    private function materialFlow($typeId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT flow_id FROM material_type_flows WHERE material_type_id = :id', [':id' => $typeId]
        )->queryScalar();
    }

    private function accessMapping($changedPath, $flowId)
    {
        $existing = [];
        foreach (\Yii::$app->db->createCommand(
            'SELECT access_path, flow_id, group_id FROM access_path_flows'
        )->queryAll() as $row) {
            $existing[$row['access_path']] = $row;
        }
        $mapping = [];
        foreach (AccessPathPolicy::PATHS as $path) {
            $row = $existing[$path] ?? ['access_path' => $path, 'flow_id' => null, 'group_id' => null];
            if ($path === $changedPath) {
                $row['flow_id'] = $flowId;
            }
            $row['flow_id'] = $row['flow_id'] === null ? null : (int)$row['flow_id'];
            $row['group_id'] = $row['group_id'] === null ? null : (int)$row['group_id'];
            $mapping[] = $row;
        }
        return $mapping;
    }

    private function replaceAccessMappings(array $mapping)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('access_path_flows')->execute();
        foreach ($mapping as $row) {
            $db->createCommand()->insert('access_path_flows', $row)->execute();
        }
    }

    private function accessFlow($path)
    {
        return \Yii::$app->db->createCommand(
            'SELECT flow_id FROM access_path_flows WHERE access_path = :path', [':path' => $path]
        )->queryScalar();
    }

    private function publicationState(array $item)
    {
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => 'new', 'item_id' => $item['id'], 'submission_id' => $item['submission_id'],
            'state' => 'ready', 'draft_revision' => 1, 'workflow_revision' => 1,
            'published_revision' => null, 'pending_changes' => 'none', 'readiness_source' => 'flow',
            'readiness_reason' => 'prepared', 'readiness_revision' => 1, 'readiness_context_json' => '{}',
            'published_destination_json' => null, 'published_snapshot' => null,
        ])->execute();
    }

    private function publication(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
            [':id' => $item['id']]
        )->queryOne();
    }

    private function claim($itemId)
    {
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $this->prefix . 'staff', 'claimed_at' => '2026-11-17 11:00:00',
            'last_activity_at' => '2026-11-17 11:00:00',
        ], ['id' => $itemId])->execute();
    }

    private function expireClaim($itemId, $holder)
    {
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $holder, 'claimed_at' => '2026-11-12 12:00:00',
            'last_activity_at' => '2026-11-12 12:00:00',
        ], ['id' => $itemId])->execute();
    }

    private function itemRow($itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_new_resources WHERE id = :id', [':id' => $itemId]
        )->queryOne();
    }

    private function latestRun($itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM item_flow_runs WHERE item_kind = "new" AND item_id = :id ORDER BY id DESC LIMIT 1',
            [':id' => $itemId]
        )->queryOne();
    }

    private function runs($itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM item_flow_runs WHERE item_kind = "new" AND item_id = :id ORDER BY id',
            [':id' => $itemId]
        )->queryAll();
    }

    private function versionCount($flowId)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM flow_versions WHERE flow_id = :id', [':id' => $flowId]
        )->queryScalar();
    }

    private function steps($label)
    {
        return [[
            'key' => 'finish', 'kind' => 'finish', 'label' => $label,
            'finish_state' => 'prepared', 'outcomes' => [],
        ]];
    }
}
