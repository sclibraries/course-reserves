<?php

use yii\db\Migration;

class m261016_000003_add_link_suggestions extends Migration
{
    public function safeUp()
    {
        $this->createTable('link_suggestions', [
            'id' => $this->primaryKey(),
            'submission_id' => $this->bigInteger()->unsigned()->notNull(),
            'folio_course_listing_id' => $this->string(255)->null(),
            'match' => $this->string(16)->null(),
            'fields_json' => $this->json()->notNull(),
            'candidate_json' => $this->json()->null(),
            'checked_at' => $this->dateTime()->null(),
            'last_error_at' => $this->dateTime()->null(),
            'requested_at' => $this->dateTime()->null(),
        ]);
        $this->createIndex(
            'idx_link_suggestions_submission_checked',
            'link_suggestions',
            ['submission_id', 'checked_at']
        );
        $this->createIndex('idx_link_suggestions_requested_at', 'link_suggestions', 'requested_at');
        $this->createIndex(
            'idx_faculty_submissions_link_queue',
            'faculty_submissions',
            ['link_state', 'submitted_at', 'submission_id']
        );
    }

    public function safeDown()
    {
        $this->dropIndex('idx_faculty_submissions_link_queue', 'faculty_submissions');
        $this->dropTable('link_suggestions');
    }
}
