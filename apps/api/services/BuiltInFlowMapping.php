<?php

namespace app\services;

use Yii;

/** Finds or seeds a built-in flow and its optional material type mapping. */
class BuiltInFlowMapping
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Yii::$app->db;
    }

    public function findOrCreate($flowName, $flowDescription, array $steps, $materialTypeName,
        $createMaterialType, $materialTypeDescription, $createdBy = 'system')
    {
        $flow = $this->db->createCommand(
            'SELECT id FROM flows WHERE name = :name LIMIT 1', [':name' => $flowName]
        )->queryOne();
        if (!$flow) {
            $this->db->createCommand()->insert('flows', [
                'name' => $flowName,
                'description' => $flowDescription,
                'created_by' => $createdBy,
            ])->execute();
            $flowId = (int)$this->db->getLastInsertID();
        } else {
            $flowId = (int)$flow['id'];
        }
        $this->ensureFirstVersion($flowId, $steps, $createdBy);

        $materialType = $this->findMaterialType($materialTypeName);
        $createdType = false;
        if (!$materialType && $createMaterialType) {
            $this->db->createCommand()->insert('material_types', [
                'name' => $materialTypeName,
                'description' => $materialTypeDescription,
            ])->execute();
            $materialType = [
                'material_type_id' => (int)$this->db->getLastInsertID(),
                'name' => $materialTypeName,
                'description' => $materialTypeDescription,
            ];
            $createdType = true;
        }

        $mappingCreated = false;
        $mappedFlowId = null;
        if ($materialType) {
            $mapping = $this->db->createCommand(
                'SELECT flow_id FROM material_type_flows WHERE material_type_id = :type_id LIMIT 1',
                [':type_id' => (int)$materialType['material_type_id']]
            )->queryOne();
            if (!$mapping) {
                $this->db->createCommand()->insert('material_type_flows', [
                    'material_type_id' => (int)$materialType['material_type_id'],
                    'flow_id' => $flowId,
                ])->execute();
                $mappingCreated = true;
                $mappedFlowId = $flowId;
            } elseif ($mapping['flow_id'] === null) {
                $this->db->createCommand()->update('material_type_flows', ['flow_id' => $flowId], [
                    'material_type_id' => (int)$materialType['material_type_id'],
                ])->execute();
                $mappingCreated = true;
                $mappedFlowId = $flowId;
            } else {
                $mappedFlowId = (int)$mapping['flow_id'];
            }
        }

        return [
            'flow_id' => $flowId,
            'material_type_id' => $materialType ? (int)$materialType['material_type_id'] : null,
            'material_type_created' => $createdType,
            'mapping_created' => $mappingCreated,
            'mapped' => $materialType && $mappedFlowId === $flowId,
        ];
    }

    public function resetSeededMaterialType($name, $description)
    {
        $materialType = $this->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE LOWER(name) = :name '
            . 'AND description = :description LIMIT 1',
            [':name' => strtolower($name), ':description' => $description]
        )->queryOne();
        if (!$materialType) {
            return false;
        }

        foreach (['resources', 'submission_new_resources'] as $table) {
            $inUse = $this->db->createCommand(
                'SELECT 1 FROM ' . $table . ' WHERE material_type_id = :type_id LIMIT 1',
                [':type_id' => (int)$materialType['material_type_id']]
            )->queryScalar();
            if ($inUse) {
                return false;
            }
        }

        $this->db->createCommand()->delete('material_types', [
            'material_type_id' => (int)$materialType['material_type_id'],
        ])->execute();
        return true;
    }

    private function findMaterialType($name)
    {
        return $this->db->createCommand(
            'SELECT material_type_id, name, description FROM material_types WHERE LOWER(name) = :name '
            . 'ORDER BY CASE WHEN BINARY name = :exact_name THEN 0 ELSE 1 END, material_type_id ASC LIMIT 1',
            [':name' => strtolower($name), ':exact_name' => $name]
        )->queryOne();
    }

    private function ensureFirstVersion($flowId, array $steps, $createdBy)
    {
        $version = $this->db->createCommand(
            'SELECT version FROM flow_versions WHERE flow_id = :flow_id AND version = 1 LIMIT 1',
            [':flow_id' => $flowId]
        )->queryScalar();
        if ($version !== false) {
            return;
        }

        $this->db->createCommand()->insert('flow_versions', [
            'flow_id' => $flowId,
            'version' => 1,
            'steps_json' => json_encode($steps, JSON_UNESCAPED_SLASHES),
            'created_by' => $createdBy,
        ])->execute();
    }
}
