<?php

use PHPUnit\Framework\Assert;

/** Verifies the roster identity migration and nullable legacy rows. */
class Api079RosterSubmissionMigrationCest
{
    private $migrationVersion = 'm261016_000001_add_roster_course_to_faculty_submissions';
    private $facultyId = 'test-api079-migration-faculty';

    public function addsNullableRosterCourseColumnsAndRollsBackCleanly(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        Assert::assertSame(1, (int)$db->createCommand(
            'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
            [':version' => $this->migrationVersion]
        )->queryScalar(), 'API-079 migration must be applied by test-stack setup.');

        MigrationRollback::withTargetDown($this->migrationVersion, function () use ($db) {
            try {
                $db->schema->refreshTableSchema('faculty_submissions');
                $schema = $db->schema->getTableSchema('faculty_submissions');
                Assert::assertNull($schema->getColumn('its_course_id'));
                Assert::assertNull($schema->getColumn('academic_period'));
                Assert::assertNull($schema->getColumn('roster_term_id'));

                $db->createCommand()->insert('faculty_submissions', [
                    'shibboleth_user_id' => $this->facultyId,
                    'term_code' => 'Legacy Term',
                    'course_code' => 'LEGACY 079',
                    'section' => '01',
                    'course_title' => 'Synthetic legacy API079 migration row',
                    'status' => 'submitted',
                ])->execute();

                MigrationRollback::migrate('up');
                $db->schema->refreshTableSchema('faculty_submissions');
                $columns = $db->schema->getTableSchema('faculty_submissions')->columns;
                Assert::assertSame(64, $columns['its_course_id']->size);
                Assert::assertSame(16, $columns['academic_period']->size);
                Assert::assertSame(64, $columns['roster_term_id']->size);
                $legacyRow = $db->createCommand(
                    'SELECT * FROM faculty_submissions WHERE shibboleth_user_id = :faculty_id',
                    [':faculty_id' => $this->facultyId]
                )->queryOne();
                Assert::assertNull($legacyRow['its_course_id']);
                Assert::assertNull($legacyRow['academic_period']);
                Assert::assertNull($legacyRow['roster_term_id']);

                $indexRows = $db->createCommand(
                    "SHOW INDEX FROM faculty_submissions WHERE Key_name = 'idx_faculty_submissions_roster_course'"
                )->queryAll();
                Assert::assertSame(
                    ['shibboleth_user_id', 'its_course_id'],
                    array_column($indexRows, 'Column_name'),
                    'Migration must add the owner and ITS course index.'
                );

                MigrationRollback::migrate('down');
                $db->schema->refreshTableSchema('faculty_submissions');
                $schema = $db->schema->getTableSchema('faculty_submissions');
                Assert::assertNull($schema->getColumn('its_course_id'));
                Assert::assertNull($schema->getColumn('academic_period'));
                Assert::assertNull($schema->getColumn('roster_term_id'));
                MigrationRollback::migrate('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            } finally {
                $db->createCommand()->delete('faculty_submissions', [
                    'shibboleth_user_id' => $this->facultyId,
                ])->execute();
            }
        });
    }
}
