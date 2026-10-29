<?php

use yii\db\Migration;

class m261029_000003_add_publication_input_projection extends Migration
{
    public function safeUp()
    {
        foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
            if ($table === 'submission_reuse_resources') {
                $this->addColumnIfMissing($table, 'material_type_id', $this->integer()->null());
            }
            $this->addColumnIfMissing($table, 'staff_material_type_id', $this->integer()->null());
            $this->addColumnIfMissing($table, 'destination_class_choice', $this->string(16)->null());
            $this->addColumnIfMissing($table, 'source_folio_instance_id', $this->string(255)->null());
            $this->addColumnIfMissing($table, 'source_folio_holdings_id', $this->string(255)->null());
            $this->addColumnIfMissing($table, 'source_snapshot_json', 'LONGTEXT NULL');
            $this->addColumnIfMissing($table, 'staff_corrections_json', 'LONGTEXT NULL');
        }

        $this->createIndexIfMissing('idx_reuse_material_type', 'submission_reuse_resources', 'material_type_id');
        $this->createIndexIfMissing('idx_new_staff_material_type', 'submission_new_resources', 'staff_material_type_id');
        $this->createIndexIfMissing('idx_reuse_staff_material_type', 'submission_reuse_resources', 'staff_material_type_id');

        foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
            $this->execute(
                'UPDATE ' . $table . ' item INNER JOIN resources source '
                . 'ON source.resource_id = item.source_resource_id '
                . 'SET item.material_type_id = source.material_type_id WHERE item.material_type_id IS NULL'
            );
        }
        $this->freezeSourceSnapshot('submission_new_resources');
        $this->freezeSourceSnapshot('submission_reuse_resources');
    }

    public function safeDown()
    {
        foreach ([
            ['submission_reuse_resources', 'idx_reuse_staff_material_type'],
            ['submission_new_resources', 'idx_new_staff_material_type'],
            ['submission_reuse_resources', 'idx_reuse_material_type'],
        ] as $index) {
            $this->dropIndexIfExists($index[0], $index[1]);
        }
        foreach (['submission_reuse_resources', 'submission_new_resources'] as $table) {
            foreach ([
                'staff_corrections_json', 'source_snapshot_json', 'source_folio_holdings_id',
                'destination_class_choice', 'staff_material_type_id',
            ] as $column) {
                $this->dropColumnIfExists($table, $column);
            }
        }
        $this->dropColumnIfExists('submission_reuse_resources', 'source_folio_instance_id');
        $this->dropColumnIfExists('submission_reuse_resources', 'material_type_id');
    }

    private function freezeSourceSnapshot($table)
    {
        $this->execute(
            'UPDATE ' . $table . ' item INNER JOIN resources source '
            . 'ON source.resource_id = item.source_resource_id '
            . 'SET item.source_snapshot_json = JSON_OBJECT('
            . '"title", source.name, "url", source.item_url, "description", source.description, '
            . '"material_type_id", source.material_type_id, "display_start_date", source.start_visibility, '
            . '"display_end_date", source.end_visibility, "use_proxy", source.use_proxy) '
            . 'WHERE item.source_snapshot_json IS NULL'
        );
    }

    private function addColumnIfMissing($table, $column, $definition)
    {
        $schema = $this->db->schema->getTableSchema($table, true);
        if ($schema && $schema->getColumn($column) === null) {
            $this->addColumn($table, $column, $definition);
        }
    }

    private function createIndexIfMissing($name, $table, $columns)
    {
        if (!$this->hasIndex($table, $name)) {
            $this->createIndex($name, $table, $columns);
        }
    }

    private function dropIndexIfExists($table, $name)
    {
        if ($this->hasIndex($table, $name)) {
            $this->dropIndex($name, $table);
        }
    }

    private function hasIndex($table, $name)
    {
        foreach ($this->db->schema->getTableIndexes($table, true) as $index) {
            if ($index->name === $name) {
                return true;
            }
        }

        return false;
    }

    private function dropColumnIfExists($table, $column)
    {
        $schema = $this->db->schema->getTableSchema($table, true);
        if ($schema && $schema->getColumn($column) !== null) {
            $this->dropColumn($table, $column);
        }
    }
}
