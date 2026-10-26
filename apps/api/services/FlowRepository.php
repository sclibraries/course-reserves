<?php

namespace app\services;

use Yii;

/** Persists flow definitions, mappings, item runs, and step history. */
class FlowRepository
{
    public function flow($id, $forUpdate = false)
    {
        $sql = 'SELECT * FROM flows WHERE id = :id LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');
        return Yii::$app->db->createCommand($sql, [':id' => (int)$id])->queryOne() ?: null;
    }

    public function version($flowId, $version)
    {
        return Yii::$app->db->createCommand(
            'SELECT * FROM flow_versions WHERE flow_id = :flow_id AND version = :version LIMIT 1',
            [':flow_id' => (int)$flowId, ':version' => (int)$version]
        )->queryOne() ?: null;
    }

    public function latestVersion($flowId)
    {
        return Yii::$app->db->createCommand(
            'SELECT * FROM flow_versions WHERE flow_id = :flow_id ORDER BY version DESC LIMIT 1',
            [':flow_id' => (int)$flowId]
        )->queryOne() ?: null;
    }

    public function mappedFlow($materialTypeId)
    {
        return Yii::$app->db->createCommand(
            'SELECT f.*, v.version, v.steps_json FROM material_type_flows m '
            . 'INNER JOIN flows f ON f.id = m.flow_id '
            . 'INNER JOIN flow_versions v ON v.flow_id = f.id '
            . 'WHERE m.material_type_id = :type_id ORDER BY v.version DESC LIMIT 1',
            [':type_id' => (int)$materialTypeId]
        )->queryOne() ?: null;
    }

    public function run($runId, $forUpdate = false)
    {
        return $this->runWhere('r.id = :id', [':id' => (int)$runId], null, $forUpdate);
    }

    public function latestRun($kind, $itemId, $forUpdate = false)
    {
        return $this->runWhere(
            'r.item_kind = :kind AND r.item_id = :item_id',
            [':kind' => $kind, ':item_id' => (int)$itemId],
            'ORDER BY r.id DESC',
            $forUpdate
        );
    }

    public function latestRunsForItems(array $items)
    {
        if (!$items) {
            return [];
        }
        $conditions = [];
        $params = [];
        foreach ($items as $index => $item) {
            $kind = ':kind' . $index;
            $itemId = ':item_id' . $index;
            $conditions[] = '(r.item_kind = ' . $kind . ' AND r.item_id = ' . $itemId . ')';
            $params[$kind] = $item['kind'];
            $params[$itemId] = (int)$item['id'];
        }
        return Yii::$app->db->createCommand(
            'SELECT r.*, f.name AS flow_name, v.steps_json FROM item_flow_runs r '
            . 'INNER JOIN flows f ON f.id = r.flow_id '
            . 'INNER JOIN flow_versions v ON v.flow_id = r.flow_id AND v.version = r.version '
            . 'WHERE (' . implode(' OR ', $conditions) . ') AND r.id = ('
            . 'SELECT MAX(latest.id) FROM item_flow_runs latest '
            . 'WHERE latest.item_kind = r.item_kind AND latest.item_id = r.item_id)',
            $params
        )->queryAll();
    }

    public function mappedFlowsForMaterialTypes(array $materialTypeIds)
    {
        $materialTypeIds = array_values(array_unique(array_map('intval', $materialTypeIds)));
        if (!$materialTypeIds) {
            return [];
        }
        $placeholders = [];
        $params = [];
        foreach ($materialTypeIds as $index => $materialTypeId) {
            $placeholder = ':type' . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $materialTypeId;
        }
        return Yii::$app->db->createCommand(
            'SELECT m.material_type_id, f.name AS flow_name, v.steps_json '
            . 'FROM material_type_flows m INNER JOIN flows f ON f.id = m.flow_id '
            . 'INNER JOIN flow_versions v ON v.flow_id = f.id '
            . 'WHERE m.material_type_id IN (' . implode(', ', $placeholders) . ') '
            . 'AND v.version = (SELECT MAX(latest.version) FROM flow_versions latest WHERE latest.flow_id = f.id)',
            $params
        )->queryAll();
    }

    public function openRun($kind, $itemId, $forUpdate = false)
    {
        return $this->runWhere(
            'r.item_kind = :kind AND r.item_id = :item_id AND r.closed_at IS NULL',
            [':kind' => $kind, ':item_id' => (int)$itemId],
            'ORDER BY r.id DESC',
            $forUpdate
        );
    }

    public function runsForItem($kind, $itemId)
    {
        return Yii::$app->db->createCommand(
            'SELECT r.*, v.steps_json FROM item_flow_runs r INNER JOIN flow_versions v '
            . 'ON v.flow_id = r.flow_id AND v.version = r.version '
            . 'WHERE r.item_kind = :kind AND r.item_id = :item_id ORDER BY r.id ASC',
            [':kind' => $kind, ':item_id' => (int)$itemId]
        )->queryAll();
    }

    public function history($kind, $itemId)
    {
        $runs = $this->runsForItem($kind, $itemId);
        if (!$runs) {
            return [];
        }
        $runIds = array_map(function ($run) {
            return (int)$run['id'];
        }, $runs);
        $rows = Yii::$app->db->createCommand(
            'SELECT r.run_id, r.step_key, r.outcome_key, r.notes, r.reason, r.actor_username, r.created_at, '
            . 'COALESCE(NULLIF(u.full_name, ""), r.actor_username) AS actor_display '
            . 'FROM item_flow_step_results r LEFT JOIN users u ON u.username = r.actor_username '
            . 'WHERE r.run_id IN (' . implode(',', $runIds) . ') ORDER BY r.id ASC'
        )->queryAll();
        $definitions = [];
        foreach ($runs as $run) {
            $definitions[(int)$run['id']] = json_decode($run['steps_json'], true) ?: [];
        }
        $history = [];
        foreach ($rows as $row) {
            $runId = (int)$row['run_id'];
            $step = FlowStepLookup::stepByKey($definitions[$runId], $row['step_key']);
            $outcome = FlowStepLookup::outcomeByKey($step, $row['outcome_key']);
            $history[] = [
                'step_key' => $row['step_key'],
                'step_label' => $step['label'] ?? $row['step_key'],
                'outcome_key' => $row['outcome_key'],
                'outcome_label' => $outcome['label'] ?? $row['outcome_key'],
                'notes' => $row['notes'],
                'reason' => $row['reason'],
                'actor_display' => $row['actor_display'],
                'created_at' => $row['created_at'],
            ];
        }
        return $history;
    }

    public function insertFlow($name, $description, $username)
    {
        Yii::$app->db->createCommand()->insert('flows', [
            'name' => $name, 'description' => $description, 'created_by' => $username,
        ])->execute();
        return (int)Yii::$app->db->getLastInsertID();
    }

    public function insertVersion($flowId, $version, array $steps, $username)
    {
        Yii::$app->db->createCommand()->insert('flow_versions', [
            'flow_id' => (int)$flowId,
            'version' => (int)$version,
            'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES),
            'created_by' => $username,
        ])->execute();
    }

    public function updateFlow($id, array $values)
    {
        return Yii::$app->db->createCommand()->update('flows', $values, ['id' => (int)$id])->execute();
    }

    public function deleteFlow($id)
    {
        return Yii::$app->db->createCommand()->delete('flows', ['id' => (int)$id])->execute();
    }

    public function hasRuns($flowId)
    {
        return (bool)Yii::$app->db->createCommand(
            'SELECT 1 FROM item_flow_runs WHERE flow_id = :flow_id LIMIT 1', [':flow_id' => (int)$flowId]
        )->queryScalar();
    }

    public function groupNames()
    {
        return Yii::$app->db->createCommand('SELECT name FROM staff_groups ORDER BY name')->queryColumn();
    }

    public function allMaterialTypes()
    {
        return Yii::$app->db->createCommand(
            'SELECT mt.material_type_id, mt.name AS material_type, m.flow_id FROM material_types mt '
            . 'LEFT JOIN material_type_flows m ON m.material_type_id = mt.material_type_id ORDER BY mt.name ASC'
        )->queryAll();
    }

    public function replaceMappings(array $mapping)
    {
        Yii::$app->db->createCommand()->delete('material_type_flows')->execute();
        foreach ($mapping as $row) {
            Yii::$app->db->createCommand()->insert('material_type_flows', [
                'material_type_id' => (int)$row['material_type_id'],
                'flow_id' => $row['flow_id'] === null ? null : (int)$row['flow_id'],
            ])->execute();
        }
    }

    public function pickerFlows()
    {
        $flows = Yii::$app->db->createCommand(
            'SELECT f.id, f.name, f.description, MAX(v.version) AS latest_version '
            . 'FROM flows f INNER JOIN flow_versions v ON v.flow_id = f.id GROUP BY f.id ORDER BY f.name ASC'
        )->queryAll();
        foreach ($flows as &$flow) {
            $flow['id'] = (int)$flow['id'];
            $flow['latest_version'] = (int)$flow['latest_version'];
            $flow['material_types'] = Yii::$app->db->createCommand(
                'SELECT mt.name FROM material_types mt INNER JOIN material_type_flows m '
                . 'ON m.material_type_id = mt.material_type_id WHERE m.flow_id = :flow_id ORDER BY mt.name ASC',
                [':flow_id' => $flow['id']]
            )->queryColumn();
        }
        unset($flow);
        return $flows;
    }

    public function fullFlow($flowId)
    {
        $flow = $this->flow($flowId);
        if (!$flow) {
            return null;
        }
        $versions = Yii::$app->db->createCommand(
            'SELECT version, created_at, created_by FROM flow_versions WHERE flow_id = :flow_id ORDER BY version DESC',
            [':flow_id' => (int)$flowId]
        )->queryAll();
        $latest = $this->latestVersion($flowId);
        return [
            'flow' => ['id' => (int)$flow['id'], 'name' => $flow['name'], 'description' => $flow['description']],
            'versions' => array_map(function ($version) {
                return ['version' => (int)$version['version'], 'created_at' => $version['created_at'], 'created_by' => $version['created_by']];
            }, $versions),
            'latest' => ['version' => (int)$latest['version'], 'steps' => json_decode($latest['steps_json'], true) ?: []],
        ];
    }

    public function insertRun($kind, $itemId, $flowId, $version, $firstStep)
    {
        Yii::$app->db->createCommand()->insert('item_flow_runs', [
            'item_kind' => $kind,
            'item_id' => (int)$itemId,
            'flow_id' => (int)$flowId,
            'version' => (int)$version,
            'current_step_key' => $firstStep,
        ])->execute();
        return (int)Yii::$app->db->getLastInsertID();
    }

    public function updateRun($runId, array $values)
    {
        return Yii::$app->db->createCommand()->update('item_flow_runs', $values, ['id' => (int)$runId])->execute();
    }

    public function insertResult($runId, $stepKey, $outcomeKey, $notes, $reason, $username)
    {
        Yii::$app->db->createCommand()->insert('item_flow_step_results', [
            'run_id' => (int)$runId,
            'step_key' => $stepKey,
            'outcome_key' => $outcomeKey,
            'notes' => $notes,
            'reason' => $reason,
            'actor_username' => $username,
        ])->execute();
    }

    private function runWhere($where, array $params, $order, $forUpdate)
    {
        $sql = 'SELECT r.*, f.name AS flow_name, v.steps_json FROM item_flow_runs r '
            . 'INNER JOIN flows f ON f.id = r.flow_id '
            . 'INNER JOIN flow_versions v ON v.flow_id = r.flow_id AND v.version = r.version '
            . 'WHERE ' . $where . ($order ? ' ' . $order : '') . ' LIMIT 1'
            . ($forUpdate ? ' FOR UPDATE' : '');
        return Yii::$app->db->createCommand($sql, $params)->queryOne() ?: null;
    }
}
