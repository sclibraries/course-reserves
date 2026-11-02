<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationMigrationSchemaCest extends Api116ADestinationMigrationTestBase
{
    public function testFreshMigrationCreatesInnoDbTablesColumnsIndexesAndForeignKeys(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            Assert::assertNull($db->schema->getTableSchema('publication_destinations', true));
            Assert::assertNull($db->schema->getTableSchema('publication_attachments', true));

            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertRegistrySchema();
            $destinations = $db->schema->getTableSchema('publication_destinations', true)->columns;
            $attachments = $db->schema->getTableSchema('publication_attachments', true)->columns;
            Assert::assertTrue($destinations['owner_live']->allowNull);
            Assert::assertTrue($attachments['live']->allowNull);
            Assert::assertSame(
                "enum('electronic','physical')",
                strtolower($destinations['destination_kind']->dbType)
            );
        });
    }

    public function testExplicitMigrationChainRunsThroughApi116AAfterApi118Steps(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown('m261029_000003_add_publication_input_projection', function () {
            foreach ([
                'm261029_000003_add_publication_input_projection',
                'm261030_000001_add_physical_reference_identity',
                'm261030_000002_add_destination_fields_and_copy_inputs',
                $this->migrationVersion,
            ] as $version) {
                MigrationRollback::migrate('up');
                Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
                    'SELECT COUNT(*) FROM migration WHERE version = :version', [':version' => $version]
                )->queryScalar(), 'Migration chain records ' . $version . '.');
            }
            \Yii::$app->db->schema->refresh();
            $this->assertRegistrySchema();
        });
    }
}
