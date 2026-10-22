<?php

use PHPUnit\Framework\Assert;

/** Verifies group schema, assigned-group foreign keys, and non-seeding migration behavior. */
class Api083StaffGroupsMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261019_000002_add_staff_groups';

    public function createsGroupSchemaWithoutSeedingAcquisitions(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        Assert::assertSame(1, (int)$db->createCommand(
            'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
            [':version' => $this->migrationVersion]
        )->queryScalar());

        MigrationRollback::withTargetDown($this->migrationVersion, function () use ($db) {
            $db->schema->refresh();
            Assert::assertNull($db->schema->getTableSchema('staff_groups', true));
            Assert::assertNull($db->schema->getTableSchema('staff_group_members', true));

            MigrationRollback::migrate('up');
            $db->schema->refresh();
            Assert::assertNotNull($db->schema->getTableSchema('staff_groups', true));
            Assert::assertNotNull($db->schema->getTableSchema('staff_group_members', true));
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM staff_groups WHERE name = :name',
                [':name' => 'Acquisitions']
            )->queryScalar());

            foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
                $foreignKeys = $db->createCommand(
                    'SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE '
                    . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table '
                    . 'AND COLUMN_NAME = "assigned_group_id" AND REFERENCED_TABLE_NAME = "staff_groups"',
                    [':table' => $table]
                )->queryScalar();
                Assert::assertSame(1, (int)$foreignKeys, $table . ' must reference staff_groups.');
            }
            $indexes = $db->createCommand('SHOW INDEX FROM staff_group_members')->queryAll();
            $uniqueIndexes = [];
            foreach ($indexes as $index) {
                if ((int)$index['Non_unique'] === 0) {
                    $uniqueIndexes[$index['Key_name']] = true;
                }
            }
            Assert::assertNotEmpty($uniqueIndexes, 'Group membership must be unique.');
        });
    }
}
