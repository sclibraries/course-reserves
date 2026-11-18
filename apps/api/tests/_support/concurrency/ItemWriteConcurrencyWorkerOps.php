<?php

use PHPUnit\Framework\Assert;

/** Exercises staged item acquisition with an acknowledged barrier after parent discovery. */
class ItemWriteConcurrencyWorkerOps
{
    private static $request;
    private static $discoveries;
    private static $candidatePaused;

    public static function run(array $request)
    {
        self::$request = $request;
        self::$discoveries = 0;
        self::$candidatePaused = false;
        Api119A4ItemLockConcurrencyCommand::setObserver(function ($sql) {
            self::observe($sql);
        });
        try {
            if (self::$request['op'] === 'item_lock_resource_update') {
                $updated = (new \app\services\ResourceMutationService())->update(
                    self::$request['resource_id'], self::$request['body']
                );
                return ['resource_name' => $updated['resource']->name];
            }

            if (self::$request['op'] === 'item_lock_linked_claim') {
                $result = (new \app\services\ItemClaimService())->claim(
                    self::$request['kind'],
                    self::$request['item_id'],
                    ['username' => self::$request['actor'], 'role' => 'staff']
                );
                return ['status' => $result['status'], 'body' => $result['body']];
            }

            $reader = new \app\services\ItemWriteLock();
            $locked = \app\services\Transactional::retrying(function () use ($reader) {
                return $reader->lock(self::$request['kind'], self::$request['item_id']);
            });
            return [
                'submission_id' => (int)$locked['submission_id'],
                'submission' => $locked['submission']->getAttributes(),
                'item' => $locked['item']->getAttributes(),
            ];
        } finally {
            Api119A4ItemLockConcurrencyCommand::setObserver(null);
        }
    }

    private static function observe($sql)
    {
        if (self::$request['op'] === 'item_lock_resource_update' && !self::$candidatePaused
            && preg_match('/SELECT "new" AS kind, item\.id, item\.submission_id FROM submission_new_resources item '
                . 'WHERE item\.source_resource_id =/i', $sql)) {
            self::$candidatePaused = true;
            self::checkpoint('discovered', 0, $sql);
            return;
        }

        if (!preg_match(
            '/SELECT\s+submission_id\s+FROM\s+submission_(?:new|reuse)_resources\s+WHERE\s+id\s*=/i',
            $sql
        )) {
            return;
        }
        self::$discoveries++;
        if (self::$discoveries > (int)(self::$request['pause_attempts'] ?? 0)) {
            return;
        }
        self::checkpoint('discovered', self::$discoveries, $sql);
    }

    private static function checkpoint($phase, $attempt, $sql)
    {
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => self::$request['op'],
            'attempt' => $attempt,
            'phase' => $phase,
            'context' => ['sql' => $sql],
        ]);
        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== $phase
            || (int)($answer['attempt'] ?? -1) !== $attempt) {
            throw new \RuntimeException('Item lock worker received an invalid discovery acknowledgement.');
        }
    }
}

/** Injects retryable item contention at real SQL boundaries and records what committed callbacks can observe. */
class Api119A4TestCommand extends \yii\db\Command
{
    private static $itemId;
    private static $beforeFailures = 0;
    private static $afterPattern;
    private static $afterFailures = 0;
    private static $afterMatches = 0;
    private static $discoveries = 0;
    private static $queries = [];

    public static function resetHarness()
    {
        self::$itemId = null;
        self::$beforeFailures = 0;
        self::$afterPattern = null;
        self::$afterFailures = 0;
        self::$afterMatches = 0;
        self::$discoveries = 0;
        self::$queries = [];
    }

    public static function failBeforeDiscovery($itemId, $count)
    {
        self::resetHarness();
        self::$itemId = (int)$itemId;
        self::$beforeFailures = (int)$count;
    }

    public static function failAfterQuery($pattern, $count)
    {
        self::resetHarness();
        self::$afterPattern = $pattern;
        self::$afterFailures = (int)$count;
    }

