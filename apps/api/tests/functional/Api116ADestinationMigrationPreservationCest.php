<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationMigrationPreservationCest extends Api116ADestinationMigrationTestBase
{
    public function testBackfillPreservesPublicationStateRevisionsReadinessRunsAndFrozenInputs(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $offering = $this->fixtures->createOffering('preserve');
            $item = $this->fixtures->createItem('preserve-item', $offering);
            $destination = $this->fixtures->createElectronicDestination($offering, 'preserve-live');
            $frozenInputs = json_encode([
                'version' => 1,
                'title' => 'Synthetic API-116A frozen source title',
                'eds' => ['an' => 'Synthetic frozen identity evidence'],
            ], JSON_UNESCAPED_SLASHES);
            $this->fixtures->setMarkers($item, [
                'materialized_resource_id' => $destination['resource_id'],
                'materialized_course_resource_id' => $destination['course_resource_id'],
                'materialized_at' => '2026-10-02 10:11:12',
                'materialized_by_staff_id' => 'synthetic-api116a-publisher',
                'source_snapshot_json' => $frozenInputs,
                'updated_at' => '2026-10-02 10:11:13',
            ]);
            $runId = $this->fixtures->createFinishedRun($item, 'preserve');
            $db->createCommand()->insert('submission_publication_state', [
                'item_kind' => $item['kind'],
                'item_id' => $item['id'],
                'submission_id' => $item['submission_id'],
                'state' => 'published_with_pending_edits',
                'draft_revision' => 37,
                'published_revision' => 31,
                'pending_changes' => 'pending',
                'readiness_source' => 'flow',
                'readiness_reason' => 'Synthetic preserved run reason',
                'readiness_revision' => 37,
                'readiness_context_json' => '{"finish_state":"available_online","preserve":"yes"}',
                'readiness_run_id' => $runId,
                'published_by_staff_id' => 'synthetic-api116a-publisher',
                'published_at' => '2026-10-02 10:11:14',
                'published_destination_json' => '{"kind":"electronic","resource_id":116001}',
                'published_snapshot' => '{"resource":{"name":"Synthetic prior publication"}}',
                'reconciliation_status' => 'verified',
                'reconciliation_reason' => 'Synthetic pre-existing reconciliation',
                'created_at' => '2026-10-02 10:11:15',
                'updated_at' => '2026-10-02 10:11:16',
            ])->execute();

            $beforeState = $this->stateRow($item);
            $beforeRun = $db->createCommand(
                'SELECT item_kind, item_id, flow_id, version, current_step_key, finish_state, finish_reason, '
                . 'started_at, closed_at, closed_reason, draft_revision FROM item_flow_runs '
                . 'WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryOne();
            $beforeItem = $this->fixtures->itemRow($item);
            $beforeElectronicContent = $this->electronicLiveContent($destination);

            MigrationRollback::migrate('up');
            $db->schema->refresh();
            Assert::assertSame($beforeState, $this->stateRow($item));
            Assert::assertSame($beforeRun, $db->createCommand(
                'SELECT item_kind, item_id, flow_id, version, current_step_key, finish_state, finish_reason, '
                . 'started_at, closed_at, closed_reason, draft_revision FROM item_flow_runs '
                . 'WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryOne());
            Assert::assertSame($beforeItem, $this->fixtures->itemRow($item));
            Assert::assertSame($frozenInputs, $this->fixtures->itemRow($item)['source_snapshot_json']);
            Assert::assertSame($beforeElectronicContent, $this->electronicLiveContent($destination));
            Assert::assertSame($item['id'], (int)$this->attachmentRow($item)['item_id']);
            Assert::assertSame(
                $this->fixtures->electronicResourceName('preserve-live'),
                $this->snapshot($item)['name']
            );
        });
    }
}
