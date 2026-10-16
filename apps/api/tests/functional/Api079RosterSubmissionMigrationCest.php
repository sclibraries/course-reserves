<?php

use PHPUnit\Framework\Assert;

/**
 * Verifies the roster identity migration and nullable legacy rows.
 */
class Api079RosterSubmissionMigrationCest
{
    private $migrationVersion = 'm261016_000001_add_roster_course_to_faculty_submissions';
    private $api080MigrationVersion = 'm261016_000002_add_workflow_linking';
    private $facultyId = 'test-api079-migration-faculty';

    public function addsNullableRosterCourseColumnsAndRollsBackCleanly(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $migrationIsDown = false;
        $api080MigrationIsDown = false;
        try {
            Assert::assertSame(1, (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar(), 'API-079 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api080MigrationVersion]
            )->queryScalar(), 'API-080 migration must be applied by test-stack setup.');

            $this->runMigration('down');
            $api080MigrationIsDown = true;
            $this->runMigration('down');
            $migrationIsDown = true;
            $db->schema->refreshTableSchema('faculty_submissions');
            Assert::assertNull($db->schema->getTableSchema('faculty_submissions')->getColumn('its_course_id'));
            Assert::assertNull($db->schema->getTableSchema('faculty_submissions')->getColumn('academic_period'));
            Assert::assertNull($db->schema->getTableSchema('faculty_submissions')->getColumn('roster_term_id'));

            $db->createCommand()->insert('faculty_submissions', [
                'shibboleth_user_id' => $this->facultyId,
                'term_code' => 'Legacy Term',
                'course_code' => 'LEGACY 079',
                'section' => '01',
                'course_title' => 'Synthetic legacy API079 migration row',
                'status' => 'submitted',
            ])->execute();

            $this->runMigration('up');
            $migrationIsDown = false;
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

            $migrationIsDown = true;
            $this->runMigration('down');
            $db->schema->refreshTableSchema('faculty_submissions');
            $schema = $db->schema->getTableSchema('faculty_submissions');
            Assert::assertNull($schema->getColumn('its_course_id'));
            Assert::assertNull($schema->getColumn('academic_period'));
            Assert::assertNull($schema->getColumn('roster_term_id'));
            $migrationIsDown = false;
            $this->runMigration('up');
            $this->runMigration('up');
            $api080MigrationIsDown = false;
            $db->schema->refreshTableSchema('faculty_submissions');
        } finally {
            if ($migrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            if ($api080MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            $db->createCommand()->delete('faculty_submissions', [
                'shibboleth_user_id' => $this->facultyId,
            ])->execute();
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

        $output = [];
        $exitCode = 0;
        exec('cd /app && php yii migrate/' . $direction . ' 1 --interactive=0 2>&1', $output, $exitCode);
        Assert::assertSame(0, $exitCode, implode("\n", $output));
        return implode("\n", $output);
    }
}
