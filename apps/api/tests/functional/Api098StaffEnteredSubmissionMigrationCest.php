<?php

use PHPUnit\Framework\Assert;

/** Verifies API-098 entry metadata migration rollback and reapplication. */
class Api098StaffEnteredSubmissionMigrationCest extends BaseFunctionalCest
{
    const VERSION = 'm261026_000001_add_staff_entered_submission_metadata';

    public function addsNullableEntryMetadataAndRollsBackCleanly(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown(self::VERSION, function () {
            $this->assertColumns(false);
            MigrationRollback::migrate('up');
            $this->assertColumns(true);

            MigrationRollback::migrate('down');
            $this->assertColumns(false);
            MigrationRollback::migrate('up');
            $this->assertColumns(true);
        });
    }

    private function assertColumns($present)
    {
        \Yii::$app->db->schema->refresh();
        $columns = \Yii::$app->db->getTableSchema('faculty_submissions', true)->columns;
        foreach (['entered_by', 'entry_source'] as $name) {
            Assert::assertSame($present, isset($columns[$name]), $name . ' column presence');
            if ($present) {
                Assert::assertTrue($columns[$name]->allowNull, $name . ' must be nullable');
            }
        }
    }
}
