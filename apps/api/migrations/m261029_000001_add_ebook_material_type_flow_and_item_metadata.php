<?php

use app\services\EbookFlowMapping;
use yii\db\Migration;

class m261029_000001_add_ebook_material_type_flow_and_item_metadata extends Migration
{
    public function safeUp()
    {
        foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
            $this->addColumnIfMissing($table, 'public_note', $this->text()->null());
            $this->addColumnIfMissing($table, 'assigned_pages', $this->text()->null());
        }

        (new EbookFlowMapping($this->db))->findOrCreate(true, 'api-103');
    }

    public function safeDown()
    {
        $type = $this->db->createCommand(
            'SELECT material_type_id, description FROM material_types WHERE LOWER(name) = :name '
            . 'ORDER BY CASE WHEN BINARY name = :exact_name THEN 0 ELSE 1 END LIMIT 1',
            [':name' => 'ebook', ':exact_name' => 'ebook']
        )->queryOne();
        $flow = $this->db->createCommand(
            'SELECT id, name, description, created_by FROM flows WHERE name = :name LIMIT 1',
            [':name' => EbookFlowMapping::FLOW_NAME]
        )->queryOne();

        if ($flow && $this->isUntouchedSeededFlow($flow, $type ? (int)$type['material_type_id'] : null)) {
            if ($type) {
                $this->db->createCommand()->delete('material_type_flows', [
                    'material_type_id' => (int)$type['material_type_id'],
                    'flow_id' => (int)$flow['id'],
                ])->execute();
            }
            $this->db->createCommand()->delete('flow_versions', ['flow_id' => (int)$flow['id']])->execute();
            $this->db->createCommand()->delete('flows', ['id' => (int)$flow['id']])->execute();
        }

        if ($type && $type['description'] === EbookFlowMapping::MATERIAL_TYPE_DESCRIPTION) {
            $this->deleteSeededTypeIfUnused((int)$type['material_type_id']);
        }

        foreach (['submission_reuse_resources', 'submission_new_resources'] as $table) {
            $this->dropColumnIfExists($table, 'assigned_pages');
            $this->dropColumnIfExists($table, 'public_note');
        }
    }

    private function isUntouchedSeededFlow(array $flow, $seedTypeId)
    {
        if ($flow['created_by'] !== 'api-103' || $flow['description'] !== EbookFlowMapping::FLOW_DESCRIPTION) {
            return false;
        }

        $versions = $this->db->createCommand(
            'SELECT version, steps_json, created_by FROM flow_versions WHERE flow_id = :flow_id',
            [':flow_id' => (int)$flow['id']]
        )->queryAll();
        if (count($versions) !== 1 || (int)$versions[0]['version'] !== 1
            || $versions[0]['created_by'] !== 'api-103'
            || json_decode($versions[0]['steps_json'], true) !== (new EbookFlowMapping($this->db))->defaultSteps()) {
            return false;
        }

        $mappings = $this->db->createCommand(
            'SELECT material_type_id FROM material_type_flows WHERE flow_id = :flow_id',
            [':flow_id' => (int)$flow['id']]
        )->queryColumn();
        foreach ($mappings as $materialTypeId) {
            if ($seedTypeId === null || (int)$materialTypeId !== $seedTypeId) {
                return false;
            }
        }

        return !(bool)$this->db->createCommand(
            'SELECT 1 FROM item_flow_runs WHERE flow_id = :flow_id LIMIT 1',
            [':flow_id' => (int)$flow['id']]
        )->queryScalar();
    }

    private function deleteSeededTypeIfUnused($materialTypeId)
    {
        $mapping = $this->db->createCommand(
            'SELECT 1 FROM material_type_flows WHERE material_type_id = :type_id LIMIT 1',
            [':type_id' => $materialTypeId]
        )->queryScalar();
        if ($mapping) {
            return;
        }
        foreach (['resources', 'submission_new_resources'] as $table) {
            $inUse = $this->db->createCommand(
                'SELECT 1 FROM ' . $table . ' WHERE material_type_id = :type_id LIMIT 1',
                [':type_id' => $materialTypeId]
            )->queryScalar();
            if ($inUse) {
                return;
            }
        }
        $this->db->createCommand()->delete('material_types', ['material_type_id' => $materialTypeId])->execute();
    }

    private function addColumnIfMissing($table, $column, $definition)
    {
        $schema = $this->db->schema->getTableSchema($table, true);
        if ($schema && $schema->getColumn($column) === null) {
            $this->addColumn($table, $column, $definition);
        }
    }

    private function dropColumnIfExists($table, $column)
    {
        $schema = $this->db->schema->getTableSchema($table, true);
        if ($schema && $schema->getColumn($column) !== null) {
            $this->dropColumn($table, $column);
        }
    }
}
