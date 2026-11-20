<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';
require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';

use PHPUnit\Framework\Assert;

class Api119A5ClaimReadsCest extends Api116B1ConcurrencyCase
{
    private $restore;
    private $prefix;
    private $groupIds = [];
    private $usernames = [];
    private $flowIds = [];

    public function _before(ConcurrencyTester $I)
    {
        $this->restore = Api116B1CommittedConnection::swap();
        parent::_before($I);
        $this->prefix = 'test-api119a5c-' . substr(md5(uniqid('', true)), 0, 8) . '-';
    }

    public function _after(ConcurrencyTester $I)
    {
        $this->supervisor->stopAll();
        parent::_after($I);
        $db = \Yii::$app->db;
        foreach ($this->groupIds as $id) {
            $db->createCommand()->delete('staff_group_members', ['group_id' => $id])->execute();
            $db->createCommand()->delete('staff_groups', ['id' => $id])->execute();
        }
        foreach ($this->flowIds as $id) {
            $db->createCommand()->delete('flow_versions', ['flow_id' => $id])->execute();
            $db->createCommand()->delete('flows', ['id' => $id])->execute();
        }
        if ($this->usernames) {
            $db->createCommand()->delete('users', ['username' => $this->usernames])->execute();
        }
        call_user_func($this->restore);
    }

