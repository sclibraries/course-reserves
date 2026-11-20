<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';
require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';

use PHPUnit\Framework\Assert;

class Api119A5FlowPublicationCest extends Api116B1ConcurrencyCase
{
    private $restore;
    private $prefix;
    private $flowIds = [];
    private $materialTypeId;
    private $savedPurchaseMapping;

    public function _before(ConcurrencyTester $I)
    {
        $this->restore = Api116B1CommittedConnection::swap();
        parent::_before($I);
        $this->prefix = 'test-api119a5b-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        \Yii::$app->db->createCommand()->insert('material_types', [
            'name' => $this->prefix . 'book',
            'description' => 'Synthetic API-119A5b material type',
        ])->execute();
        $this->materialTypeId = (int)\Yii::$app->db->getLastInsertID();
        $this->savedPurchaseMapping = \Yii::$app->db->createCommand(
            'SELECT access_path, flow_id, group_id FROM access_path_flows WHERE access_path = "purchase"'
        )->queryOne() ?: null;
    }

    public function _after(ConcurrencyTester $I)
    {
        $this->supervisor->stopAll();
        parent::_after($I);
        $db = \Yii::$app->db;
        $db->createCommand('DELETE FROM workflow_events WHERE actor_username LIKE :prefix', [
            ':prefix' => $this->prefix . '%',
        ])->execute();
        $db->createCommand()->delete('material_type_flows', ['material_type_id' => $this->materialTypeId])->execute();
        $db->createCommand()->delete('access_path_flows', ['access_path' => 'purchase'])->execute();
        if ($this->savedPurchaseMapping) {
            $db->createCommand()->insert('access_path_flows', $this->savedPurchaseMapping)->execute();
        }
        foreach ($this->flowIds as $flowId) {
            $db->createCommand()->delete('flow_versions', ['flow_id' => $flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $flowId])->execute();
        }
        if ($this->materialTypeId) {
            $db->createCommand()->delete('material_types', ['material_type_id' => $this->materialTypeId])->execute();
        }
        call_user_func($this->restore);
    }

    /**
     * @example {"case":"flow_get_add_mapping"}
     * @example {"case":"flow_get_remove_mapping"}
     * @example {"case":"switch_latest_version"}
     * @example {"case":"step_result_current_join"}
     * @example {"case":"access_path_changed"}
     * @example {"case":"access_path_same"}
     * @example {"case":"contract_current_run_and_expiry"}
     * @example {"case":"mark_ready_current_mapping"}
     * @example {"case":"placement_cannot_revive_readiness"}
     * @example {"case":"input_projection_nested"}
     */
    public function currentFlowAndPublicationDecisionsUseCommittedRows(ConcurrencyTester $I, \Codeception\Example $example)
    {
        $case = $example['case'];
        $item = $this->newItem($case, $case === 'access_path_changed' ? 'ill' : null);

        if ($case === 'flow_get_add_mapping') {
            $this->pause($case, 'item_lock_a5_flow_get', $item);
            $flowId = $this->createFlow('added mapping', $this->steps('Mapped next step', 'start', 'Current mapped step'));
            $this->setMaterialMapping($flowId);
            $result = $this->continue($case);
            Assert::assertSame(200, $result['status']);
            Assert::assertSame($flowId, $result['body']['flow']['id'] ?? null);
            Assert::assertSame('Current mapped step', $result['body']['current_step']['step']['label'] ?? null);
            return;
        }

        if ($case === 'flow_get_remove_mapping') {
            $flowId = $this->createFlow('removed mapping', $this->steps('Stale mapped step'));
            $this->setMaterialMapping($flowId);
            $this->pause($case, 'item_lock_a5_flow_get', $item);
            \Yii::$app->db->createCommand()->delete('material_type_flows', [
                'material_type_id' => $this->materialTypeId,
            ])->execute();
            $result = $this->continue($case);
            Assert::assertSame(200, $result['status']);
            Assert::assertNull($result['body']['run_id']);
            Assert::assertNull($result['body']['flow']);
            return;
        }

        if ($case === 'switch_latest_version') {
            $oldFlow = $this->createFlow('old switch flow', $this->steps('Old step'));
            $targetFlow = $this->createFlow('switch target', $this->steps('Version one'));
            $oldRunId = $this->openRun($item, $oldFlow);
            $this->claim($item);
            $this->pause($case, 'item_lock_a5_switch_flow', $item, [
                'flow_id' => $targetFlow, 'reason' => 'Synthetic current version switch',
            ]);
            $this->insertVersion($targetFlow, 2, $this->steps('Next version two', 'version_two', 'Version two'));
            $result = $this->continue($case);
            Assert::assertSame(200, $result['status']);
            Assert::assertSame(2, $result['body']['flow']['version']);
            Assert::assertSame('Version two', $result['body']['current_step']['step']['label']);
            Assert::assertNotSame($oldRunId, $result['body']['run_id']);

            $pinned = $this->newItem('pinned-run');
            $pinnedRunId = $this->openRun($pinned, $targetFlow);
            $this->claim($pinned);
            $result = $this->run('item_lock_a5_switch_flow', $pinned, [
                'flow_id' => $targetFlow, 'reason' => 'Synthetic same-flow switch',
            ]);
            Assert::assertSame(200, $result['status']);
            Assert::assertSame($pinnedRunId, $result['body']['run_id']);
            Assert::assertSame(1, $result['body']['flow']['version']);
            return;
        }

        if ($case === 'step_result_current_join') {
            $flowId = $this->createFlow('step result', $this->steps('Old target step'));
            $this->setMaterialMapping($flowId);
            $runId = $this->openRun($item, $flowId);
            $this->claim($item);
            $this->pause($case, 'item_lock_a5_step_result', $item, [
                'run_id' => $runId, 'result_seq' => 0, 'step_key' => 'start', 'outcome_key' => 'continue',
            ]);
            $this->replaceVersionSteps($flowId, 1, $this->steps('Current target step'));
            $result = $this->continue($case);
            Assert::assertSame(200, $result['status']);
            Assert::assertSame('Current target step', $result['body']['current_step']['step']['label']);
            $this->assertCommittedStaleStep();
            return;
        }

        if ($case === 'access_path_changed' || $case === 'access_path_same') {
            $oldFlow = $this->createFlow('old path flow', $this->steps('Old path step'));
            $newFlow = $this->createFlow('new path flow', $this->steps('New path step'));
            $this->setPurchaseMapping($oldFlow);
            $this->tracker->fixture()->setMarkers($item, ['access_path' => $case === 'access_path_same' ? 'purchase' : 'ill']);
            $this->claim($item);
            $oldRun = null;
            if ($case === 'access_path_same') {
                $oldRun = $this->openRun($item, $oldFlow);
            }
            $this->pause($case, 'item_lock_a5_set_access_path', $item, [
                'access_path' => 'purchase', 'reason' => 'Synthetic path change',
            ]);
            if ($case === 'access_path_same') {
                \Yii::$app->db->createCommand()->update('item_flow_runs', [
                    'current_step_key' => null,
                    'closed_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
                    'closed_reason' => 'Synthetic competing flow switch',
                ], ['id' => $oldRun])->execute();
                $currentRun = $this->openRun($item, $newFlow);
            } else {
                \Yii::$app->db->createCommand()->update('access_path_flows', [
                    'flow_id' => $newFlow,
                ], ['access_path' => 'purchase'])->execute();
            }
            if ($case === 'access_path_same') {
                \Yii::$app->db->createCommand()->update('access_path_flows', [
                    'flow_id' => $newFlow,
                ], ['access_path' => 'purchase'])->execute();
            }
            $result = $this->continue($case);
            Assert::assertSame(200, $result['status']);
            Assert::assertSame('purchase', $result['body']['access_path']);
            Assert::assertSame($newFlow, $result['body']['flow_id']);
            if ($oldRun !== null) {
                Assert::assertSame($currentRun, $result['body']['run_id']);
            }
            return;
        }

        if ($case === 'contract_current_run_and_expiry') {
            $this->pause($case, 'item_lock_a5_contract', $item);
            $flowId = $this->createFlow('contract flow', $this->steps('Contract step'));
            $this->finishedRun($item, $flowId);
            $this->claimEvent($item, 'claim_expired');
            $result = $this->continue($case);
            Assert::assertSame(200, $result['status']);
            Assert::assertSame('ready', $result['body']['publication']['state']);
            Assert::assertContains('claim_expired', $result['body']['publication']['actions']['blockers']);
            return;
        }

        if ($case === 'mark_ready_current_mapping') {
            $this->claim($item);
            $this->pause($case, 'item_lock_a5_mark_ready', $item, ['reason' => 'Synthetic ready reason']);
            $flowId = $this->createFlow('mark ready flow', $this->steps('Current ready step'));
            $this->setMaterialMapping($flowId);
            $result = $this->continue($case);
            Assert::assertSame(200, $result['status']);
            Assert::assertSame($flowId, $result['body']['publication']['readiness']['context']['mapped_flow_id']);
            Assert::assertSame(1, $result['body']['publication']['readiness']['context']['mapped_flow_version']);
            return;
        }

        if ($case === 'placement_cannot_revive_readiness') {
            $oldFlow = $this->createFlow('old placement flow', $this->steps('Old placement step'));
            $newFlow = $this->createFlow('new placement flow', $this->steps('New placement step'));
            $this->setMaterialMapping($oldFlow);
            $this->insertManualReadiness($item, $oldFlow);
            $this->pause($case, 'item_lock_a5_placement', $item);
            $this->setMaterialMapping($newFlow);
            $result = $this->continue($case);
            Assert::assertSame(200, $result['status']);
            $state = $this->state($item);
            Assert::assertNull($state['readiness_source']);
            Assert::assertNull($state['readiness_context_json']);
            return;
        }

        if ($case === 'input_projection_nested') {
            $instanceId = '10000000-0000-4000-8000-000000000119';
            $reference = $this->physical('projection', $instanceId);
            \Yii::$app->db->createCommand()->update('physical_resource_references', [
                'identity_status' => 'unverified', 'folio_instance_id' => null,
            ], ['reference_id' => $reference['physical_reference_id']])->execute();
            \Yii::$app->db->createCommand()->delete('submission_publication_state', [
                'item_kind' => $item['kind'], 'item_id' => $item['id'],
            ])->execute();
            $this->tracker->fixture()->setMarkers($item, [
                'resource_data' => '{}',
                'source_folio_instance_id' => $instanceId,
                'materialized_physical_reference_id' => $reference['physical_reference_id'],
            ]);
            $result = $this->runNestedProjection($item, $reference, $instanceId);
            Assert::assertSame(false, $result['caller_read_before']);
            Assert::assertSame(false, $result['caller_read_after']);
            Assert::assertSame('Synthetic published fallback', $result['result']['body']['projection']['inputs']['title']);
            Assert::assertNotContains('physical_identity_required', $result['result']['body']['projection']['blockers']);
            return;
        }

        Assert::fail('Unknown A5b snapshot example: ' . $case);
    }

    public function mappingOwnerCommitIsVisibleToAnItemReader(ConcurrencyTester $I)
    {
        $item = $this->newItem('mapping-owner');
        $oldFlow = $this->createFlow('mapping owner old', $this->steps('Old owner step'));
        $newFlow = $this->createFlow('mapping owner new', $this->steps('Committed owner step'));
        $this->setMaterialMapping($oldFlow);
        $label = 'mapping-owner-reader';
        $this->pause($label, 'item_lock_a5_flow_get', $item);

        $owner = \Yii::$app->db->beginTransaction();
        try {
            \Yii::$app->db->createCommand(
                'SELECT flow_id FROM material_type_flows WHERE material_type_id = :id FOR UPDATE',
                [':id' => $this->materialTypeId]
            )->queryScalar();
            $this->setMaterialMapping($newFlow);
            $this->supervisor->release($label, 'discovered', 1);
            $this->awaitWaiting($label, '/FROM\s+material_type_flows\b.*LOCK\s+IN\s+SHARE\s+MODE/is');
            $owner->commit();
        } catch (\Throwable $exception) {
            if ($owner->isActive) {
                $owner->rollBack();
            }
            throw $exception;
        }

        $frame = $this->supervisor->complete($label);
        Assert::assertSame(200, $frame['result']['status']);
        Assert::assertSame($newFlow, $frame['result']['body']['flow']['id']);
    }

    private function newItem($suffix, $accessPath = null)
    {
        $item = $this->item($suffix);
        $values = ['material_type_id' => $this->materialTypeId];
        if ($accessPath !== null) {
            $values['access_path'] = $accessPath;
        }
        $this->tracker->fixture()->setMarkers($item, $values);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'submitted_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
        ], ['submission_id' => $item['submission_id']])->execute();
        return $item;
    }

    private function actor()
    {
        return ['username' => $this->prefix . 'staff', 'role' => 'staff'];
    }

    private function claim(array $item)
    {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        \Yii::$app->db->createCommand()->update($table, [
            'claimed_by' => $this->actor()['username'],
            'claimed_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
            'last_activity_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
        ], ['id' => $item['id']])->execute();
    }

    private function createFlow($suffix, array $steps)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . $suffix,
            'description' => 'Synthetic API-119A5b flow',
            'created_by' => $this->actor()['username'],
        ])->execute();
        $flowId = (int)$db->getLastInsertID();
        $this->flowIds[] = $flowId;
        $this->insertVersion($flowId, 1, $steps);
        return $flowId;
    }

    private function insertVersion($flowId, $version, array $steps)
    {
        \Yii::$app->db->createCommand()->insert('flow_versions', [
            'flow_id' => (int)$flowId,
            'version' => (int)$version,
            'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES),
            'created_by' => $this->actor()['username'],
        ])->execute();
    }

    private function replaceVersionSteps($flowId, $version, array $steps)
    {
        \Yii::$app->db->createCommand()->update('flow_versions', [
            'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES),
        ], ['flow_id' => $flowId, 'version' => $version])->execute();
    }

    private function steps($nextLabel, $firstKey = 'start', $firstLabel = 'Synthetic start')
    {
        return [[
            'key' => $firstKey, 'kind' => 'question', 'label' => $firstLabel,
            'outcomes' => [[
                'key' => 'continue', 'label' => 'Continue', 'next' => ['step' => 'next'],
            ]],
        ], [
            'key' => 'next', 'kind' => 'question', 'label' => $nextLabel, 'outcomes' => [],
        ]];
    }

    private function setMaterialMapping($flowId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('material_type_flows', ['material_type_id' => $this->materialTypeId])->execute();
        if ($flowId !== null) {
            $db->createCommand()->insert('material_type_flows', [
                'material_type_id' => $this->materialTypeId, 'flow_id' => (int)$flowId,
            ])->execute();
        }
    }

    private function setPurchaseMapping($flowId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('access_path_flows', ['access_path' => 'purchase'])->execute();
        $db->createCommand()->insert('access_path_flows', [
            'access_path' => 'purchase', 'flow_id' => (int)$flowId, 'group_id' => null,
        ])->execute();
    }

    private function openRun(array $item, $flowId, $version = 1)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('item_flow_runs', [
            'item_kind' => $item['kind'], 'item_id' => $item['id'], 'flow_id' => $flowId,
            'version' => $version, 'current_step_key' => $version === 1 ? 'start' : 'version_two',
            'draft_revision' => 1, 'workflow_revision' => 1,
        ])->execute();
        return (int)$db->getLastInsertID();
    }

    private function finishedRun(array $item, $flowId)
    {
        \Yii::$app->db->createCommand()->insert('item_flow_runs', [
            'item_kind' => $item['kind'], 'item_id' => $item['id'], 'flow_id' => $flowId,
            'version' => 1, 'current_step_key' => null, 'finish_state' => 'prepared',
            'draft_revision' => 1, 'workflow_revision' => 1,
            'closed_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
        ])->execute();
    }

    private function insertManualReadiness(array $item, $flowId)
    {
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => $item['kind'], 'item_id' => $item['id'], 'submission_id' => $item['submission_id'],
            'state' => 'ready', 'draft_revision' => 1, 'workflow_revision' => 1,
            'pending_changes' => 'none', 'readiness_source' => 'manual', 'readiness_reason' => 'Synthetic ready',
            'readiness_revision' => 1,
            'readiness_context_json' => json_encode([
                'material_type_id' => $this->materialTypeId, 'access_path' => null,
                'run_id' => null, 'flow_id' => null, 'flow_version' => null,
                'mapped_flow_id' => $flowId, 'mapped_flow_version' => 1,
                'finish_state' => null, 'closed_at' => null,
            ], JSON_UNESCAPED_SLASHES),
        ])->execute();
    }

    private function claimEvent(array $item, $eventType)
    {
        \Yii::$app->db->createCommand()->insert('workflow_events', [
            'submission_id' => $item['submission_id'], 'item_kind' => $item['kind'], 'item_id' => $item['id'],
            'actor_username' => $this->actor()['username'], 'actor_role' => 'staff', 'event_type' => $eventType,
        ])->execute();
    }

    private function state(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryOne();
    }

    private function pause($label, $operation, array $item, array $body = [])
    {
        $payload = [
            'kind' => $item['kind'], 'item_id' => $item['id'], 'actor' => $this->actor(),
            'body' => $body, 'manifest' => $this->tracker->manifest(),
        ];
        $this->pauseAt($label, $operation, $payload, 'discovered');
    }

    private function run($operation, array $item, array $body)
    {
        $label = 'run-' . substr(md5(uniqid('', true)), 0, 8);
        $payload = [
            'kind' => $item['kind'], 'item_id' => $item['id'], 'actor' => $this->actor(),
            'body' => $body, 'manifest' => $this->tracker->manifest(),
        ];
        return $this->runOperation($label, $operation, $payload)['result'];
    }

    private function continue($label)
    {
        $this->supervisor->release($label, 'discovered', 1);
        $frame = $this->supervisor->complete($label);
        Assert::assertTrue($frame['ok'], 'A5b worker failed: ' . ($frame['error'] ?? 'unknown error'));
        return $frame['result'];
    }

    private function runNestedProjection(array $item, array $reference, $instanceId)
    {
        $label = 'nested-input-projection';
        $payload = [
            'kind' => $item['kind'], 'item_id' => $item['id'], 'actor' => $this->actor(), 'body' => [],
            'caller_read' => [
                'sql' => 'SELECT published_snapshot FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
                'params' => [':kind' => $item['kind'], ':id' => $item['id']],
            ],
            'reference_id' => $reference['physical_reference_id'], 'instance_id' => $instanceId,
            'published_snapshot' => json_encode(['resource' => ['name' => 'Synthetic published fallback']]),
            'manifest' => $this->tracker->manifest(),
        ];
        $this->pauseAt($label, 'item_lock_a5_input_projection', $payload, 'discovered');
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => $item['kind'], 'item_id' => $item['id'], 'submission_id' => $item['submission_id'],
            'published_snapshot' => $payload['published_snapshot'], 'published_revision' => 1,
            'draft_revision' => 1, 'workflow_revision' => 1,
        ])->execute();
        \Yii::$app->db->createCommand()->update('physical_resource_references', [
            'identity_status' => 'verified', 'folio_instance_id' => $instanceId,
        ], ['reference_id' => $reference['physical_reference_id']])->execute();
        $this->supervisor->release($label, 'discovered', 1);
        $frame = $this->supervisor->complete($label);
        Assert::assertTrue($frame['ok'], 'Nested input projection failed: ' . ($frame['error'] ?? 'unknown error'));
        return $frame['result'];
    }

    private function assertCommittedStaleStep()
    {
        $item = $this->newItem('stale-step-commit');
        $flowId = $this->createFlow('stale step flow', $this->steps('Stale target'));
        $runId = $this->openRun($item, $flowId);
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => $item['kind'], 'item_id' => $item['id'], 'submission_id' => $item['submission_id'],
            'draft_revision' => 1, 'workflow_revision' => 1,
        ])->execute();
        $this->claim($item);
        $label = 'stale-step-commit-observer';
        $this->pause($label, 'item_lock_a5_step_result', $item, [
            'run_id' => $runId, 'result_seq' => 0, 'step_key' => 'start', 'outcome_key' => 'continue',
        ]);
        \Yii::$app->db->createCommand()->update('submission_publication_state', [
            'workflow_revision' => 2,
        ], ['item_kind' => $item['kind'], 'item_id' => $item['id']])->execute();
        $result = $this->continue($label);
        Assert::assertSame(409, $result['status']);
        Assert::assertSame('stale_step', $result['body']['error_code']);
        $observer = Api116B1CommittedConnection::unforced(\Yii::$app->db);
        $observer->open();
        try {
            $run = $observer->createCommand(
                'SELECT finish_state, closed_at FROM item_flow_runs WHERE id = :id', [':id' => $runId]
            )->queryOne();
        } finally {
            $observer->close();
        }
        Assert::assertSame('superseded', $run['finish_state']);
        Assert::assertNotEmpty($run['closed_at']);
    }

    private function awaitWaiting($label, $pattern)
    {
        $deadline = microtime(true) + 8.0;
        while (microtime(true) < $deadline) {
            $thread = \Yii::$app->db->createCommand(
                'SELECT COMMAND, INFO FROM information_schema.PROCESSLIST WHERE ID = :id',
                [':id' => $this->connections[$label]]
            )->queryOne();
            if ($thread && $thread['COMMAND'] === 'Query' && preg_match($pattern, (string)$thread['INFO'])) {
                return;
            }
            try {
                $this->supervisor->assertSilent($label, 0.05);
            } catch (\RuntimeException $exception) {
                Assert::fail($label . ' completed without waiting on the current mapping read.');
            }
        }
        Assert::fail($label . ' did not wait on the expected mapping read: ' . json_encode($thread));
    }
}
