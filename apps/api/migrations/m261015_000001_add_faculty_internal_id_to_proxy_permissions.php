<?php

use yii\db\Migration;

class m261015_000001_add_faculty_internal_id_to_proxy_permissions extends Migration
{
    public function safeUp()
    {
        $this->addColumn(
            'faculty_proxy_permissions',
            'faculty_internal_id',
            $this->string(255)->null()
        );
    }

    public function safeDown()
    {
        $this->dropColumn('faculty_proxy_permissions', 'faculty_internal_id');
    }
}