    /**
     * @example {"case":"claim_revoked_membership"}
     * @example {"case":"handoff_demoted_target"}
     * @example {"case":"step_group_renamed"}
     * @example {"case":"current_group_recipients"}
     */
    public function claimAndHandoffDecisionsUseCommittedRows(ConcurrencyTester $I, \Codeception\Example $example)
    {
        $case = $example['case'];
        $actor = ['username' => $this->user('owner', 'staff'), 'role' => 'staff'];
        $item = $this->newItem($case);

        if ($case === 'claim_revoked_membership') {
            $groupId = $this->group('claim group', $actor['username']);
            $this->member($groupId, $actor['username']);
            $this->assignGroup($item, $groupId);
            $label = $case;
            $this->pauseClaim($label, 'item_lock_a5_claim', $item, $actor);
            \Yii::$app->db->createCommand()->delete('staff_group_members', [
                'group_id' => $groupId, 'username' => $actor['username'],
            ])->execute();

            $result = $this->continueAfterDiscovery($label)['result'];
            Assert::assertSame(403, $result['status']);
            Assert::assertSame('not_group_member', $result['body']['error_code']);
            Assert::assertNull($this->itemRow($item)['claimed_by']);
            Assert::assertSame(0, $this->eventCount($item));
            return;
        }

        $this->claimItem($item, $actor['username']);
        if ($case === 'handoff_demoted_target') {
            $target = $this->user('target', 'staff');
            $label = $case;
            $this->pauseClaim($label, 'item_lock_a5_handoff', $item, $actor, ['target' => $target]);
            \Yii::$app->db->createCommand()->update('users', ['role' => 'faculty'], ['username' => $target])->execute();

            $result = $this->continueAfterDiscovery($label)['result'];
            Assert::assertSame(404, $result['status']);
            Assert::assertSame('unknown_staff', $result['body']['error_code']);
            Assert::assertSame($actor['username'], $this->itemRow($item)['claimed_by']);
            Assert::assertSame(0, $this->eventCount($item));
            return;
        }

        if ($case === 'step_group_renamed') {
            $groupId = $this->group($case . ' group', $actor['username']);
            $groupName = $this->prefix . $case . ' group';
            $runId = $this->runWithGroupOutcome($item, $actor['username'], $groupName);
            $label = $case;
            $this->pauseClaim($label, 'item_lock_a5_step_result', $item, $actor, [
                'body' => ['run_id' => $runId, 'result_seq' => 0, 'step_key' => 'start', 'outcome_key' => 'continue'],
            ]);
            \Yii::$app->db->createCommand()->update('staff_groups', [
                'name' => $this->prefix . 'renamed target group',
            ], ['id' => $groupId])->execute();

            $frame = $this->continueAfterDiscovery($label, null);
            $result = $frame['result'];
            Assert::assertSame(409, $result['status']);
            Assert::assertSame('unknown_group', $result['body']['error_code']);
            Assert::assertSame(1, $this->discoveryCount($frame['queries']));
            Assert::assertSame($actor['username'], $this->itemRow($item)['claimed_by']);
            Assert::assertSame('start', \Yii::$app->db->createCommand(
                'SELECT current_step_key FROM item_flow_runs WHERE id = :id', [':id' => $runId]
            )->queryScalar());
            Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
                'SELECT COUNT(*) FROM item_flow_step_results WHERE run_id = :id', [':id' => $runId]
            )->queryScalar());
            Assert::assertSame(0, $this->eventCount($item));
            return;
        }

        $currentGroupName = $this->prefix . 'renamed recipient group';
        $groupId = $this->group('recipient group', $actor['username']);
        $oldRecipient = $this->user('old-recipient', 'staff');
        $firstCurrent = $this->user('current-a', 'staff');
        $secondCurrent = $this->user('current-b', 'staff');
        $this->member($groupId, $oldRecipient);
        $label = $case;
        $this->pauseClaim($label, 'item_lock_a5_group_handoff', $item, $actor, [
            'group_id' => $groupId,
            'caller_read' => [
                'sql' => 'SELECT GROUP_CONCAT(username ORDER BY username SEPARATOR ",") '
                    . 'FROM staff_group_members WHERE group_id = :group_id',
                'params' => [':group_id' => $groupId],
            ],
        ]);
        $transaction = \Yii::$app->db->beginTransaction();
        try {
            \Yii::$app->db->createCommand()->update('staff_groups', ['name' => $currentGroupName], [
                'id' => $groupId,
            ])->execute();
            \Yii::$app->db->createCommand()->delete('staff_group_members', [
                'group_id' => $groupId, 'username' => $oldRecipient,
            ])->execute();
            $this->member($groupId, $secondCurrent);
            $this->member($groupId, $firstCurrent);
            $transaction->commit();
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }

        $frame = $this->continueAfterDiscovery($label);
        $nested = $frame['result'];
        Assert::assertSame($oldRecipient, $nested['caller_read_before']);
        Assert::assertSame($oldRecipient, $nested['caller_read_after']);
        Assert::assertSame(200, $nested['result']['status']);
        Assert::assertSame([
            ['event' => 'group_handoff', 'context' => [
                'item_kind' => 'new', 'item_id' => $item['id'], 'submission_id' => $item['submission_id'],
                'actor_username' => $actor['username'], 'recipient_username' => $firstCurrent,
                'group_id' => $groupId, 'group_name' => $currentGroupName,
            ]],
            ['event' => 'group_handoff', 'context' => [
                'item_kind' => 'new', 'item_id' => $item['id'], 'submission_id' => $item['submission_id'],
                'actor_username' => $actor['username'], 'recipient_username' => $secondCurrent,
                'group_id' => $groupId, 'group_name' => $currentGroupName,
            ]],
        ], $nested['result']['notifications']);
        Assert::assertSame($groupId, (int)$nested['result']['body']['item']['assigned_group']['id']);
        Assert::assertSame(1, $this->eventCount($item, 'group_handoff'));
    }

    private function pauseClaim($label, $operation, array $item, array $actor, array $extra = [])
    {
        $barrier = $this->pauseAt($label, $operation, array_merge([
            'kind' => $item['kind'], 'item_id' => $item['id'], 'actor' => $actor,
        ], $extra), 'discovered');
        Assert::assertSame(1, (int)$barrier['attempt']);
        Assert::assertSame(1, preg_match(
            '/SELECT\s+submission_id\s+FROM\s+submission_new_resources\s+WHERE\s+id\s*=/i',
            $barrier['context']['sql']
        ));
    }

    private function continueAfterDiscovery($label, $discoveries = 1)
    {
        $this->supervisor->release($label, 'discovered', 1);
        $frame = $this->supervisor->complete($label);
        Assert::assertTrue($frame['ok'], 'A5c worker failed: ' . ($frame['error'] ?? 'unknown error'));
        Assert::assertNotSame($this->parentConnectionId, $this->connections[$label]);
        if ($discoveries !== null) {
            Assert::assertSame($discoveries, $this->discoveryCount($frame['queries']));
        }
        return $frame;
    }

    private function newItem($suffix)
    {
        $item = $this->item($suffix);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'submitted_at' => date('Y-m-d H:i:s'),
        ], ['submission_id' => $item['submission_id']])->execute();
        return $item;
    }

    private function user($suffix, $role)
    {
        $username = $this->prefix . $suffix;
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $username,
            'full_name' => 'Synthetic ' . $suffix,
            'email' => $username . '@example.test',
            'role' => $role,
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
        $this->usernames[] = $username;
        return $username;
    }

    private function group($suffix, $createdBy)
    {
        $name = $this->prefix . $suffix;
        \Yii::$app->db->createCommand()->insert('staff_groups', [
            'name' => $name, 'created_by' => $createdBy,
        ])->execute();
        $id = (int)\Yii::$app->db->getLastInsertID();
        $this->groupIds[] = $id;
        return $id;
    }

    private function member($groupId, $username)
    {
        \Yii::$app->db->createCommand()->insert('staff_group_members', [
            'group_id' => $groupId, 'username' => $username, 'added_by' => $this->prefix . 'owner',
        ])->execute();
    }

    private function assignGroup(array $item, $groupId)
    {
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'assigned_group_id' => $groupId,
        ], ['id' => $item['id']])->execute();
    }

    private function claimItem(array $item, $username)
    {
        $now = date('Y-m-d H:i:s');
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $username, 'claimed_at' => $now, 'last_activity_at' => $now, 'item_status' => 'in_progress',
        ], ['id' => $item['id']])->execute();
    }

    private function runWithGroupOutcome(array $item, $username, $groupName)
    {
        $steps = [[
            'key' => 'start', 'kind' => 'question', 'label' => 'Synthetic starting step',
            'outcomes' => [[
                'key' => 'continue', 'label' => 'Continue', 'next' => ['handoff_group' => $groupName],
            ]],
        ]];
        \Yii::$app->db->createCommand()->insert('flows', [
            'name' => $this->prefix . 'handoff flow', 'description' => 'Synthetic A5c flow', 'created_by' => $username,
        ])->execute();
        $flowId = (int)\Yii::$app->db->getLastInsertID();
        $this->flowIds[] = $flowId;
        \Yii::$app->db->createCommand()->insert('flow_versions', [
            'flow_id' => $flowId, 'version' => 1,
            'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES), 'created_by' => $username,
        ])->execute();
        \Yii::$app->db->createCommand()->insert('item_flow_runs', [
            'item_kind' => $item['kind'], 'item_id' => $item['id'], 'flow_id' => $flowId,
            'version' => 1, 'current_step_key' => 'start', 'draft_revision' => 1, 'workflow_revision' => 1,
        ])->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function itemRow(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_new_resources WHERE id = :id', [':id' => $item['id']]
        )->queryOne();
    }

    private function eventCount(array $item, $eventType = null)
    {
        $sql = 'SELECT COUNT(*) FROM workflow_events WHERE item_kind = "new" AND item_id = :id';
        $params = [':id' => $item['id']];
        if ($eventType !== null) {
            $sql .= ' AND event_type = :event';
            $params[':event'] = $eventType;
        }
        return (int)\Yii::$app->db->createCommand($sql, $params)->queryScalar();
    }

    private function discoveryCount(array $queries)
    {
        $pattern = '/SELECT\s+submission_id\s+FROM\s+submission_new_resources\s+WHERE\s+id\s*=/i';
        return count(preg_grep($pattern, $queries));
    }
}
