<?php

use PHPUnit\Framework\Assert;

/** Verifies item claim columns, indexes, and legacy claim/event backfills. */
class Api082ItemClaimsMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261019_000001_add_item_claims';
    private $prefix = 'test-api082-migration-';

    public function addsClaimColumnsAndBackfillsLegacyClaimsAndEvents(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $migrationIsDown = false;
        $username = $this->prefix . 'staff';
        $uuid = '82000000-0000-4000-8000-000000000082';
        $submissionId = null;
        $itemId = null;
        $userId = null;

        try {
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM {{%migration}} WHERE [[version]] = :version',
                [':version' => $this->migrationVersion]
            )->queryScalar(), 'API-082 migration must be applied by test-stack setup.');

            $this->runMigration('down');
            $migrationIsDown = true;
            $db->schema->refreshTableSchema('submission_new_resources');
            $db->schema->refreshTableSchema('submission_reuse_resources');
            $db->schema->refreshTableSchema('workflow_events');
            Assert::assertNull($db->schema->getTableSchema('submission_new_resources')->getColumn('claimed_by'));
            Assert::assertNull($db->schema->getTableSchema('submission_new_resources')->getColumn('last_activity_at'));
            Assert::assertNull($db->schema->getTableSchema('submission_reuse_resources')->getColumn('claimed_at'));
            Assert::assertNull($db->schema->getTableSchema('workflow_events')->getColumn('item_kind'));

            $db->createCommand()->insert('users', [
                'username' => $username,
                'full_name' => 'Synthetic API-082 migration staff',
                'email' => $username . '@example.test',
                'role' => 'staff',
                'institution' => 'SM',
                'approved' => 1,
            ])->execute();
            $userId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('faculty_submissions', [
                'submission_uuid' => $uuid,
                'shibboleth_user_id' => $this->prefix . 'faculty',
                'term_code' => 'Fall 2027',
                'course_code' => 'TST 082M',
                'section' => '01',
                'course_title' => $this->prefix . 'submission',
                'status' => 'submitted',
            ])->execute();
            $submissionId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('submission_new_resources', [
                'submission_id' => $submissionId,
                'resource_data' => '{"title":"Synthetic migration material"}',
                'claimed_by_staff_id' => (string)$userId,
                'claimed_at' => '2026-10-18 12:00:00',
            ])->execute();
            $itemId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('workflow_events', [
                'submission_id' => $submissionId,
                'item_id' => $itemId,
                'actor_username' => $username,
                'actor_role' => 'staff',
                'event_type' => 'claimed',
            ])->execute();

            $this->runMigration('up');
            $migrationIsDown = false;
            $db->schema->refreshTableSchema('submission_new_resources');
            $db->schema->refreshTableSchema('submission_reuse_resources');
            $db->schema->refreshTableSchema('workflow_events');

            foreach (['claimed_by', 'claimed_at', 'last_activity_at', 'assigned_group_id'] as $column) {
                Assert::assertNotNull($db->schema->getTableSchema('submission_new_resources')->getColumn($column));
                Assert::assertNotNull($db->schema->getTableSchema('submission_reuse_resources')->getColumn($column));
            }
            Assert::assertNotNull($db->schema->getTableSchema('workflow_events')->getColumn('item_kind'));

            $newItem = $db->createCommand(
                'SELECT claimed_by_staff_id, claimed_by, claimed_at, last_activity_at FROM submission_new_resources WHERE id = :id',
                [':id' => $itemId]
            )->queryOne();
            Assert::assertSame((string)$userId, $newItem['claimed_by_staff_id']);
            Assert::assertSame($username, $newItem['claimed_by']);
            Assert::assertSame('2026-10-18 12:00:00', $newItem['last_activity_at']);
            $eventKind = $db->createCommand(
                'SELECT item_kind FROM workflow_events WHERE submission_id = :submission_id AND item_id = :item_id',
                [':submission_id' => $submissionId, ':item_id' => $itemId]
            )->queryScalar();
            Assert::assertSame('new', $eventKind, 'The matching submission_new_resources row identifies legacy item events as new.');

            $indexes = $db->createCommand('SHOW INDEX FROM submission_new_resources')->queryAll();
            $indexedColumns = array_column($indexes, 'Column_name');
            Assert::assertContains('claimed_by', $indexedColumns);
            Assert::assertContains('last_activity_at', $indexedColumns);
            Assert::assertContains('assigned_group_id', $indexedColumns);
        } finally {
            if ($migrationIsDown) {
                $this->runMigration('up');
                $db->schema->refreshTableSchema('submission_new_resources');
                $db->schema->refreshTableSchema('submission_reuse_resources');
                $db->schema->refreshTableSchema('workflow_events');
            }
            if ($submissionId) {
                $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionId])->execute();
                $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionId])->execute();
            }
            if ($userId) {
                $db->createCommand()->delete('users', ['id' => $userId])->execute();
            }
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
    }
}
