<?php

use yii\db\Migration;

/**
 * Class m250422_144717_change_display_name_to_text
 */
class m250422_144717_change_display_name_to_text extends Migration
{
    /**
     * {@inheritdoc}
     */
    public function safeUp()
    {

    }

    /**
     * {@inheritdoc}
     */
    public function safeDown()
    {
        echo "m250422_144717_change_display_name_to_text cannot be reverted.\n";

        return false;
    }

    public function up()
    {
        // Make sure your DB component charset is utf8mb4 in config/db.php
        $this->alterColumn(
            'physical_resource_references',
            'display_name',
            "TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
        );
    }

    public function down()
    {
        // Roll back to VARCHAR(255) if needed:
        $this->alterColumn(
            'physical_resource_references',
            'display_name',
            "VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"
        );
    }
}
