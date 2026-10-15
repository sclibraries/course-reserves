<?php

use PHPUnit\Framework\Assert;

class Api074ProxyMigrationCest
{
    private $migrationVersion = 'm261015_000001_add_faculty_internal_id_to_proxy_permissions';

    public function addsNullableFacultyInternalIdAndRollsBackCleanly(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $migrationIsDown = false;

        try {
            $applied = (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar();
            Assert::assertSame(1, $applied, 'API-074 migration must be applied by test-stack setup.');
            $this->assertColumn($db, true);

            $migrationIsDown = true;
            $this->runMigration('down');
            $db->schema->refreshTableSchema('faculty_proxy_permissions');
            Assert::assertNull($db->schema->getTableSchema('faculty_proxy_permissions')->getColumn('faculty_internal_id'));

            $this->runMigration('up');
            $migrationIsDown = false;
            $db->schema->refreshTableSchema('faculty_proxy_permissions');
            $this->assertColumn($db, true);
        } finally {
            if ($migrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_proxy_permissions');
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
