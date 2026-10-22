<?php

use yii\db\Migration;

class m261022_000001_create_submission_syllabi extends Migration
{
    public function safeUp()
    {
        $this->createTable('{{%submission_syllabi}}', [
            'id' => $this->primaryKey(),
            'submission_id' => $this->bigInteger()->unsigned()->notNull(),
            'source' => $this->string(16)->notNull(),
            'google_doc_id' => $this->string(128)->null(),
            'source_url' => $this->text()->null(),
            'stored_path' => $this->string(255)->notNull(),
            'original_filename' => $this->string(255)->notNull(),
            'mime_type' => $this->string(127)->notNull(),
            'byte_size' => $this->integer()->unsigned()->notNull(),
            'extracted_text' => 'LONGTEXT NOT NULL',
            'added_by' => $this->string(255)->notNull(),
            'added_by_role' => $this->string(16)->notNull(),
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
        ]);
        $this->createIndex('idx_submission_syllabi_submission', '{{%submission_syllabi}}', ['submission_id', 'id']);
        $this->addForeignKey(
            'fk_submission_syllabi_submission',
            '{{%submission_syllabi}}',
            'submission_id',
            '{{%faculty_submissions}}',
            'submission_id',
            'CASCADE'
        );
    }

    public function safeDown()
    {
        $this->dropTable('{{%submission_syllabi}}');
    }
}
