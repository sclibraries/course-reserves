<?php

use PHPUnit\Framework\Assert;

/** Injects deterministic deadlocks after earlier writes in an API-119A3 attempt. */
class Api119A3MutationCommand extends \yii\db\Command
{
    private static $pattern;
    private static $remaining = 0;
    private static $matches = 0;
    private static $queries = [];
    private static $afterFailure;

    public static function clearConfiguration()
    {
        self::$pattern = null;
        self::$remaining = self::$matches = 0;
        self::$queries = [];
        self::$afterFailure = null;
    }

    public static function resetQueries()
    {
        self::$queries = [];
    }

    public static function queries()
    {
        return self::$queries;
    }

    public static function failNext($pattern, $count = 1, $afterFailure = null)
    {
        self::$pattern = $pattern;
        self::$remaining = $count;
        self::$matches = 0;
        self::$afterFailure = $afterFailure;
    }

    public static function matches()
    {
        return self::$matches;
    }

    public function execute()
    {
        self::observe($this->getRawSql());
        return parent::execute();
    }

    protected function queryInternal($method, $fetchMode = null)
    {
        self::observe($this->getRawSql());
        return parent::queryInternal($method, $fetchMode);
    }

    private static function observe($sql)
    {
        self::$queries[] = $sql;
        if (self::$remaining === 0 || !preg_match(self::$pattern, $sql)) {
            return;
        }

        self::$remaining--;
        self::$matches++;
        \Yii::$app->db->createCommand('ROLLBACK')->execute();
        if (self::$afterFailure) {
            call_user_func(self::$afterFailure, self::$matches);
        }
        $previous = new \PDOException('Synthetic deadlock after an earlier write.');
        $previous->errorInfo = ['40001', 1213, 'Deadlock found when trying to get lock'];
        throw \Yii::$app->db->getSchema()->convertException(
            $previous,
            'UPDATE workflow_events SET event_type = event_type'
        );
    }
}

trait Api119A3MutationRequestSupport
{
    private function assertRetriedWriter(FunctionalTester $I, $operation, array $case)
    {
        Api119A3MutationCommand::failNext($case['failure_pattern'], 2);
        $this->send($I, $case);
        $I->seeResponseCodeIs($case['success_status']);
        Assert::assertSame(2, Api119A3MutationCommand::matches(), $operation);
        switch ($operation) {
            case 'resource-update':
                Assert::assertSame($this->prefix . 'updated', $this->resource($case['resource_id'])['name']);
                break;
            case 'resource-add-link':
                Assert::assertSame(1, $this->linkCount($case['resource_id'], $case['url']));
                break;
            case 'resource-delete-link':
                Assert::assertSame(0, $this->linkCount($case['resource_id'], $case['url']));
                break;
            case 'resource-delete':
                Assert::assertNull($this->resource($case['resource_id']));
                break;
            case 'material-map':
                Assert::assertSame($case['flow_id'], (int)$this->materialFlow($case['material_type_id']));
                break;
            case 'access-map':
                Assert::assertSame($case['flow_id'], (int)$this->accessFlow('purchase'));
                break;
            case 'flow-version':
                Assert::assertSame(2, $this->versionCount($case['flow_id']));
                break;
            case 'switch-flow':
                Assert::assertSame($case['flow_id'], (int)$this->latestRun($case['item_id'])['flow_id']);
                break;
        }
        Api119A3MutationCommand::clearConfiguration();
    }

    private function writerCase(FunctionalTester $I, $operation)
    {
        $case = ['operation' => $operation, 'success_status' => 200];
        if (strpos($operation, 'resource-') === 0) {
            $resourceId = $this->resourceRow($operation . '-resource');
            $item = $this->item($operation . '-item', null, $resourceId);
            $link = $this->link($resourceId, $operation . '-link');
            $case += ['resource_id' => $resourceId, 'item_id' => $item['id'], 'link_id' => $link['id']];
            $case['failure_pattern'] = '/SELECT submission_id FROM faculty_submissions WHERE submission_id = .* FOR UPDATE/i';
            if ($operation === 'resource-update') {
                $case += ['method' => 'PUT', 'route' => 'resource/update', 'params' => ['id' => $resourceId],
                    'body' => ['name' => $this->prefix . 'updated']];
            } elseif ($operation === 'resource-add-link') {
                $url = 'https://example.test/' . $this->prefix . $operation;
                $case += ['method' => 'POST', 'route' => 'resource/add-link', 'params' => ['resourceId' => $resourceId],
                    'body' => ['url' => $url, 'title' => 'Synthetic retry link'], 'url' => $url];
            } elseif ($operation === 'resource-delete-link') {
                $case += ['method' => 'DELETE', 'route' => 'resource/delete-link', 'params' => ['id' => $link['id']],
                    'body' => [], 'url' => $link['url']];
            } else {
                $case['method'] = 'DELETE';
                $case['route'] = 'resource/delete';
                $case['params'] = ['id' => $resourceId];
                $case['body'] = [];
                $case['success_status'] = 204;
            }
            return $case;
        }

        $case['failure_pattern'] = '/INSERT INTO `?workflow_events`?/i';
        if ($operation === 'material-map') {
            $typeId = $this->materialTypeId();
            $flowId = $this->flow($operation);
            $item = $this->item($operation . '-item', $typeId);
            $this->publicationState($item);
            $case += ['flow_id' => $flowId, 'material_type_id' => $typeId,
                'method' => 'PUT', 'route' => 'workflow-flow-admin/mapping', 'params' => [],
                'body' => ['mapping' => $this->materialMapping($typeId, $flowId)], 'role' => 'admin'];
        } elseif ($operation === 'access-map') {
            $flowId = $this->flow($operation);
            $item = $this->item($operation . '-item', null, null, 'purchase');
            $this->publicationState($item);
            $case += ['flow_id' => $flowId, 'method' => 'PUT', 'route' => 'workflow-flow-admin/access-path-mapping',
                'params' => [], 'body' => ['mapping' => $this->accessMapping('purchase', $flowId)], 'role' => 'admin'];
        } elseif ($operation === 'flow-version') {
            $flowId = $this->flow($operation);
            $case += ['flow_id' => $flowId, 'method' => 'POST', 'route' => 'workflow-flow-admin/versions',
                'params' => ['id' => $flowId], 'body' => ['steps' => $this->steps('Version two')], 'role' => 'admin',
                'success_status' => 201];
            $case['success_status'] = 201;
        } else {
            $item = $this->item($operation . '-item');
            $flowId = $this->flow($operation);
            $this->claim($item['id']);
            $case += ['item_id' => $item['id'], 'flow_id' => $flowId, 'method' => 'POST',
                'route' => 'workflow-flow/switch-flow', 'params' => ['kind' => 'new', 'id' => $item['id']],
                'body' => ['flow_id' => $flowId, 'reason' => 'Synthetic retry'], 'role' => 'staff'];
        }
        return $case;
    }

