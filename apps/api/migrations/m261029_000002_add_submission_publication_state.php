<?php

use yii\db\Migration;
use app\services\SubmissionPublicationStateMigrationReconciler;

class m261029_000002_add_submission_publication_state extends Migration
{
    public function safeUp()
    {
        $this->addColumnIfMissing('item_flow_runs', 'draft_revision', $this->integer()->unsigned()->notNull()->defaultValue(1));
        if (!$this->db->schema->getTableSchema('submission_publication_state', true)) {
            $this->createTable('submission_publication_state', [
                'item_kind' => $this->string(16)->notNull(),
                'item_id' => $this->bigInteger()->unsigned()->notNull(),
                'submission_id' => $this->bigInteger()->unsigned()->notNull(),
                'state' => "ENUM('pending','ready','published','published_with_pending_edits') NOT NULL DEFAULT 'pending'",
                'draft_revision' => $this->integer()->unsigned()->notNull()->defaultValue(1),
                'published_revision' => $this->integer()->unsigned()->null(),
                'pending_changes' => "ENUM('none','pending','unknown') NOT NULL DEFAULT 'none'",
                'readiness_source' => "ENUM('flow','manual') DEFAULT NULL",
                'readiness_reason' => $this->text()->null(),
                'readiness_run_id' => $this->bigInteger()->unsigned()->null(),
                'readiness_revision' => $this->integer()->unsigned()->null(),
                'readiness_context_json' => 'LONGTEXT NULL',
                'published_by_staff_id' => $this->string(255)->null(),
                'published_at' => $this->dateTime()->null(),
                'published_destination_json' => 'LONGTEXT NULL',
                'published_snapshot' => 'LONGTEXT NULL',
                'reconciliation_status' => $this->string(40)->notNull()->defaultValue('not_reconciled'),
                'reconciliation_reason' => $this->text()->null(),
                'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
                'updated_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
                'PRIMARY KEY(item_kind, item_id)',
            ]);
            $this->createIndex('idx_publication_state_submission', 'submission_publication_state', 'submission_id');
            $this->addForeignKey(
                'fk_publication_state_submission', 'submission_publication_state',
                'submission_id', 'faculty_submissions', 'submission_id', 'CASCADE'
            );
        }

        (new SubmissionPublicationStateMigrationReconciler($this->db))->reconcile();
    }

    public function safeDown()
    {
        if ($this->db->schema->getTableSchema('submission_publication_state', true)) {
            $this->dropTable('submission_publication_state');
        }
        $this->dropColumnIfExists('item_flow_runs', 'draft_revision');
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
