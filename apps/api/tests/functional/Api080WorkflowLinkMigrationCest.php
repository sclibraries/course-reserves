<?php

use PHPUnit\Framework\Assert;

/** Verifies the workflow log schema, link columns, and legacy-state backfill. */
class Api080WorkflowLinkMigrationCest
{
    private $migrationVersion = 'm261016_000002_add_workflow_linking';
    private $api082MigrationVersion = 'm261019_000001_add_item_claims';
    private $api083MigrationVersion = 'm261019_000002_add_staff_groups';
    private $api084MigrationVersion = 'm261019_000003_add_staff_workflow_flows';
    private $api086MigrationVersion = 'm261020_000001_add_submission_draft_version';
    private $facultyPrefix = 'test-api080-migration-';

    public function addsWorkflowLogAndBackfillsExistingLinkState(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $migrationIsDown = false;
        $api081MigrationIsDown = false;
        $api082MigrationIsDown = false;
        $api083MigrationIsDown = false;
        $api084MigrationIsDown = false;
        $api086MigrationIsDown = false;
        try {
            Assert::assertSame(1, (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api083MigrationVersion]
            )->queryScalar(), 'API-083 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api084MigrationVersion]
            )->queryScalar(), 'API-084 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api086MigrationVersion]
            )->queryScalar(), 'API-086 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->api082MigrationVersion]
            )->queryScalar(), 'API-082 migration must be applied by test-stack setup.');
            Assert::assertSame(1, (int) $db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar(), 'API-080 migration must be applied by test-stack setup.');

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
            $migrationIsDown = true;
            $db->schema->refreshTableSchema('faculty_submissions');
            Assert::assertNull($db->schema->getTableSchema('faculty_submissions')->getColumn('link_state'));
            Assert::assertNull($db->schema->getTableSchema('workflow_events'));

            $db->createCommand()->insert('faculty_submissions', [
                'shibboleth_user_id' => $this->facultyPrefix . 'linked',
                'term_code' => 'Migration Term',
                'course_code' => 'TST 080',
                'section' => '01',
                'course_title' => $this->facultyPrefix . 'linked',
                'folio_course_listing_id' => 'test-api080-migration-listing',
                'status' => 'submitted',
            ])->execute();
            $db->createCommand()->insert('faculty_submissions', [
                'shibboleth_user_id' => $this->facultyPrefix . 'unlinked',
                'term_code' => 'Migration Term',
                'course_code' => 'TST 081',
                'section' => '01',
                'course_title' => $this->facultyPrefix . 'unlinked',
                'status' => 'submitted',
            ])->execute();

            $this->runMigration('up');
            $migrationIsDown = false;
            $db->schema->refreshTableSchema('faculty_submissions');
            $this->assertColumn($db, 'link_state', 'string', 32, false);
            $this->assertColumn($db, 'link_flag', 'string', 32, true);
            $this->assertColumn($db, 'linked_at', 'datetime', null, true);
            $this->assertColumn($db, 'linked_by', 'string', 255, true);
            $this->assertEventColumnsAndIndexes($db);

            $rows = $db->createCommand(
                'SELECT course_title, link_state FROM faculty_submissions WHERE shibboleth_user_id LIKE :prefix ORDER BY course_title',
                [':prefix' => $this->facultyPrefix . '%']
            )->queryAll();
            Assert::assertSame([
                ['course_title' => $this->facultyPrefix . 'linked', 'link_state' => 'linked'],
                ['course_title' => $this->facultyPrefix . 'unlinked', 'link_state' => 'needs_linking'],
            ], $rows);

            $migrationIsDown = true;
            $this->runMigration('down');
            $migrationIsDown = false;
            $this->runMigration('up');
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
            $db->schema->refreshTableSchema('faculty_submissions');
        } finally {
            if ($migrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            if ($api081MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            if ($api082MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            if ($api083MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            if ($api084MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('workflow_events');
            }
            if ($api086MigrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            }
            $db->createCommand()->delete('faculty_submissions', [
                'like', 'shibboleth_user_id', $this->facultyPrefix . '%', false,
            ])->execute();
        }
    }

    private function assertColumn($db, $name, $type, $size, $allowNull)
    {
        $column = $db->schema->getTableSchema('faculty_submissions')->getColumn($name);
        Assert::assertNotNull($column, 'Missing column ' . $name);
        Assert::assertSame($type, $column->type);
        if ($size !== null) {
            Assert::assertSame($size, $column->size);
        }
        Assert::assertSame($allowNull, $column->allowNull);
    }

    private function assertEventColumnsAndIndexes($db)
    {
        $table = $db->schema->getTableSchema('workflow_events');
        foreach ([
            'submission_id', 'item_id', 'actor_username', 'actor_role', 'event_type',
            'reason', 'before_json', 'after_json', 'created_at',
        ] as $column) {
            Assert::assertNotNull($table->getColumn($column), 'Missing workflow_events.' . $column);
        }
        $indexes = $db->createCommand('SHOW INDEX FROM workflow_events')->queryAll();
        Assert::assertContains('submission_id', array_column($indexes, 'Column_name'));
        Assert::assertContains('item_id', array_column($indexes, 'Column_name'));
        Assert::assertContains('created_at', array_column($indexes, 'Column_name'));
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
