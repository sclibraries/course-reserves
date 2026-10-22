<?php

use PHPUnit\Framework\Assert;

class Api074ProxyMigrationCest
{
    private $migrationVersion = 'm261015_000001_add_faculty_internal_id_to_proxy_permissions';

    public function addsNullableFacultyInternalIdAndRollsBackCleanly(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        Assert::assertSame(1, (int)$db->createCommand(
            'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
            [':version' => $this->migrationVersion]
        )->queryScalar(), 'API-074 migration must be applied by test-stack setup.');
        $this->assertColumn($db, true);

        MigrationRollback::withTargetDown($this->migrationVersion, function () use ($db) {
            $db->schema->refreshTableSchema('faculty_proxy_permissions');
            Assert::assertNull($db->schema->getTableSchema('faculty_proxy_permissions')->getColumn('faculty_internal_id'));

            MigrationRollback::migrate('up');
            $db->schema->refreshTableSchema('faculty_proxy_permissions');
            $this->assertColumn($db, true);
        });
    }

    private function assertColumn($db, $allowNull)
    {
        $column = $db->schema->getTableSchema('faculty_proxy_permissions')->getColumn('faculty_internal_id');
        Assert::assertNotNull($column);
        Assert::assertSame('string', $column->type);
        Assert::assertSame(255, $column->size);
        Assert::assertSame($allowNull, $column->allowNull);
    }
}
