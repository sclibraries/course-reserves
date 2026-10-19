<?php

namespace app\services;

use Yii;
use yii\db\IntegrityException;

/** Owns admin writes for flow definitions and the complete material type mapping. */
class FlowAdminService
{
    private $flows;
    private $validator;
    private $events;

    public function __construct($flows = null, $validator = null, $events = null)
    {
        $this->flows = $flows ?: new FlowRepository();
        $this->validator = $validator ?: new FlowDefinitionValidator();
        $this->events = $events ?: new WorkflowEventLog();
    }

    public function picker()
    {
        return ['flows' => $this->flows->pickerFlows()];
    }

    public function getFlow($id)
    {
        $flow = $this->flows->fullFlow($id);
        return $flow ? $this->result(200, $flow) : $this->result(404, ['error_code' => 'unknown_flow']);
    }

    public function createFlow(array $body, array $actor)
    {
        $name = trim((string)($body['name'] ?? ''));
        $steps = $this->normalizeSteps($body['steps'] ?? []);
        $errors = $this->validate($steps);
        if ($name === '') {
            $errors[] = ['step_key' => null, 'message' => 'Flow name is required.'];
        }
        if ($errors) {
            return $this->result(400, ['error_code' => 'invalid_flow', 'errors' => $errors]);
        }
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $flowId = $this->flows->insertFlow($name, $body['description'] ?? null, $actor['username']);
            $this->flows->insertVersion($flowId, 1, $steps, $actor['username']);
            $this->events->record(null, null, $actor, 'flow_created', null, [], [
                'flow_id' => $flowId, 'name' => $name, 'version' => 1,
            ]);
            $transaction->commit();
            return $this->result(201, ['flow' => ['id' => $flowId, 'name' => $name, 'description' => $body['description'] ?? null]]);
        } catch (IntegrityException $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            return $this->result(409, ['error_code' => 'flow_name_in_use']);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function createVersion($id, array $body, array $actor)
    {
        $steps = $this->normalizeSteps($body['steps'] ?? []);
        $errors = $this->validate($steps);
        if ($errors) {
            return $this->result(400, ['error_code' => 'invalid_flow', 'errors' => $errors]);
        }
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $flow = $this->flows->flow($id, true);
            if (!$flow) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'unknown_flow']);
            }
            $latest = $this->flows->latestVersion($id);
            $version = (int)$latest['version'] + 1;
            $this->flows->insertVersion($id, $version, $steps, $actor['username']);
            $this->events->record(null, null, $actor, 'flow_version_created', null, [
                'flow_id' => (int)$id, 'version' => (int)$latest['version'],
            ], ['flow_id' => (int)$id, 'version' => $version]);
            $transaction->commit();
            return $this->result(201, ['version' => ['version' => $version, 'steps' => $steps]]);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function updateFlow($id, array $body, array $actor)
    {
        $name = trim((string)($body['name'] ?? ''));
        if ($name === '') {
            return $this->result(400, ['error_code' => 'invalid_flow', 'errors' => [[
                'step_key' => null, 'message' => 'Flow name is required.',
            ]]]);
        }
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $flow = $this->flows->flow($id, true);
            if (!$flow) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'unknown_flow']);
            }
            $values = ['name' => $name, 'description' => $body['description'] ?? null];
            $this->flows->updateFlow($id, $values);
            $this->events->record(null, null, $actor, 'flow_updated', null, [
                'flow_id' => (int)$id, 'name' => $flow['name'], 'description' => $flow['description'],
            ], ['flow_id' => (int)$id, 'name' => $name, 'description' => $values['description']]);
            $transaction->commit();
            return $this->result(200, ['flow' => ['id' => (int)$id, 'name' => $name, 'description' => $values['description']]]);
        } catch (IntegrityException $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            return $this->result(409, ['error_code' => 'flow_name_in_use']);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function deleteFlow($id, array $actor)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $flow = $this->flows->flow($id, true);
            if (!$flow) {
                $transaction->rollBack();
                return $this->result(404, ['error_code' => 'unknown_flow']);
            }
            if ($this->flows->hasRuns($id)) {
                $transaction->rollBack();
                return $this->result(409, ['error_code' => 'flow_in_use']);
            }
            $this->events->record(null, null, $actor, 'flow_deleted', null, [
                'flow_id' => (int)$id, 'name' => $flow['name'], 'description' => $flow['description'],
            ], []);
            $this->flows->deleteFlow($id);
            $transaction->commit();
            return $this->result(204, []);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function getMapping()
    {
        $mapping = array_map(function ($row) {
            return [
                'material_type' => $row['material_type'],
                'flow_id' => $row['flow_id'] === null ? null : (int)$row['flow_id'],
            ];
        }, $this->flows->allMaterialTypes());
        return ['mapping' => $mapping];
    }

    public function putMapping(array $body, array $actor)
    {
        $rows = $body['mapping'] ?? null;
        if (!is_array($rows)) {
            return $this->result(400, ['error_code' => 'invalid_mapping']);
        }
        $types = $this->flows->allMaterialTypes();
        $known = [];
        foreach ($types as $type) {
            $known[$type['material_type']] = true;
        }
        $normalized = [];
        foreach ($rows as $row) {
            if (!is_array($row) || !is_scalar($row['material_type'] ?? null)) {
                return $this->result(400, ['error_code' => 'invalid_mapping']);
            }
            $name = (string)$row['material_type'];
            if (!isset($known[$name]) || array_key_exists($name, $normalized)) {
                return $this->result(400, ['error_code' => 'invalid_mapping']);
            }
            $flowId = $row['flow_id'] ?? null;
            if ($flowId !== null && (!is_scalar($flowId) || !$this->flows->flow($flowId))) {
                return $this->result(400, ['error_code' => 'invalid_mapping']);
            }
            $normalized[$name] = [
                'material_type_id' => (int)$this->materialTypeId($types, $name),
                'flow_id' => $flowId === null ? null : (int)$flowId,
            ];
        }
        if (count($normalized) !== count($known)) {
            return $this->result(400, ['error_code' => 'invalid_mapping']);
        }
        $before = $this->getMapping()['mapping'];
        $after = [];
        foreach ($types as $type) {
            $after[] = ['material_type' => $type['material_type'], 'flow_id' => $normalized[$type['material_type']]['flow_id']];
        }
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $this->flows->replaceMappings(array_values($normalized));
            $this->events->record(null, null, $actor, 'flow_mapping_updated', null, ['mapping' => $before], ['mapping' => $after]);
            $transaction->commit();
            return $this->result(200, ['mapping' => $after]);
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    private function validate(array $steps)
    {
        return $this->validator->validate($steps, $this->flows->groupNames());
    }

    private function normalizeSteps($steps)
    {
        if (!is_array($steps)) {
            return [];
        }
        foreach ($steps as &$step) {
            if (!is_array($step)) {
                continue;
            }
            $step['help_text'] = $step['help_text'] ?? null;
            $step['outcomes'] = is_array($step['outcomes'] ?? null) ? $step['outcomes'] : [];
            foreach ($step['outcomes'] as &$outcome) {
                if (is_array($outcome)) {
                    if (!array_key_exists('reason_required', $outcome)) {
                        $outcome['reason_required'] = false;
                    }
                }
            }
            unset($outcome);
            if (($step['kind'] ?? null) === 'finish') {
                if (!array_key_exists('reason_required', $step)) {
                    $step['reason_required'] = false;
                }
            }
        }
        unset($step);
        return $steps;
    }

    private function materialTypeId(array $types, $name)
    {
        foreach ($types as $type) {
            if ($type['material_type'] === $name) {
                return (int)$type['material_type_id'];
            }
        }
        return 0;
    }

    private function result($status, array $body)
    {
        return ['status' => $status, 'body' => $body];
    }
}
