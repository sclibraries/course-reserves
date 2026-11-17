<?php

use yii\db\Expression;
use yii\db\Migration;

class m261117_000001_add_workflow_revisions extends Migration
{
    public function safeUp()
    {
        foreach (['submission_publication_state', 'item_flow_runs'] as $table) {
            $this->addNullableColumnIfMissing($table);
            $this->backfill($table);
            $this->makeColumnFinal($table);
        }
    }

    public function safeDown()
    {
        foreach (['submission_publication_state', 'item_flow_runs'] as $table) {
            $schema = $this->db->schema->getTableSchema($table, true);
            if ($schema && $schema->getColumn('workflow_revision') !== null) {
                $this->dropColumn($table, 'workflow_revision');
            }
        }
    }

    private function addNullableColumnIfMissing($table)
    {
        $schema = $this->db->schema->getTableSchema($table, true);
        if (!$schema) {
            throw new \RuntimeException('Required workflow revision table is missing: ' . $table);
        }
        if ($schema->getColumn('workflow_revision') === null) {
            $this->addColumn($table, 'workflow_revision', $this->integer()->unsigned()->null());
        }
    }

    private function backfill($table)
    {
        $column = $this->db->schema->getTableSchema($table, true)->getColumn('workflow_revision');
        if ($column->allowNull) {
            // NULL marks rows not yet backfilled, so an interrupted rerun preserves diverged revisions.
            $this->update($table, [
                'workflow_revision' => new Expression('draft_revision'),
            ], ['workflow_revision' => null]);
        }
    }

    private function makeColumnFinal($table)
    {
        $column = $this->db->schema->getTableSchema($table, true)->getColumn('workflow_revision');
        if ($column->allowNull || (int)$column->defaultValue !== 1) {
            $this->alterColumn(
                $table, 'workflow_revision', $this->integer()->unsigned()->notNull()->defaultValue(1)
            );
        }
    }
}
