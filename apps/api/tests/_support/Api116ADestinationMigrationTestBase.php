<?php

use PHPUnit\Framework\Assert;

/** Verifies API-116A's guarded migration, preservation backfill and migration chain. */
class Api116ADestinationMigrationTestBase extends BaseFunctionalCest
{
    protected $migrationVersion = 'm261102_000001_create_publication_destination_registry';
    protected $fixtures;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->fixtures = new Api116AFixture('test-api116a-migration-');
    }

    public function _after(FunctionalTester $I)
    {
        $this->fixtures->cleanup();
        \Yii::$app->db->schema->refresh();
    }

    protected function assertRegistrySchema()
    {
        $db = \Yii::$app->db;
        foreach (['publication_destinations', 'publication_attachments'] as $table) {
            Assert::assertNotNull($db->schema->getTableSchema($table, true), $table . ' exists.');
            Assert::assertSame('InnoDB', $db->createCommand(
                'SELECT ENGINE FROM information_schema.TABLES '
                . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table',
                [':table' => $table]
            )->queryScalar());
        }
        $destinations = $db->schema->getTableSchema('publication_destinations', true)->columns;
        $attachments = $db->schema->getTableSchema('publication_attachments', true)->columns;
        foreach ([
            'id', 'destination_kind', 'course_resource_id', 'physical_reference_id', 'offering_id',
            'origin_offering_id', 'owner_item_kind', 'owner_item_id', 'owner_live', 'ownership_source',
            'created_at', 'updated_at', 'retired_at',
        ] as $column) {
            Assert::assertArrayHasKey($column, $destinations);
        }
        foreach ([
            'id', 'destination_id', 'item_kind', 'item_id', 'attached_snapshot_json', 'live',
            'attached_at', 'updated_at', 'detached_at',
        ] as $column) {
            Assert::assertArrayHasKey($column, $attachments);
        }
        Assert::assertTrue($destinations['offering_id']->allowNull);
        Assert::assertFalse($destinations['origin_offering_id']->allowNull);
        Assert::assertSame('int(11)', strtolower($destinations['origin_offering_id']->dbType));
        Assert::assertFalse(strpos(strtolower($destinations['course_resource_id']->dbType), 'unsigned') !== false);
        Assert::assertFalse(strpos(strtolower($destinations['physical_reference_id']->dbType), 'unsigned') !== false);
        Assert::assertTrue(strpos(strtolower($destinations['owner_item_id']->dbType), 'unsigned') !== false);
        Assert::assertTrue(strpos(strtolower($attachments['item_id']->dbType), 'unsigned') !== false);
        Assert::assertSame(0, strpos(strtolower($destinations['owner_live']->dbType), 'tinyint'));
        Assert::assertSame(0, strpos(strtolower($attachments['live']->dbType), 'tinyint'));

        $this->assertUniqueKey('publication_destinations', ['course_resource_id']);
        $this->assertUniqueKey('publication_destinations', ['physical_reference_id']);
        $this->assertUniqueKey('publication_destinations', ['owner_item_kind', 'owner_item_id', 'owner_live']);
        $this->assertUniqueKey('publication_attachments', ['item_kind', 'item_id', 'live']);
        foreach ([
            ['publication_destinations', 'offering_id', 'course_offerings', 'offering_id', 'SET NULL'],
            ['publication_destinations', 'course_resource_id', 'course_resources', 'course_resource_id', 'SET NULL'],
            ['publication_destinations', 'physical_reference_id', 'physical_resource_references', 'reference_id', 'SET NULL'],
            ['publication_attachments', 'destination_id', 'publication_destinations', 'id', null],
        ] as $foreignKey) {
            $this->assertForeignKey($foreignKey[0], $foreignKey[1], $foreignKey[2], $foreignKey[3], $foreignKey[4]);
        }
        Assert::assertSame(0, (int)$db->createCommand(
            'SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "publication_destinations" '
            . 'AND COLUMN_NAME = "origin_offering_id" AND REFERENCED_TABLE_NAME IS NOT NULL'
        )->queryScalar(), 'Historical origin_offering_id has no foreign key.');
    }

    protected function assertUniqueKey($table, array $columns)
    {
        $rows = \Yii::$app->db->createCommand(
            'SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index '
            . 'FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() '
            . 'AND TABLE_NAME = :table AND NON_UNIQUE = 0 GROUP BY index_name',
            [':table' => $table]
        )->queryAll();
        $expected = implode(',', $columns);
        $actual = array_column($rows, 'columns_in_index');
        Assert::assertContains($expected, $actual, $table . ' unique key: ' . $expected);
    }

    protected function assertForeignKey($table, $column, $referencedTable, $referencedColumn, $deleteRule)
    {
        $row = \Yii::$app->db->createCommand(
            'SELECT key_usage.REFERENCED_TABLE_NAME AS referenced_table, '
            . 'key_usage.REFERENCED_COLUMN_NAME AS referenced_column, constraint_row.DELETE_RULE AS delete_rule '
            . 'FROM information_schema.KEY_COLUMN_USAGE key_usage '
            . 'INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS constraint_row '
            . 'ON constraint_row.CONSTRAINT_SCHEMA = key_usage.CONSTRAINT_SCHEMA '
            . 'AND constraint_row.CONSTRAINT_NAME = key_usage.CONSTRAINT_NAME '
            . 'WHERE key_usage.TABLE_SCHEMA = DATABASE() AND key_usage.TABLE_NAME = :table '
            . 'AND key_usage.COLUMN_NAME = :column AND key_usage.REFERENCED_TABLE_NAME IS NOT NULL',
            [':table' => $table, ':column' => $column]
        )->queryOne();
        Assert::assertSame($referencedTable, $row['referenced_table'], $table . '.' . $column . ' target table.');
        Assert::assertSame($referencedColumn, $row['referenced_column'], $table . '.' . $column . ' target column.');
        if ($deleteRule !== null) {
            Assert::assertSame($deleteRule, $row['delete_rule'], $table . '.' . $column . ' delete rule.');
        }
    }

    protected function assertReportedCategoryCounts($output, array $expected)
    {
        foreach ($expected as $category => $count) {
            Assert::assertSame(1, preg_match(
                '/\b' . preg_quote($category, '/') . '\s*[:=]\s*' . (int)$count . '\b/i',
                $output
            ), 'Migration output must report ' . $category . '=' . $count . ': ' . $output);
        }
    }

    protected function assertLiveAttachment(array $item, array $destination, $kind)
    {
        $row = $this->attachmentRow($item);
        Assert::assertNotFalse($row, 'Expected a live attachment for ' . $item['kind'] . ':' . $item['id']);
        if ($kind === 'physical') {
            Assert::assertNull($row['destination_course_resource_id']);
            Assert::assertSame((string)$destination['physical_reference_id'], $row['destination_physical_reference_id']);
        } else {
            Assert::assertSame((string)$destination['course_resource_id'], $row['destination_course_resource_id']);
            Assert::assertNull($row['destination_physical_reference_id']);
        }
        Assert::assertSame('1', $row['live']);
    }

    protected function assertNoAttachment(array $item, $message)
    {
        Assert::assertFalse($this->attachmentRow($item), $message);
    }

    protected function attachmentRow(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT attachment.*, destination.course_resource_id AS destination_course_resource_id, '
            . 'destination.physical_reference_id AS destination_physical_reference_id '
            . 'FROM publication_attachments attachment INNER JOIN publication_destinations destination '
            . 'ON destination.id = attachment.destination_id '
            . 'WHERE attachment.item_kind = :kind AND attachment.item_id = :id ORDER BY attachment.id DESC LIMIT 1',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryOne();
    }

    protected function snapshot(array $item)
    {
        $row = $this->attachmentRow($item);
        return json_decode($row['attached_snapshot_json'], true);
    }

    protected function assertElectronicSnapshotUsesLiveContent(array $item, array $destination)
    {
        $snapshot = $this->snapshot($item);
        Assert::assertSame('electronic', $snapshot['destination_kind']);
        Assert::assertSame($destination['offering_id'], $snapshot['offering_id']);
        Assert::assertSame($destination['course_resource_id'], $snapshot['course_resource_id']);
        Assert::assertSame($destination['resource_id'], $snapshot['resource_id']);
        Assert::assertSame($this->fixtures->electronicResourceName('backfill-shared'), $snapshot['name']);
        Assert::assertSame('Synthetic public note backfill-shared', $snapshot['external_note']);
        Assert::assertStringNotContainsString('Synthetic private note', json_encode($snapshot));
        Assert::assertStringNotContainsString('same-id-new draft', json_encode($snapshot));
    }

    protected function stateRow(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT state, draft_revision, published_revision, pending_changes, readiness_source, readiness_reason, '
            . 'readiness_run_id, readiness_revision, readiness_context_json, published_by_staff_id, published_at, '
            . 'published_destination_json, published_snapshot, reconciliation_status, reconciliation_reason, '
            . 'created_at, updated_at FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryOne();
    }

    protected function physicalIdentity($referenceId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT external_resource_id, folio_instance_id, legacy_identifier, legacy_identifier_type, '
            . 'identity_status, identity_provenance_json, updated_at FROM physical_resource_references '
            . 'WHERE reference_id = :id',
            [':id' => $referenceId]
        )->queryOne();
    }

    protected function physicalContent($referenceId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT resource_type, display_name, public_note, assigned_pages, offering_id, `order`, created_at, updated_at '
            . 'FROM physical_resource_references WHERE reference_id = :id',
            [':id' => $referenceId]
        )->queryOne();
    }

    protected function resourceContent($resourceId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT name, item_url, description, external_note, assigned_pages, internal_note, created_at '
            . 'FROM resources WHERE resource_id = :id', [':id' => $resourceId]
        )->queryOne();
    }

    protected function electronicLiveContent(array $destination)
    {
        $resourceId = $destination['resource_id'];
        return [
            'resource' => $this->resourceContent($resourceId),
            'course_resource' => $this->courseResourceContent($destination['course_resource_id']),
            'metadata' => \Yii::$app->db->createCommand(
                'SELECT field_name, field_value, created_at FROM resource_metadata '
                . 'WHERE resource_id = :id ORDER BY metadata_id', [':id' => $resourceId]
            )->queryAll(),
            'links' => \Yii::$app->db->createCommand(
                'SELECT url, title, description, use_proxy, `order`, created_at FROM resource_links '
                . 'WHERE resource_id = :id ORDER BY link_id', [':id' => $resourceId]
            )->queryAll(),
        ];
    }

    protected function courseResourceContent($courseResourceId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT offering_id, resource_id, `order`, created_at FROM course_resources '
            . 'WHERE course_resource_id = :id', [':id' => $courseResourceId]
        )->queryOne();
    }

    protected function destinationIdForCourseResource($courseResourceId)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT id FROM publication_destinations WHERE course_resource_id = :id',
            [':id' => $courseResourceId]
        )->queryScalar();
    }

    protected function setIdentity(array $item, $instanceId)
    {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $field = $item['kind'] === 'new' ? 'resource_data' : 'source_snapshot_json';
        $value = json_encode(['eds' => ['an' => Api116AFixture::accession($instanceId)]]);
        \Yii::$app->db->createCommand()->update($table, [$field => $value], ['id' => $item['id']])->execute();
    }

    protected function replaceItemId(array $item, $newId)
    {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        \Yii::$app->db->createCommand()->update($table, ['id' => $newId], ['id' => $item['id']])->execute();
    }

    protected function autoIncrement($table)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT AUTO_INCREMENT FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table',
            [':table' => $table]
        )->queryScalar();
    }

    protected function assertMigrationNotApplied()
    {
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM migration WHERE version = :version',
            [':version' => $this->migrationVersion]
        )->queryScalar());
    }

    protected function createPartiallyAppliedTables($includeAttachments = true)
    {
        $db = \Yii::$app->db;
        $db->createCommand(
            'CREATE TABLE publication_destinations ('
            . 'id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, '
            . 'destination_kind ENUM("electronic","physical") NOT NULL, '
            . 'course_resource_id INT NULL, physical_reference_id INT NULL, offering_id INT NULL, '
            . 'origin_offering_id INT NOT NULL, owner_item_kind VARCHAR(16) NULL, '
            . 'owner_item_id BIGINT UNSIGNED NULL, owner_live TINYINT NULL, '
            . 'ownership_source VARCHAR(16) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, '
            . 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, '
            . 'retired_at DATETIME NULL) ENGINE=InnoDB'
        )->execute();
        if ($includeAttachments) {
            $db->createCommand(
                'CREATE TABLE publication_attachments ('
                . 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, destination_id INT NOT NULL, '
                . 'item_kind VARCHAR(16) NOT NULL, item_id BIGINT UNSIGNED NOT NULL, '
                . 'attached_snapshot_json LONGTEXT NOT NULL, live TINYINT NULL, '
                . 'attached_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, '
                . 'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, '
                . 'detached_at DATETIME NULL) ENGINE=InnoDB'
            )->execute();
        }
    }
}
