<?php

use PHPUnit\Framework\Assert;

/** Verifies the workflow log schema, link columns, and legacy-state backfill. */
class Api080WorkflowLinkMigrationCest
{
    private $migrationVersion = 'm261016_000002_add_workflow_linking';
    private $facultyPrefix = 'test-api080-migration-';

    public function addsWorkflowLogAndBackfillsExistingLinkState(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        Assert::assertSame(1, (int)$db->createCommand(
            'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
            [':version' => $this->migrationVersion]
        )->queryScalar(), 'API-080 migration must be applied by test-stack setup.');

        MigrationRollback::withTargetDown($this->migrationVersion, function () use ($db) {
            try {
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

                MigrationRollback::migrate('up');
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

                MigrationRollback::migrate('down');
                MigrationRollback::migrate('up');
                $db->schema->refreshTableSchema('faculty_submissions');
            } finally {
                $db->createCommand()->delete('faculty_submissions', [
                    'like', 'shibboleth_user_id', $this->facultyPrefix . '%', false,
                ])->execute();
            }
        });
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
}
