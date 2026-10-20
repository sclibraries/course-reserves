<?php

use yii\db\Migration;

class m261020_000001_add_submission_draft_version extends Migration
{
    public function safeUp()
    {
        $this->addColumn('{{%faculty_submissions}}', 'draft_version', $this->integer()->notNull()->defaultValue(0));
    }

    public function safeDown()
    {
        $this->dropColumn('{{%faculty_submissions}}', 'draft_version');
    }
}
