<?php

use yii\db\Migration;

class m261016_000001_add_roster_course_to_faculty_submissions extends Migration
{
    public function safeUp()
    {
        $this->addColumn('faculty_submissions', 'its_course_id', $this->string(64)->null());
        $this->addColumn('faculty_submissions', 'academic_period', $this->string(16)->null());
        $this->addColumn('faculty_submissions', 'roster_term_id', $this->string(64)->null());
        $this->createIndex(
            'idx_faculty_submissions_roster_course',
            'faculty_submissions',
            ['shibboleth_user_id', 'its_course_id']
        );
    }

    public function safeDown()
    {
        $this->dropIndex('idx_faculty_submissions_roster_course', 'faculty_submissions');
        $this->dropColumn('faculty_submissions', 'roster_term_id');
        $this->dropColumn('faculty_submissions', 'academic_period');
        $this->dropColumn('faculty_submissions', 'its_course_id');
    }
}