    public static function discoveries()
    {
        return self::$discoveries;
    }

    public static function afterMatches()
    {
        return self::$afterMatches;
    }

    public static function countQueries($pattern)
    {
        return count(array_filter(self::$queries, function ($sql) use ($pattern) {
            return preg_match($pattern, $sql);
        }));
    }

    public static function queries()
    {
        return self::$queries;
    }

    protected function queryInternal($method, $fetchMode = null)
    {
        $sql = $this->getRawSql();
        self::$queries[] = $sql;
        if (self::isDiscovery($sql)) {
            self::$discoveries++;
            if (self::$beforeFailures > 0) {
                self::$beforeFailures--;
                throw new \app\services\ItemAssociationChanged('Synthetic item association retry.');
            }
        }

        $result = parent::queryInternal($method, $fetchMode);
        if (self::$afterPattern !== null && preg_match(self::$afterPattern, $sql)) {
            self::$afterMatches++;
            if (self::$afterFailures > 0) {
                self::$afterFailures--;
                throw new \app\services\ItemAssociationChanged('Synthetic retry after an attempt-local query.');
            }
        }
        return $result;
    }

    private static function isDiscovery($sql)
    {
        return self::$itemId !== null && preg_match(
            '/SELECT submission_id FROM submission_(?:new|reuse)_resources WHERE id\s*=\s*'
                . self::$itemId . '\s+LIMIT 1/i',
            $sql
        );
    }
}

class Api119A4NotifierSpy
{
    private $callback;

    public function __construct(callable $callback)
    {
        $this->callback = $callback;
    }

    public function notify($event, array $context)
    {
        call_user_func($this->callback, $event, $context);
    }
}

trait Api119A4LinkedItemFixtureSupport
{
    private function createItem($suffix)
    {
        $uuid = sprintf('7711%04x-0000-4000-8000-%012x', count($this->submissionUuids) + 1, mt_rand(1, 0xffffffffff));
        $this->submissionUuids[] = $uuid;
        $submissionId = TestSubmissionFixture::create($uuid, $this->username('faculty'), [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 119A4B-' . $suffix,
            'section' => '01',
            'course_title' => 'Synthetic linked item ' . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
            'status' => 'submitted',
        ]);
        $id = (int)Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        return ['id' => $id, 'submission_id' => $submissionId, 'uuid' => $uuid];
    }

    private function createFlow()
    {
        return $this->insertFlow([[
            'key' => 'start', 'kind' => 'question', 'label' => 'Synthetic start', 'outcomes' => [],
        ]]);
    }

    private function createHandoffFlow()
    {
        return $this->insertFlow([[
            'key' => 'start', 'kind' => 'question', 'label' => 'Synthetic start',
            'outcomes' => [[
                'key' => 'route', 'label' => 'Route to group', 'next' => ['handoff_group' => $this->groupName],
            ]],
        ]]);
    }

