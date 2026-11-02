<?php

use PHPUnit\Framework\Assert;

/** Exercises API-118's merged migration with synthetic canonical and UUID source ids. */
class Api118SourceResourceIdMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261029_000003_add_publication_input_projection';
    private $prefix = 'test-api118-migration-';
    private $submissionUuid;
    private $submissionId;
    private $itemIds = [];
    private $resourceIds = [];
    private $originalResourcesAutoIncrement;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $db = \Yii::$app->db;
        $this->originalResourcesAutoIncrement = (int)$db->createCommand(
            'SELECT AUTO_INCREMENT FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "resources"'
        )->queryScalar();
    }

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        if ($this->submissionId) {
            $db->createCommand()->delete('workflow_events', ['submission_id' => $this->submissionId])->execute();
            $db->createCommand()->delete('submission_publication_state', ['submission_id' => $this->submissionId])->execute();
            foreach ($this->itemIds as $itemId) {
                $db->createCommand()->delete('item_flow_runs', [
                    'item_kind' => 'new', 'item_id' => $itemId,
                ])->execute();
            }
        }
        TestSubmissionFixture::delete($this->submissionUuid);
        foreach ($this->resourceIds as $resourceId) {
            $db->createCommand()->delete('resource_links', ['resource_id' => $resourceId])->execute();
            $db->createCommand()->delete('resource_metadata', ['resource_id' => $resourceId])->execute();
            $db->createCommand()->delete('resources', ['resource_id' => $resourceId])->execute();
        }
        if ($this->originalResourcesAutoIncrement > 0) {
            $db->createCommand()->execute('ALTER TABLE resources AUTO_INCREMENT = '
                . (int)$this->originalResourcesAutoIncrement);
        }
        $this->submissionUuid = null;
        $this->submissionId = null;
        $this->itemIds = [];
        $this->resourceIds = [];
    }

    public function testMigrationFreezesOnlyCanonicalIdsOnFreshDataAndPreservesNulls(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $ids = $this->seedRows(false);
            MigrationRollback::migrate('up');
            \Yii::$app->db->schema->refresh();
            $this->assertFreshMigrationRows($ids);
        });
    }

    public function testMigrationClearsContaminatedUuidSnapshotsAndRerunsWithPreexistingColumns(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $this->addProjectionColumnsLikeAnInterruptedApply();
            $ids = $this->seedRows(true);
            $db = \Yii::$app->db;
            $db->createCommand()->update('submission_new_resources', [
                'material_type_id' => $this->materialTypeId('article'),
                'source_snapshot_json' => json_encode([
                    'version' => 1,
                    'title' => 'Synthetic false UUID snapshot',
                ]),
            ], ['id' => $ids['uuid_existing']])->execute();
            $db->createCommand()->insert('submission_publication_state', [
                'item_kind' => 'new',
                'item_id' => $ids['uuid_existing'],
                'submission_id' => $this->submissionId,
                'state' => 'ready',
                'draft_revision' => 17,
                'published_revision' => 12,
                'pending_changes' => 'pending',
                'readiness_source' => 'manual',
                'readiness_reason' => 'Synthetic preserved readiness',
                'readiness_revision' => 17,
                'readiness_context_json' => json_encode(['synthetic' => 'preserved readiness context']),
                'published_destination_json' => json_encode(['kind' => 'electronic', 'resource_id' => 118001]),
                'published_snapshot' => json_encode(['resource' => ['name' => 'Synthetic live course title']]),
            ])->execute();

            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM migration WHERE version = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar());
            Assert::assertArrayHasKey(
                'source_snapshot_json',
                $db->schema->getTableSchema('submission_new_resources', true)->columns
            );
            MigrationRollback::migrate('up');
            \Yii::$app->db->schema->refresh();
            $this->assertPartialRerunRows($ids);

            $db->createCommand()->delete('migration', ['version' => $this->migrationVersion])->execute();
            MigrationRollback::migrate('up');
            \Yii::$app->db->schema->refresh();
            $this->assertPartialRerunRows($ids);
        });
    }

    public function testFullMigrationChainUpsDownsAndRerunsWithUuidRows(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $ids = $this->seedRows(false);
            $this->migrateFullChainUp();
            \Yii::$app->db->schema->refresh();
            $this->assertFreshMigrationRows($ids);
            $this->assertMigrationRecorded('m261029_000003_add_publication_input_projection');
            $this->assertMigrationRecorded('m261030_000001_add_physical_reference_identity');
            $this->assertMigrationRecorded('m261030_000002_add_destination_fields_and_copy_inputs');

            MigrationRollback::migrate('down');
            MigrationRollback::migrate('down');
            MigrationRollback::migrate('down');
            \Yii::$app->db->schema->refresh();
            Assert::assertArrayNotHasKey(
                'source_snapshot_json',
                \Yii::$app->db->schema->getTableSchema('submission_new_resources', true)->columns
            );
            Assert::assertArrayNotHasKey(
                'identity_status',
                \Yii::$app->db->schema->getTableSchema('physical_resource_references', true)->columns
            );
            Assert::assertArrayNotHasKey(
                'assigned_pages',
                \Yii::$app->db->schema->getTableSchema('physical_resource_references', true)->columns
            );
            $this->assertStoredSourceIdsRemainUnchanged($ids);

            $this->migrateFullChainUp();
            \Yii::$app->db->schema->refresh();
            Assert::assertArrayHasKey(
                'identity_status',
                \Yii::$app->db->schema->getTableSchema('physical_resource_references', true)->columns
            );
            Assert::assertArrayHasKey(
                'assigned_pages',
                \Yii::$app->db->schema->getTableSchema('physical_resource_references', true)->columns
            );
            $this->assertFreshMigrationRows($ids);
        });
    }

    private function seedRows($projectionColumnsPresent)
    {
        $db = \Yii::$app->db;
        $bookId = $this->materialTypeId('book');
        $this->insertSource(81390788, $bookId);
        $this->insertSource(400000, $this->materialTypeId('ebook'));
        $this->submissionUuid = $this->uuid();
        $this->submissionId = TestSubmissionFixture::create($this->submissionUuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 118-' . substr(str_replace('-', '', $this->submissionUuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . 'synthetic migration rows',
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $db->createCommand()->delete('submission_new_resources', ['submission_id' => $this->submissionId])->execute();

        $ids = [];
        $ids['uuid_digit'] = $this->insertNewRow(
            '81390788-f8c0-4000-8000-000000000118', $projectionColumnsPresent, null
        );
        $ids['uuid_exponent'] = $this->insertNewRow(
            '4e5a0000-0000-4000-8000-000000000118', $projectionColumnsPresent, null
        );
        $ids['numeric'] = $this->insertNewRow('81390788', $projectionColumnsPresent, null);
        $ids['null'] = $this->insertNewRow(null, $projectionColumnsPresent, null);
        $ids['uuid_existing'] = $this->insertNewRow(
            '81390788-f8c0-4000-8000-000000000119', $projectionColumnsPresent, null
        );

        $legacyNumeric = ['submission_id' => $this->submissionId, 'source_resource_id' => 81390788];
        $legacyNull = ['submission_id' => $this->submissionId, 'source_resource_id' => null];
        if ($projectionColumnsPresent) {
            $legacyNumeric['material_type_id'] = null;
            $legacyNumeric['source_snapshot_json'] = null;
            $legacyNull['material_type_id'] = null;
            $legacyNull['source_snapshot_json'] = null;
        }
        $db->createCommand()->insert('submission_reuse_resources', $legacyNumeric)->execute();
        $ids['reuse_numeric'] = (int)$db->getLastInsertID();
        $db->createCommand()->insert('submission_reuse_resources', $legacyNull)->execute();
        $ids['reuse_null'] = (int)$db->getLastInsertID();
        $this->itemIds = array_values($ids);
        return $ids;
    }

    private function insertNewRow($sourceId, $projectionColumnsPresent, $materialTypeId)
    {
        $values = [
            'submission_id' => $this->submissionId,
            'source_resource_id' => $sourceId,
            'material_type_id' => $materialTypeId,
            'is_reuse' => 0,
            'resource_data' => json_encode(['title' => 'Synthetic API-118 migration item']),
            'item_status' => 'pending',
        ];
        if ($projectionColumnsPresent) {
            $values['source_snapshot_json'] = null;
        }
        \Yii::$app->db->createCommand()->insert('submission_new_resources', $values)->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function addProjectionColumnsLikeAnInterruptedApply()
    {
        foreach ([
            'submission_new_resources' => [
                'staff_material_type_id' => 'INT NULL',
                'destination_class_choice' => 'VARCHAR(16) NULL',
                'source_folio_instance_id' => 'VARCHAR(255) NULL',
                'source_folio_holdings_id' => 'VARCHAR(255) NULL',
                'source_snapshot_json' => 'LONGTEXT NULL',
                'staff_corrections_json' => 'LONGTEXT NULL',
            ],
            'submission_reuse_resources' => [
                'material_type_id' => 'INT NULL',
                'staff_material_type_id' => 'INT NULL',
                'destination_class_choice' => 'VARCHAR(16) NULL',
                'source_folio_instance_id' => 'VARCHAR(255) NULL',
                'source_folio_holdings_id' => 'VARCHAR(255) NULL',
                'source_snapshot_json' => 'LONGTEXT NULL',
                'staff_corrections_json' => 'LONGTEXT NULL',
            ],
        ] as $table => $columns) {
            foreach ($columns as $name => $definition) {
                if (\Yii::$app->db->schema->getTableSchema($table, true)->getColumn($name) === null) {
                    MigrationRollback::addColumn($table, $name, $definition);
                    \Yii::$app->db->schema->refresh();
                }
            }
        }
        \Yii::$app->db->schema->refresh();
    }

    private function assertFreshMigrationRows(array $ids, array $excluded = [])
    {
        $db = \Yii::$app->db;
        foreach (array_diff(['uuid_digit', 'uuid_exponent', 'uuid_existing', 'null'], $excluded) as $key) {
            $row = $db->createCommand(
                'SELECT material_type_id, source_snapshot_json FROM submission_new_resources WHERE id = :id',
                [':id' => $ids[$key]]
            )->queryOne();
            Assert::assertNull($row['material_type_id'], $key . ' must not inherit a local source type.');
            Assert::assertNull($row['source_snapshot_json'], $key . ' must not freeze a local source.');
        }
        $numeric = $db->createCommand(
            'SELECT material_type_id, source_snapshot_json FROM submission_new_resources WHERE id = :id',
            [':id' => $ids['numeric']]
        )->queryOne();
        Assert::assertSame($this->materialTypeId('book'), (int)$numeric['material_type_id']);
        Assert::assertSame('Synthetic API-118 source 81390788', json_decode($numeric['source_snapshot_json'], true)['title']);

        $reuseNumeric = $db->createCommand(
            'SELECT material_type_id, source_snapshot_json FROM submission_reuse_resources WHERE id = :id',
            [':id' => $ids['reuse_numeric']]
        )->queryOne();
        Assert::assertSame($this->materialTypeId('book'), (int)$reuseNumeric['material_type_id']);
        Assert::assertSame('Synthetic API-118 source 81390788', json_decode($reuseNumeric['source_snapshot_json'], true)['title']);
        $reuseNull = $db->createCommand(
            'SELECT material_type_id, source_snapshot_json FROM submission_reuse_resources WHERE id = :id',
            [':id' => $ids['reuse_null']]
        )->queryOne();
        Assert::assertNull($reuseNull['material_type_id']);
        Assert::assertNull($reuseNull['source_snapshot_json']);
    }

    private function assertPartialRerunRows(array $ids)
    {
        $db = \Yii::$app->db;
        $uuid = $db->createCommand(
            'SELECT material_type_id, source_snapshot_json FROM submission_new_resources WHERE id = :id',
            [':id' => $ids['uuid_existing']]
        )->queryOne();
        Assert::assertSame($this->materialTypeId('article'), (int)$uuid['material_type_id']);
        Assert::assertNull($uuid['source_snapshot_json'], 'A snapshot on a noncanonical source row must be cleared.');
        $state = $db->createCommand(
            'SELECT state, draft_revision, published_revision, readiness_source, readiness_reason, '
            . 'readiness_revision, readiness_context_json, published_destination_json, published_snapshot '
            . 'FROM submission_publication_state '
            . 'WHERE item_kind = "new" AND item_id = :id', [':id' => $ids['uuid_existing']]
        )->queryOne();
        Assert::assertSame('ready', $state['state']);
        Assert::assertSame(17, (int)$state['draft_revision']);
        Assert::assertSame(12, (int)$state['published_revision']);
        Assert::assertSame('manual', $state['readiness_source']);
        Assert::assertSame('Synthetic preserved readiness', $state['readiness_reason']);
        Assert::assertSame(17, (int)$state['readiness_revision']);
        Assert::assertSame(
            ['synthetic' => 'preserved readiness context'], json_decode($state['readiness_context_json'], true)
        );
        Assert::assertSame(
            ['kind' => 'electronic', 'resource_id' => 118001],
            json_decode($state['published_destination_json'], true)
        );
        Assert::assertSame(
            'Synthetic live course title',
            json_decode($state['published_snapshot'], true)['resource']['name']
        );
        Assert::assertSame('Synthetic API-118 source 81390788', $db->createCommand(
            'SELECT name FROM resources WHERE resource_id = 81390788'
        )->queryScalar());
        $this->assertFreshMigrationRows($ids, ['uuid_existing']);
    }

    private function assertStoredSourceIdsRemainUnchanged(array $ids)
    {
        $db = \Yii::$app->db;
        $expected = [
            'uuid_digit' => '81390788-f8c0-4000-8000-000000000118',
            'uuid_exponent' => '4e5a0000-0000-4000-8000-000000000118',
            'numeric' => '81390788',
            'null' => null,
        ];
        foreach ($expected as $key => $sourceId) {
            $actual = $db->createCommand(
                'SELECT source_resource_id FROM submission_new_resources WHERE id = :id',
                [':id' => $ids[$key]]
            )->queryScalar();
            Assert::assertSame($sourceId, $actual, $key . ' stored source id must not be rewritten.');
        }
    }

    private function assertMigrationRecorded($version)
    {
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM migration WHERE version = :version', [':version' => $version]
        )->queryScalar());
    }

    private function migrateFullChainUp()
    {
        MigrationRollback::migrate('up');
        MigrationRollback::migrate('up');
        MigrationRollback::migrate('up');
    }

    private function insertSource($resourceId, $materialTypeId)
    {
        $db = \Yii::$app->db;
        Assert::assertSame(0, (int)$db->createCommand(
            'SELECT COUNT(*) FROM resources WHERE resource_id = :id', [':id' => $resourceId]
        )->queryScalar(), 'Migration fixture resource ids must be unused.');
        $db->createCommand()->insert('resources', [
            'resource_id' => $resourceId,
            'name' => 'Synthetic API-118 source ' . $resourceId,
            'item_url' => 'https://source.example.test/api118/' . $resourceId,
            'description' => 'Synthetic migration source description',
            'material_type_id' => $materialTypeId,
            'use_proxy' => 0,
        ])->execute();
        $this->resourceIds[] = $resourceId;
    }

    private function materialTypeId($name)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE LOWER(name) = :name LIMIT 1',
            [':name' => $name]
        )->queryScalar();
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
