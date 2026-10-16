<?php

use yii\db\Migration;

class m261016_000002_add_workflow_linking extends Migration
{
    public function safeUp()
    {
        $this->createTable('workflow_events', [
            'id' => $this->primaryKey(),
            'submission_id' => $this->bigInteger()->unsigned()->notNull(),
            'item_id' => $this->bigInteger()->unsigned()->null(),
            'actor_username' => $this->string(255)->notNull(),
            'actor_role' => $this->string(32)->notNull(),
            'event_type' => $this->string(64)->notNull(),
            'reason' => $this->text()->null(),
            'before_json' => $this->json()->null(),
            'after_json' => $this->json()->null(),
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
        ]);
        $this->createIndex('idx_workflow_events_submission_id', 'workflow_events', 'submission_id');
        $this->createIndex('idx_workflow_events_item_id', 'workflow_events', 'item_id');
        $this->createIndex('idx_workflow_events_created_at', 'workflow_events', 'created_at');

        $this->addColumn('faculty_submissions', 'link_state', $this->string(32)->notNull()->defaultValue('needs_linking'));
        $this->addColumn('faculty_submissions', 'link_flag', $this->string(32)->null());
        $this->addColumn('faculty_submissions', 'linked_at', $this->dateTime()->null());
        $this->addColumn('faculty_submissions', 'linked_by', $this->string(255)->null());
        $this->execute("UPDATE faculty_submissions SET link_state = 'linked' WHERE offering_id IS NOT NULL OR folio_course_listing_id IS NOT NULL");
    }

    public function safeDown()
    {
        $this->dropColumn('faculty_submissions', 'linked_by');
        $this->dropColumn('faculty_submissions', 'linked_at');
        $this->dropColumn('faculty_submissions', 'link_flag');
        $this->dropColumn('faculty_submissions', 'link_state');
        $this->dropTable('workflow_events');
    }
}