    private function insertFlow(array $steps)
    {
        $db = Yii::$app->db;
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . 'flow-' . (count($this->flowIds) + 1),
            'description' => 'Synthetic API-119A4b flow',
            'created_by' => $this->username('staff'),
        ])->execute();
        $flowId = (int)$db->getLastInsertID();
        $this->flowIds[] = $flowId;
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $flowId,
            'version' => 1,
            'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES),
            'created_by' => $this->username('staff'),
        ])->execute();
        return $flowId;
    }

    private function createGroup()
    {
        $db = Yii::$app->db;
        $db->createCommand()->insert('staff_groups', [
            'name' => $this->groupName,
            'description' => 'Synthetic API-119A4b group',
            'created_by' => $this->username('staff'),
        ])->execute();
        $groupId = (int)$db->getLastInsertID();
        foreach (['staff', 'member'] as $role) {
            $db->createCommand()->insert('staff_group_members', [
                'group_id' => $groupId,
                'username' => $this->username($role),
                'added_by' => $this->username('staff'),
            ])->execute();
        }
        return $groupId;
    }

    private function mapPurchasePath($flowId)
    {
        $db = Yii::$app->db;
        $db->createCommand()->delete('access_path_flows', ['access_path' => 'purchase'])->execute();
        $db->createCommand()->insert('access_path_flows', [
            'access_path' => 'purchase', 'flow_id' => $flowId, 'group_id' => $this->groupId,
        ])->execute();
    }

    private function claimItem(FunctionalTester $I, $itemId)
    {
        $status = $this->request($I, 'POST', 'workflow-claim/claim', [], ['kind' => 'new', 'id' => $itemId]);
        $item = $this->response($I)['item'] ?? null;
        Assert::assertSame(200, $status);
        Assert::assertSame($this->username('staff'), $item['claimed_by'] ?? null);
    }

    private function request(FunctionalTester $I, $method, $route, array $body, array $params = [])
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->staffToken);
        return $I->sendJsonRequest($method, $route, $body, $params);
    }

    private function response(FunctionalTester $I)
    {
        $body = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($body);
        return $body;
    }

    private function username($role)
    {
        return $this->prefix . $role;
    }

    private function token($role)
    {
        $username = $this->username($role);
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => 'staff',
            'id' => $username,
            'internal_id' => '999119004',
            'full_name' => 'Synthetic API-119A4b Staff',
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertUser($role)
    {
        $username = $this->username($role);
        $this->usernames[] = $username;
        Yii::$app->db->createCommand()->insert('users', [
            'username' => $username,
            'full_name' => 'Synthetic API-119A4b ' . ucfirst($role),
            'email' => $username . '@example.test',
            'role' => 'staff',
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function queryIndex($pattern)
    {
        foreach (Api119A4TestCommand::queries() as $index => $sql) {
            if (preg_match($pattern, $sql)) {
                return $index;
            }
        }
        return -1;
    }

    private function observerEventCount($itemId, $event)
    {
        return (int)$this->observer->createCommand(
            'SELECT COUNT(*) FROM workflow_events WHERE item_kind = "new" AND item_id = :id AND event_type = :event',
            [':id' => $itemId, ':event' => $event]
        )->queryScalar();
    }

    private function cleanup()
    {
        $db = Yii::$app->db;
        foreach ($this->submissionUuids as $uuid) {
            $submissionId = $db->createCommand(
                'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid', [':uuid' => $uuid]
            )->queryScalar();
            if ($submissionId) {
                $itemIds = $db->createCommand(
                    'SELECT id FROM submission_new_resources WHERE submission_id = :id', [':id' => $submissionId]
                )->queryColumn();
                if ($itemIds) {
                    $db->createCommand()->delete('item_flow_runs', ['item_kind' => 'new', 'item_id' => $itemIds])->execute();
                    $db->createCommand()->delete('workflow_events', ['item_kind' => 'new', 'item_id' => $itemIds])->execute();
                    $db->createCommand()->delete(
                        'submission_publication_state', ['item_kind' => 'new', 'item_id' => $itemIds]
                    )->execute();
                }
            }
            TestSubmissionFixture::delete($uuid);
        }
        $db->createCommand()->delete('access_path_flows', ['access_path' => 'purchase'])->execute();
        foreach ($this->oldAccessPathMappings as $mapping) {
            $db->createCommand()->insert('access_path_flows', $mapping)->execute();
        }
        if ($this->groupId) {
            $db->createCommand()->delete('staff_group_members', ['group_id' => $this->groupId])->execute();
            $db->createCommand()->delete('staff_group_events', ['group_id' => $this->groupId])->execute();
            $db->createCommand()->delete('staff_groups', ['id' => $this->groupId])->execute();
        }
        foreach ($this->flowIds as $flowId) {
            $db->createCommand()->delete('flow_versions', ['flow_id' => $flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $flowId])->execute();
        }
        if ($this->usernames) {
            $db->createCommand()->delete('users', ['username' => $this->usernames])->execute();
        }
    }
}
