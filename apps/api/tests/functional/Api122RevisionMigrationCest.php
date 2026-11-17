<?php

use PHPUnit\Framework\Assert;

class Api122RevisionMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261117_000001_add_workflow_revisions';
    private $prefix = 'test-api122-revision-migration-';
    private $uuid;
    private $submissionId;
    private $itemId;
    private $flowId;
    private $runId;

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        if ($this->runId) {
            $db->createCommand()->delete('item_flow_runs', ['id' => $this->runId])->execute();
        }
        if ($this->itemId && $this->submissionId) {
            $db->createCommand()->delete('submission_publication_state', [
                'item_kind' => 'new', 'item_id' => $this->itemId,
            ])->execute();
        }
        if ($this->uuid) {
            TestSubmissionFixture::delete($this->uuid);
        }
        if ($this->flowId) {
            $db->createCommand()->delete('flow_versions', ['flow_id' => $this->flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $this->flowId])->execute();
        }
    }

    public function testBackfillIsPartialRunSafeAndUsesEachRowsOwnDraftRevision(FunctionalTester $I)
    {
        Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM migration WHERE version = :version', [':version' => $this->migrationVersion]
        )->queryScalar());

        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $this->createRows();

            // A failed first run may have added only the state column.
            MigrationRollback::addColumn('submission_publication_state', 'workflow_revision', 'INT UNSIGNED NULL');
            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertRevisions(17, 23);

            // A rerun after display edits must leave the workflow revisions behind the draft revisions.
            $db->createCommand()->update('submission_publication_state', ['draft_revision' => 18], [
                'item_kind' => 'new', 'item_id' => $this->itemId,
            ])->execute();
            $db->createCommand()->update('item_flow_runs', ['draft_revision' => 24], ['id' => $this->runId])->execute();
            $db->createCommand()->delete('migration', ['version' => $this->migrationVersion])->execute();
            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertRevisions(17, 23);

            $newStateId = $this->itemId + 1000000;
            $db->createCommand()->insert('submission_publication_state', [
                'item_kind' => 'new', 'item_id' => $newStateId, 'submission_id' => $this->submissionId,
            ])->execute();
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT workflow_revision FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
                [':id' => $newStateId]
            )->queryScalar());
            $db->createCommand()->delete('submission_publication_state', [
                'item_kind' => 'new', 'item_id' => $newStateId,
            ])->execute();
            $db->createCommand()->insert('item_flow_runs', [
                'item_kind' => 'new', 'item_id' => $this->itemId, 'flow_id' => $this->flowId,
                'version' => 1, 'current_step_key' => 'synthetic-default', 'draft_revision' => 11,
            ])->execute();
            $defaultRunId = (int)$db->getLastInsertID();
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT workflow_revision FROM item_flow_runs WHERE id = :id', [':id' => $defaultRunId]
            )->queryScalar());
            $db->createCommand()->delete('item_flow_runs', ['id' => $defaultRunId])->execute();

            MigrationRollback::migrate('down');
            $db->schema->refresh();
            Assert::assertArrayNotHasKey(
                'workflow_revision', $db->schema->getTableSchema('submission_publication_state', true)->columns
            );
            Assert::assertArrayNotHasKey('workflow_revision', $db->schema->getTableSchema('item_flow_runs', true)->columns);
            Assert::assertArrayHasKey('draft_revision', $db->schema->getTableSchema('submission_publication_state', true)->columns);
            Assert::assertArrayHasKey('draft_revision', $db->schema->getTableSchema('item_flow_runs', true)->columns);

            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertRevisions(18, 24);
        });
    }

    private function createRows()
    {
        $this->uuid = $this->uuid();
        $this->submissionId = TestSubmissionFixture::create($this->uuid, $this->prefix . 'faculty', [
            'course_title' => $this->prefix . 'synthetic submission',
            'submitted_at' => '2026-11-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $db = \Yii::$app->db;
        $this->itemId = (int)$db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $this->submissionId]
        )->queryScalar();
        $db->createCommand()->insert('submission_publication_state', [
            'item_kind' => 'new', 'item_id' => $this->itemId, 'submission_id' => $this->submissionId,
            'draft_revision' => 17,
        ])->execute();
        $db->createCommand()->insert('flows', [
            'name' => $this->prefix . 'flow', 'created_by' => $this->prefix . 'staff',
        ])->execute();
        $this->flowId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $this->flowId, 'version' => 1, 'steps_json' => '[]',
            'created_by' => $this->prefix . 'staff',
        ])->execute();
        $db->createCommand()->insert('item_flow_runs', [
            'item_kind' => 'new', 'item_id' => $this->itemId, 'flow_id' => $this->flowId,
            'version' => 1, 'current_step_key' => 'synthetic', 'draft_revision' => 23,
        ])->execute();
        $this->runId = (int)$db->getLastInsertID();
    }

    private function assertRevisions($stateRevision, $runRevision)
    {
        $db = \Yii::$app->db;
        Assert::assertSame($stateRevision, (int)$db->createCommand(
            'SELECT workflow_revision FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
            [':id' => $this->itemId]
        )->queryScalar());
        Assert::assertSame($runRevision, (int)$db->createCommand(
            'SELECT workflow_revision FROM item_flow_runs WHERE id = :id', [':id' => $this->runId]
        )->queryScalar());
    }

    private function uuid()
    {
        $hex = bin2hex(random_bytes(16));
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3)
            . '-a' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
    }
}
