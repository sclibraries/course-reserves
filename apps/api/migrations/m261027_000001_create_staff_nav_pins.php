<?php

use yii\db\Migration;

class m261027_000001_create_staff_nav_pins extends Migration
{
    public function safeUp()
    {
        $this->createTable('staff_nav_pins', [
            'user_id' => $this->integer()->notNull(),
            'pins' => $this->text()->notNull(),
            'updated_at' => $this->dateTime()->notNull(),
            'PRIMARY KEY([[user_id]])',
        ]);
        $this->addForeignKey(
            'fk_staff_nav_pins_user',
            'staff_nav_pins',
            'user_id',
            'users',
            'id',
            'CASCADE'
        );

        $this->createTable('staff_nav_pin_defaults', [
            'id' => $this->tinyInteger()->notNull(),
            'pins' => $this->text()->notNull(),
            'updated_by' => $this->integer()->null(),
            'updated_at' => $this->dateTime()->notNull(),
            'PRIMARY KEY([[id]])',
        ]);
        $this->addForeignKey(
            'fk_staff_nav_pin_defaults_updated_by',
            'staff_nav_pin_defaults',
            'updated_by',
            'users',
            'id',
            'SET NULL'
        );
    }

    public function safeDown()
    {
        $this->dropForeignKey('fk_staff_nav_pin_defaults_updated_by', 'staff_nav_pin_defaults');
        $this->dropForeignKey('fk_staff_nav_pins_user', 'staff_nav_pins');
        $this->dropTable('staff_nav_pin_defaults');
        $this->dropTable('staff_nav_pins');
    }
}
