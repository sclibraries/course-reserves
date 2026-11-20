<?php

use app\services\FacultyLockLatchBackfill;
use yii\db\Migration;

class m261120_000001_add_faculty_lock_latch extends Migration
{
    public function safeUp()
    {
        foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
            $this->addColumnIfMissing($table, 'locked_for_faculty_at', $this->dateTime()->null());
        }

        (new FacultyLockLatchBackfill($this->db))->backfill(date('Y-m-d H:i:s'));
    }

    public function safeDown()
    {
        foreach (['submission_reuse_resources', 'submission_new_resources'] as $table) {
            $this->dropColumnIfExists($table, 'locked_for_faculty_at');
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
