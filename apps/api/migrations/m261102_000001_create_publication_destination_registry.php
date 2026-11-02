<?php

use app\services\PublicationDestinationBackfill;
use yii\db\Migration;

class m261102_000001_create_publication_destination_registry extends Migration
{
    public function safeUp()
    {
        $this->createDestinationTableIfMissing();
        $this->createAttachmentTableIfMissing();
        $this->ensureIndexes();
        $this->ensureForeignKeys();
        $this->ensurePointerCheck();
        $this->db->schema->refresh();
        (new PublicationDestinationBackfill($this->db))->run();
    }

    public function safeDown()
    {
        foreach (['publication_attachments', 'publication_destinations'] as $table) {
            if (!$this->db->schema->getTableSchema($table, true)) {
                continue;
            }
            $keys = $this->db->createCommand(
                'SELECT DISTINCT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE '
                . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table '
                . 'AND REFERENCED_TABLE_NAME IS NOT NULL', [':table' => $table]
            )->queryColumn();
            foreach ($keys as $key) {
                $this->dropForeignKey($key, $table);
            }
        }
        foreach (['publication_attachments', 'publication_destinations'] as $table) {
            if ($this->db->schema->getTableSchema($table, true)) {
                $this->dropTable($table);
            }
        }
    }

    private function createDestinationTableIfMissing()
    {
        if ($this->db->schema->getTableSchema('publication_destinations', true)) {
            return;
        }
        $this->createTable('publication_destinations', [
            'id' => $this->primaryKey(),
            'destination_kind' => "ENUM('electronic','physical') NOT NULL",
            'course_resource_id' => $this->integer()->null(),
            'physical_reference_id' => $this->integer()->null(),
            'offering_id' => $this->integer()->null(),
            'origin_offering_id' => $this->integer()->notNull(),
            'owner_item_kind' => "ENUM('new','reuse') NULL",
            'owner_item_id' => $this->bigInteger()->unsigned()->null(),
            'owner_live' => $this->tinyInteger()->null(),
            'ownership_source' => "ENUM('published','released','none') NOT NULL DEFAULT 'none'",
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
            'updated_at' => $this->timestamp()->notNull()->defaultExpression(
                'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            ),
            'retired_at' => $this->dateTime()->null(),
        ], 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    }

    private function createAttachmentTableIfMissing()
    {
        if ($this->db->schema->getTableSchema('publication_attachments', true)) {
            return;
        }
        $this->createTable('publication_attachments', [
            'id' => $this->bigPrimaryKey()->unsigned(),
            'destination_id' => $this->integer()->notNull(),
            'item_kind' => "ENUM('new','reuse') NOT NULL",
            'item_id' => $this->bigInteger()->unsigned()->notNull(),
            'attached_snapshot_json' => 'LONGTEXT NOT NULL',
            'live' => $this->tinyInteger()->null(),
            'attached_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
            'updated_at' => $this->timestamp()->notNull()->defaultExpression(
                'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            ),
            'detached_at' => $this->dateTime()->null(),
        ], 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    }

    private function ensureIndexes()
    {
        foreach ([
            ['publication_destinations', 'uq_pub_dest_course_resource', ['course_resource_id'], true],
            ['publication_destinations', 'uq_pub_dest_physical_reference', ['physical_reference_id'], true],
            ['publication_destinations', 'uq_pub_dest_owner_live', ['owner_item_kind', 'owner_item_id', 'owner_live'], true],
            ['publication_destinations', 'idx_pub_dest_offering', ['offering_id'], false],
            ['publication_attachments', 'idx_pub_attach_destination', ['destination_id'], false],
            ['publication_attachments', 'uq_pub_attach_item_live', ['item_kind', 'item_id', 'live'], true],
        ] as list($table, $name, $columns, $unique)) {
            if (!$this->hasIndex($table, $name)) {
                $this->createIndex($name, $table, $columns, $unique);
            }
        }
    }

    private function ensureForeignKeys()
    {
        foreach ([
            ['publication_destinations', 'offering_id', 'course_offerings', 'offering_id', 'SET NULL', 'fk_pub_dest_offering'],
            ['publication_destinations', 'course_resource_id', 'course_resources', 'course_resource_id', 'SET NULL', 'fk_pub_dest_course_resource'],
            ['publication_destinations', 'physical_reference_id', 'physical_resource_references', 'reference_id', 'SET NULL', 'fk_pub_dest_physical_reference'],
            ['publication_attachments', 'destination_id', 'publication_destinations', 'id', null, 'fk_pub_attach_destination'],
        ] as list($table, $column, $refTable, $refColumn, $onDelete, $name)) {
            if ($this->hasForeignKey($table, $column, $refTable, $refColumn)) {
                continue;
            }
            $this->addForeignKey($name, $table, $column, $refTable, $refColumn, $onDelete);
        }
    }

    private function ensurePointerCheck()
    {
        $exists = (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS '
            . 'WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = "publication_destinations" '
            . 'AND CONSTRAINT_NAME = "chk_pub_dest_pointer_shape" AND CONSTRAINT_TYPE = "CHECK"'
        )->queryScalar();
        if (!$exists) {
            $this->execute(
                'ALTER TABLE publication_destinations ADD CONSTRAINT chk_pub_dest_pointer_shape CHECK ('
                . '(course_resource_id IS NULL AND physical_reference_id IS NULL) OR '
                . '(destination_kind = "electronic" AND course_resource_id IS NOT NULL AND physical_reference_id IS NULL) OR '
                . '(destination_kind = "physical" AND course_resource_id IS NULL AND physical_reference_id IS NOT NULL))'
            );
        }
    }

    private function hasIndex($table, $name)
    {
        return (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() '
            . 'AND TABLE_NAME = :table AND INDEX_NAME = :name',
            [':table' => $table, ':name' => $name]
        )->queryScalar() > 0;
    }

    private function hasForeignKey($table, $column, $refTable, $refColumn)
    {
        return (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() '
            . 'AND TABLE_NAME = :table AND COLUMN_NAME = :column AND REFERENCED_TABLE_NAME = :refTable '
            . 'AND REFERENCED_COLUMN_NAME = :refColumn',
            [':table' => $table, ':column' => $column, ':refTable' => $refTable, ':refColumn' => $refColumn]
        )->queryScalar() > 0;
    }
}
