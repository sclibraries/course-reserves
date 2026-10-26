<?php

use PHPUnit\Framework\Assert;

/** Verifies API-096 access-path columns and mapping table roll back and reapply. */
class Api096AccessPathMigrationCest extends BaseFunctionalCest
{
    const VERSION = 'm261026_000002_add_access_paths_to_submission_items';

    public function addsNullableColumnsAndRecreatesTheMappingTable(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown(self::VERSION, function () {
            $this->assertSchema(false);
            MigrationRollback::migrate('up');
            $this->assertSchema(true);

            MigrationRollback::migrate('down');
            $this->assertSchema(false);
            MigrationRollback::migrate('up');
            $this->assertSchema(true);
        });
    }

    private function assertSchema($present)
    {
        $db = \Yii::$app->db;
        $db->schema->refresh();
        foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
            $columns = $db->getTableSchema($table, true)->columns;
            Assert::assertSame($present, isset($columns['access_path']));
            if ($present) {
                Assert::assertTrue($columns['access_path']->allowNull);
            }
        }
        Assert::assertSame($present, $db->getTableSchema('access_path_flows', true) !== null);
    }
}
