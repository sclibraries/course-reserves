<?php

use PHPUnit\Framework\Assert;

class Api074ProxyMigrationCest
{
    private $api082MigrationVersion = 'm261019_000001_add_item_claims';
    private $api083MigrationVersion = 'm261019_000002_add_staff_groups';
    private $api084MigrationVersion = 'm261019_000003_add_staff_workflow_flows';
    private $api086MigrationVersion = 'm261020_000001_add_submission_draft_version';
    private $api094MigrationVersion = 'm261022_000001_create_submission_syllabi';
    private $api079MigrationVersion = 'm261016_000001_add_roster_course_to_faculty_submissions';
    private $api080MigrationVersion = 'm261016_000002_add_workflow_linking';
    private $migrationVersion = 'm261015_000001_add_faculty_internal_id_to_proxy_permissions';

    public function addsNullableFacultyInternalIdAndRollsBackCleanly(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $migrationIsDown = false;
        $api079MigrationIsDown = false;
        $api080MigrationIsDown = false;
        $api081MigrationIsDown = false;
        $api082MigrationIsDown = false;
        $api083MigrationIsDown = false;
        $api084MigrationIsDown = false;
        $api086MigrationIsDown = false;
        $api094MigrationIsDown = false;

        try {
            $api082Applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api082MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api082Applied, 'API-082 migration must be applied by test-stack setup.');
            $api083Applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api083MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api083Applied, 'API-083 migration must be applied by test-stack setup.');
            $api084Applied = (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api084MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api084Applied, 'API-084 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api086MigrationVersion]
            )->queryScalar(), 'API-086 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api094MigrationVersion]
            )->queryScalar(), 'API-094 migration must be applied by test-stack setup.');
            $api079Applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api079MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api079Applied, 'API-079 migration must be applied by test-stack setup.');
            $api080Applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api080MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api080Applied, 'API-080 migration must be applied by test-stack setup.');

            $applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $applied, 'API-074 migration must be applied by test-stack setup.');
            $this->assertColumn($db, true);

            $this->runMigration('down');
            $api094MigrationIsDown = true;
            $this->runMigration('down');
            $api086MigrationIsDown = true;
            $this->runMigration('down');
            $api084MigrationIsDown = true;
            $this->runMigration('down');
            $api083MigrationIsDown = true;
            $this->runMigration('down');
            $api082MigrationIsDown = true;
            $this->runMigration('down');
            $api081MigrationIsDown = true;
            $this->runMigration('down');
            $api080MigrationIsDown = true;
            $this->runMigration('down');
            $api079MigrationIsDown = true;
            $this->runMigration('down');
            $migrationIsDown = true;
            $db->schema->refreshTableSchema('faculty_proxy_permissions');
            Assert::assertNull($db->schema->getTableSchema('faculty_proxy_permissions')->getColumn('faculty_internal_id'));

            $this->runMigration('up');
            $migrationIsDown = false;
            $this->runMigration('up');
            $api079MigrationIsDown = false;
            $this->runMigration('up');
            $api080MigrationIsDown = false;
            $this->runMigration('up');
            $api081MigrationIsDown = false;
            $this->runMigration('up');
            $api082MigrationIsDown = false;
            $this->runMigration('up');
            $api083MigrationIsDown = false;
            $this->runMigration('up');
            $api084MigrationIsDown = false;
            $this->runMigration('up');
            $api086MigrationIsDown = false;
            $this->runMigration('up');
            $api094MigrationIsDown = false;
            $db->schema->refreshTableSchema('faculty_proxy_permissions');
            $this->assertColumn($db, true);
        } finally {
            if ($migrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_proxy_permissions');
            }
            if ($api079MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api080MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api081MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api082MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api083MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api084MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api086MigrationIsDown) {
                $this->runMigration('up');
            }
            if ($api094MigrationIsDown) {
                $this->runMigration('up');
            }
        }
    }

    private function assertColumn($db, $allowNull)
    {
        $column = $db->schema->getTableSchema('faculty_proxy_permissions')->getColumn('faculty_internal_id');
        Assert::assertNotNull($column);
        Assert::assertSame('string', $column->type);
        Assert::assertSame(255, $column->size);
        Assert::assertSame($allowNull, $column->allowNull);
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

        $output = [];
        $exitCode = 0;
        exec('cd /app && php yii migrate/' . $direction . ' 1 --interactive=0 2>&1', $output, $exitCode);
        Assert::assertSame(0, $exitCode, implode("\n", $output));
    }
}
