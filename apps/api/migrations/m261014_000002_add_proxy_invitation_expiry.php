<?php

use yii\db\Migration;

class m261014_000002_add_proxy_invitation_expiry extends Migration
{
    public function safeUp()
    {
        $this->addColumn(
            'faculty_proxy_permissions',
            'invitation_expires_at',
            $this->dateTime()->null()
        );
        $this->execute(
            'UPDATE {{%faculty_proxy_permissions}} '
            . 'SET [[invitation_expires_at]] = DATE_ADD([[invited_at]], INTERVAL 14 DAY)'
        );
    }

    public function safeDown()
    {
        $this->dropColumn('faculty_proxy_permissions', 'invitation_expires_at');
    }
}
