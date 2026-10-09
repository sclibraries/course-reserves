<?php

use yii\db\Migration;

class m260624_000001_add_faculty_workflow_materialization extends Migration
{
    public function safeUp()
    {
        $this->addColumnIfMissing('submission_folders', 'course_folder_id', $this->integer()->null());
        $this->addColumnIfMissing('course_resources', 'folder_id', $this->integer()->null());
        $this->addColumnIfMissing('physical_resource_references', 'folder_id', $this->integer()->null());
        $this->addColumnIfMissing('submission_new_resources', 'staff_notes', $this->text()->null());

        $this->addMaterializationColumns('submission_new_resources');
        $this->addMaterializationColumns('submission_reuse_resources');

        $this->createIndexIfMissing('idx_submission_folders_course_folder_id', 'submission_folders', 'course_folder_id');
        $this->createIndexIfMissing('idx_course_resources_folder_id', 'course_resources', 'folder_id');
        $this->createIndexIfMissing('idx_physical_resource_references_folder_id', 'physical_resource_references', 'folder_id');

        $this->createMaterializationIndexes('submission_new_resources', 'new');
        $this->createMaterializationIndexes('submission_reuse_resources', 'reuse');
    }

    public function safeDown()
    {
        $this->dropMaterializationColumns('submission_reuse_resources');
        $this->dropMaterializationColumns('submission_new_resources');

        $this->dropColumnIfExists('physical_resource_references', 'folder_id');
        $this->dropColumnIfExists('course_resources', 'folder_id');
        $this->dropColumnIfExists('submission_new_resources', 'staff_notes');
        $this->dropColumnIfExists('submission_folders', 'course_folder_id');
    }

    private function addMaterializationColumns($table)
    {
        $this->addColumnIfMissing($table, 'materialized_resource_id', $this->integer()->null());
        $this->addColumnIfMissing($table, 'materialized_course_resource_id', $this->integer()->null());
        $this->addColumnIfMissing($table, 'materialized_physical_reference_id', $this->integer()->null());
        $this->addColumnIfMissing($table, 'materialized_folder_id', $this->integer()->null());
        $this->addColumnIfMissing($table, 'materialized_at', $this->dateTime()->null());
        $this->addColumnIfMissing($table, 'materialized_by_staff_id', $this->string(255)->null());
    }

    private function createMaterializationIndexes($table, $prefix)
    {
        $this->createIndexIfMissing("idx_{$prefix}_materialized_resource_id", $table, 'materialized_resource_id');
        $this->createIndexIfMissing("idx_{$prefix}_materialized_course_resource_id", $table, 'materialized_course_resource_id');
        $this->createIndexIfMissing("idx_{$prefix}_materialized_physical_reference_id", $table, 'materialized_physical_reference_id');
        $this->createIndexIfMissing("idx_{$prefix}_materialized_folder_id", $table, 'materialized_folder_id');
    }

    private function dropMaterializationColumns($table)
    {
        $this->dropColumnIfExists($table, 'materialized_by_staff_id');
        $this->dropColumnIfExists($table, 'materialized_at');
        $this->dropColumnIfExists($table, 'materialized_folder_id');
        $this->dropColumnIfExists($table, 'materialized_physical_reference_id');
        $this->dropColumnIfExists($table, 'materialized_course_resource_id');
        $this->dropColumnIfExists($table, 'materialized_resource_id');
    }

    private function addColumnIfMissing($table, $column, $type)
    {
        $schema = $this->db->schema->getTableSchema($table, true);
        if ($schema && $schema->getColumn($column) === null) {
            $this->addColumn($table, $column, $type);
        }
    }

    private function dropColumnIfExists($table, $column)
    {
        $schema = $this->db->schema->getTableSchema($table, true);
        if ($schema && $schema->getColumn($column) !== null) {
            $this->dropColumn($table, $column);
        }
    }

    private function createIndexIfMissing($name, $table, $columns)
    {
        $existing = $this->db->createCommand(
            'SHOW INDEX FROM ' . $this->db->quoteTableName($table) . ' WHERE Key_name = :name',
            [':name' => $name]
        )->queryOne();

        if ($existing) {
            return;
        }

        $this->createIndex($name, $table, $columns);
    }
}
