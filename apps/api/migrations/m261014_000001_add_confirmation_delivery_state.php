<?php

use yii\db\Migration;

class m261014_000001_add_confirmation_delivery_state extends Migration
{
    public function safeUp()
    {
        $this->addColumn(
            'faculty_submissions',
            'email_confirmation_status',
            $this->string(32)->notNull()->defaultValue('not_requested')
        );
        $this->addColumn('faculty_submissions', 'email_confirmation_requested_at', $this->dateTime()->null());
        $this->addColumn('faculty_submissions', 'email_confirmation_queued_at', $this->dateTime()->null());
        $this->addColumn('faculty_submissions', 'email_confirmation_sent_at', $this->dateTime()->null());
        $this->addColumn('faculty_submissions', 'email_confirmation_failed_at', $this->dateTime()->null());
        $this->addColumn('faculty_submissions', 'email_confirmation_error_at', $this->dateTime()->null());
        $this->addColumn('faculty_submissions', 'email_confirmation_error', $this->string(500)->null());
        $this->addColumn('faculty_submissions', 'email_confirmation_legacy_sent', $this->boolean()->null());

        $this->createIndex(
            'idx_faculty_submissions_confirmation_status',
            'faculty_submissions',
            'email_confirmation_status'
        );

        $this->execute(
            'UPDATE {{%faculty_submissions}} ' .
            'SET [[email_confirmation_legacy_sent]] = [[email_confirmation_sent]], ' .
            '[[email_confirmation_status]] = CASE ' .
            "WHEN [[email_confirmation_sent]] = 1 THEN 'legacy_unknown' ELSE 'not_requested' END"
        );
        $this->execute('UPDATE {{%faculty_submissions}} SET [[email_confirmation_sent]] = 0');
    }

    public function safeDown()
    {
        $this->execute(
            'UPDATE {{%faculty_submissions}} ' .
            'SET [[email_confirmation_sent]] = [[email_confirmation_legacy_sent]] ' .
            'WHERE [[email_confirmation_legacy_sent]] IS NOT NULL'
        );

        $this->dropIndex('idx_faculty_submissions_confirmation_status', 'faculty_submissions');
        $this->dropColumn('faculty_submissions', 'email_confirmation_legacy_sent');
        $this->dropColumn('faculty_submissions', 'email_confirmation_error');
        $this->dropColumn('faculty_submissions', 'email_confirmation_error_at');
        $this->dropColumn('faculty_submissions', 'email_confirmation_failed_at');
        $this->dropColumn('faculty_submissions', 'email_confirmation_sent_at');
        $this->dropColumn('faculty_submissions', 'email_confirmation_queued_at');
        $this->dropColumn('faculty_submissions', 'email_confirmation_requested_at');
        $this->dropColumn('faculty_submissions', 'email_confirmation_status');
    }
}
