<?php

use PHPUnit\Framework\Assert;

class Api074ProxyMigrationCest
{
    private $api079MigrationVersion = 'm261016_000001_add_roster_course_to_faculty_submissions';
    private $migrationVersion = 'm261015_000001_add_faculty_internal_id_to_proxy_permissions';

    public function addsNullableFacultyInternalIdAndRollsBackCleanly(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $migrationIsDown = false;
        $api079MigrationIsDown = false;

        try {
            $api079Applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api079MigrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $api079Applied, 'API-079 migration must be applied by test-stack setup.');

            $applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $applied, 'API-074 migration must be applied by test-stack setup.');
            $this->assertColumn($db, true);

            $this->runMigration('down');
            $api079MigrationIsDown = true;
            $migrationIsDown = true;
            $this->runMigration('down');
            $db->schema->refreshTableSchema('faculty_proxy_permissions');
            Assert::assertNull($db->schema->getTableSchema('faculty_proxy_permissions')->getColumn('faculty_internal_id'));

            $this->runMigration('up');
            $migrationIsDown = false;
            $this->runMigration('up');
            $api079MigrationIsDown = false;
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
