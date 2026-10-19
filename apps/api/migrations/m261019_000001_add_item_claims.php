<?php

use yii\db\Migration;

class m261019_000001_add_item_claims extends Migration
{
    public function safeUp()
    {
        foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
            $this->addColumnIfMissing($table, 'claimed_by', $this->string(255)->null());
            $this->addColumnIfMissing($table, 'last_activity_at', $this->dateTime()->null());
            $this->addColumnIfMissing($table, 'assigned_group_id', $this->integer()->unsigned()->null());
        }
        // submission_new_resources already has the legacy claimed_at timestamp column.
        $this->addColumnIfMissing('submission_reuse_resources', 'claimed_at', $this->dateTime()->null());

        $this->createIndex('idx_new_claim_queue', 'submission_new_resources', [
            'claimed_by', 'assigned_group_id', 'submission_id', 'display_order',
        ]);
        $this->createIndex('idx_new_claim_expiry', 'submission_new_resources', ['claimed_by', 'last_activity_at']);
        $this->createIndex('idx_reuse_claim_queue', 'submission_reuse_resources', [
            'claimed_by', 'assigned_group_id', 'submission_id', 'display_order',
        ]);
        $this->createIndex('idx_reuse_claim_expiry', 'submission_reuse_resources', ['claimed_by', 'last_activity_at']);

        $this->addColumn('workflow_events', 'item_kind', $this->string(16)->null());
        $this->createIndex('idx_workflow_events_item_identity', 'workflow_events', ['item_kind', 'item_id']);

        // The old claim path only addressed submission_new_resources; matching both ids and submission ids
        // makes legacy event rows unambiguous even when the two item tables reuse an integer id.
        $this->execute(
            'UPDATE workflow_events e '
            . 'INNER JOIN submission_new_resources n ON n.id = e.item_id AND n.submission_id = e.submission_id '
            . 'SET e.item_kind = "new" WHERE e.item_id IS NOT NULL AND e.item_kind IS NULL'
        );

        // The legacy field stored the users.id token claim. Resolve it to the stable login username;
        // unknown ids stay unclaimed in the new field while the old value remains for cleanup step 7.
        $this->execute(
            'UPDATE submission_new_resources n '
            . 'INNER JOIN users u ON u.id = CAST(n.claimed_by_staff_id AS UNSIGNED) '
            . 'SET n.claimed_by = u.username, n.last_activity_at = COALESCE(n.claimed_at, CURRENT_TIMESTAMP) '
            . 'WHERE n.claimed_by_staff_id IS NOT NULL AND n.claimed_by_staff_id <> "" AND n.claimed_by IS NULL'
        );
        $this->execute(
            'UPDATE submission_new_resources n '
            . 'INNER JOIN users u ON u.username = n.claimed_by_staff_id '
            . 'SET n.claimed_by = u.username, n.last_activity_at = COALESCE(n.claimed_at, CURRENT_TIMESTAMP) '
            . 'WHERE n.claimed_by_staff_id IS NOT NULL AND n.claimed_by_staff_id <> "" AND n.claimed_by IS NULL'
        );
    }

    public function safeDown()
    {
        $this->dropIndex('idx_workflow_events_item_identity', 'workflow_events');
        $this->dropColumn('workflow_events', 'item_kind');
        foreach ([
            ['submission_reuse_resources', 'idx_reuse_claim_expiry', 'idx_reuse_claim_queue'],
            ['submission_new_resources', 'idx_new_claim_expiry', 'idx_new_claim_queue'],
        ] as $definition) {
            list($table, $expiryIndex, $queueIndex) = $definition;
            $this->dropIndex($expiryIndex, $table);
            $this->dropIndex($queueIndex, $table);
            $this->dropColumn($table, 'assigned_group_id');
            $this->dropColumn($table, 'last_activity_at');
            $this->dropColumn($table, 'claimed_by');
        }
        $this->dropColumn('submission_reuse_resources', 'claimed_at');
    }

    private function addColumnIfMissing($table, $column, $definition)
    {
        if (!$this->db->getTableSchema($table, true)->getColumn($column)) {
            $this->addColumn($table, $column, $definition);
        }
    }
}
