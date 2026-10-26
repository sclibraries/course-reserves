<?php

use yii\db\Migration;

class m261026_000001_add_staff_entered_submission_metadata extends Migration
{
    public function safeUp()
    {
        $this->addColumn('{{%faculty_submissions}}', 'entered_by', $this->string(255)->null());
        $this->addColumn('{{%faculty_submissions}}', 'entry_source', $this->string(32)->null());
    }

    public function safeDown()
    {
        $this->dropColumn('{{%faculty_submissions}}', 'entry_source');
        $this->dropColumn('{{%faculty_submissions}}', 'entered_by');
    }
}
