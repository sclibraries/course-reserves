<?php

use yii\db\Migration;

class m261030_000002_add_destination_fields_and_copy_inputs extends Migration
{
    public function safeUp()
    {
        $this->addColumnIfMissing('resources', 'assigned_pages', $this->text()->null());
        foreach ([
            'public_note' => $this->text()->null(),
            'assigned_pages' => $this->text()->null(),
            'start_visibility' => $this->date()->null(),
            'end_visibility' => $this->date()->null(),
            'use_visibility' => $this->boolean()->notNull()->defaultValue(0),
        ] as $column => $definition) {
            $this->addColumnIfMissing('physical_resource_references', $column, $definition);
        }
        $this->versionLegacySnapshots('submission_new_resources');
        $this->versionLegacySnapshots('submission_reuse_resources');
    }

    public function safeDown()
    {
        foreach ([
            'physical_resource_references' => [
                'use_visibility', 'end_visibility', 'start_visibility', 'assigned_pages', 'public_note',
            ],
            'resources' => ['assigned_pages'],
        ] as $table => $columns) {
            foreach ($columns as $column) {
                $this->dropColumnIfExists($table, $column);
            }
        }
    }

    private function versionLegacySnapshots($table)
    {
        $rows = $this->db->createCommand(
            'SELECT id, source_snapshot_json FROM ' . $table
            . ' WHERE source_snapshot_json IS NOT NULL AND source_snapshot_json <> ""'
        )->queryAll();
        $schema = $this->db->schema->getTableSchema($table, true);
        foreach ($rows as $row) {
            $snapshot = json_decode($row['source_snapshot_json'], true);
            if (!is_array($snapshot) || !$snapshot || array_key_exists('version', $snapshot)) {
                continue;
            }
            $snapshot['version'] = 1;
            $values = ['source_snapshot_json' => json_encode($snapshot, JSON_UNESCAPED_SLASHES)];
            if ($schema->getColumn('updated_at') !== null) {
                $values['updated_at'] = new \yii\db\Expression('updated_at');
            }
            $this->db->createCommand()->update($table, $values, ['id' => $row['id']])->execute();
        }
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
