<?php

use PHPUnit\Framework\Assert;

/** Verifies group schema, assigned-group foreign keys, and non-seeding migration behavior. */
class Api083StaffGroupsMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261019_000002_add_staff_groups';
    private $api084MigrationVersion = 'm261019_000003_add_staff_workflow_flows';
    private $api086MigrationVersion = 'm261020_000001_add_submission_draft_version';
    private $api094MigrationVersion = 'm261022_000001_create_submission_syllabi';

    public function createsGroupSchemaWithoutSeedingAcquisitions(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $migrationIsDown = false;
        $api084MigrationIsDown = false;
        $api086MigrationIsDown = false;
        $api094MigrationIsDown = false;
        try {
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar());

            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api084MigrationVersion]
            )->queryScalar(), 'API-084 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api086MigrationVersion]
            )->queryScalar(), 'API-086 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api094MigrationVersion]
            )->queryScalar(), 'API-094 migration must be applied by test-stack setup.');

            $this->runMigration('down');
            $api094MigrationIsDown = true;
            $this->runMigration('down');
            $api086MigrationIsDown = true;
            $this->runMigration('down');
            $api084MigrationIsDown = true;
            $this->runMigration('down');
            $migrationIsDown = true;
            $db->schema->refresh();
            Assert::assertNull($db->schema->getTableSchema('staff_groups', true));
            Assert::assertNull($db->schema->getTableSchema('staff_group_members', true));

            $this->runMigration('up');
            $migrationIsDown = false;
            $this->runMigration('up');
            $api084MigrationIsDown = false;
            $this->runMigration('up');
            $api086MigrationIsDown = false;
            $this->runMigration('up');
            $api094MigrationIsDown = false;
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
        } finally {
            if ($migrationIsDown) {
                $this->runMigration('up');
                $db->schema->refresh();
            }
            if ($api084MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refresh();
            }
            if ($api086MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            if ($api094MigrationIsDown) {
                $this->runMigration('up');
            }
        }
    }

    private function runMigration($direction)
    {
        $db = \Yii::$app->db;
        if ($db->isActive) {
            $transaction = $db->getTransaction();
            if ($transaction !== null && $transaction->isActive) {
                $transaction->commit();
            }
            $db->close();
        }
        $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(codecept_root_dir('yii'))
            . ' migrate/' . $direction . ' 1 --interactive=0 2>&1';
        exec($command, $output, $status);
        Assert::assertSame(0, $status, implode("\n", $output));
    }
}