    private function send(FunctionalTester $I, array $case)
    {
        $this->request(
            $I,
            $case['method'],
            $case['route'],
            $case['body'],
            $case['role'] ?? 'staff',
            $case['params']
        );
    }

    private function request(FunctionalTester $I, $method, $route, array $body, $role, array $params = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . ($role === 'admin' ? $this->adminToken : $this->staffToken));
        $I->sendJsonRequest($method, $route, $body, $params);
    }

    private function writerSnapshot($operation, array $case)
    {
        switch ($operation) {
            case 'resource-update':
                return $this->resource($case['resource_id'])['name'];
            case 'resource-add-link':
                return $this->linkCount($case['resource_id'], $case['url']);
            case 'resource-delete-link':
                return $this->linkCount($case['resource_id'], $case['url']);
            case 'resource-delete':
                return $this->resource($case['resource_id'])['name'];
            case 'material-map':
                return $this->materialFlow($case['material_type_id']);
            case 'access-map':
                return $this->accessFlow('purchase');
            case 'flow-version':
                return $this->versionCount($case['flow_id']);
            case 'switch-flow':
                return [$this->runs($case['item_id']), $this->itemRow($case['item_id'])['claimed_by']];
        }
        return null;
    }

    private function resourceRow($name)
    {
        \Yii::$app->db->createCommand()->insert('resources', [
            'name' => $this->prefix . $name,
            'item_url' => 'https://example.test/' . $this->prefix . $name,
            'description' => 'Synthetic API-119A3 source',
            'use_proxy' => 0,
        ])->execute();
        $id = (int)\Yii::$app->db->getLastInsertID();
        $this->resourceIds[] = $id;
        return $id;
    }

    private function resource($id)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM resources WHERE resource_id = :id', [':id' => $id]
        )->queryOne() ?: null;
    }

    private function link($resourceId, $suffix)
    {
        $url = 'https://example.test/' . $this->prefix . $suffix;
        \Yii::$app->db->createCommand()->insert('resource_links', [
            'resource_id' => $resourceId, 'url' => $url, 'title' => 'Synthetic linked source', 'use_proxy' => 0,
        ])->execute();
        return ['id' => (int)\Yii::$app->db->getLastInsertID(), 'url' => $url];
    }

    private function linkCount($resourceId, $url)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM resource_links WHERE resource_id = :id AND url = :url',
            [':id' => $resourceId, ':url' => $url]
        )->queryScalar();
    }

    private function item($suffix, $materialTypeId = null, $sourceResourceId = null, $accessPath = null)
    {
        $uuid = $this->uuid();
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027', 'course_code' => 'TST 119A3-' . substr(str_replace('-', '', $uuid), 0, 8),
            'section' => '01', 'course_title' => $this->prefix . $suffix, 'link_state' => 'linked',
        ]);
        $this->uuids[] = $uuid;
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        $this->itemIds[] = $itemId;
        $values = array_filter([
            'material_type_id' => $materialTypeId,
            'source_resource_id' => $sourceResourceId === null ? null : (string)$sourceResourceId,
            'access_path' => $accessPath,
        ], function ($value) {
            return $value !== null;
        });
        if ($values) {
            \Yii::$app->db->createCommand()->update('submission_new_resources', $values, ['id' => $itemId])->execute();
        }
        return ['id' => $itemId, 'submission_id' => $submissionId, 'uuid' => $uuid];
    }

    private function flow($suffix)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . $suffix . '-' . count($this->flowIds),
            'description' => 'Synthetic API-119A3 flow',
            'created_by' => $this->prefix . 'admin',
        ])->execute();
        $id = (int)$db->getLastInsertID();
        $this->flowIds[] = $id;
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $id, 'version' => 1,
            'steps_json' => json_encode($this->steps('Synthetic flow'), JSON_UNESCAPED_SLASHES),
            'created_by' => $this->prefix . 'admin',
        ])->execute();
        return $id;
    }

}
