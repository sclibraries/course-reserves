<?php

use PHPUnit\Framework\Assert;
use app\models\SubmissionNewResource;
use app\models\SubmissionReuseResource;

class Api119BFacultyLockMigrationCest extends BaseFunctionalCest
{
    const VERSION = 'm261120_000001_add_faculty_lock_latch';

    private $uuids = [];
    private $templateId;
    private $flowId;

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    public function testBackfillUsesEachEvidenceSignalAndExactItemIdentity(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown(self::VERSION, function () {
            $db = \Yii::$app->db;
            $submissionId = $this->createSubmission('matrix');
            $otherSubmissionId = $this->createSubmission('mismatch');
            $this->createFlow();
            $expected = [];
            $empty = [];

            foreach ([
                ['new', 'prepared'], ['reuse', 'on_reserve'], ['new', 'available_online'],
            ] as $index => $case) {
                list($kind, $state) = $case;
                $id = $this->createItem($kind, $submissionId);
                $this->createRun($kind, $id, $state);
                if ($index === 0) {
                    $this->createRun($kind, $id, 'unavailable');
                }
                $this->record($expected, $kind, $id);
            }

            foreach (['new', 'reuse'] as $kind) {
                $id = $this->createItem($kind, $submissionId);
                $this->event($submissionId, $id, $kind, 'item_marked_ready');
                $this->record($expected, $kind, $id);

                $id = $this->createItem($kind, $submissionId);
                $this->event($submissionId, $id, $kind, 'released', 'Checklist completed');
                $this->record($expected, $kind, $id);

                $id = $this->createItem($kind, $submissionId, [
                    'item_status' => $kind === 'new' ? 'complete' : 'completed',
                ]);
                $this->record($expected, $kind, $id);

                $id = $this->createItem($kind, $submissionId);
                $this->event($submissionId, $id, $kind, 'status_changed', null,
                    $kind === 'new' ? ['status' => 'complete'] : null,
                    $kind === 'reuse' ? ['status' => 'completed'] : null);
                $this->record($expected, $kind, $id);

                $id = $this->createItem($kind, $submissionId);
                $this->createPublicationState($submissionId, $kind, $id);
                $this->record($expected, $kind, $id);
            }

            $checklistItemId = $this->createItem('new', $submissionId);
            $this->createCompletedChecklist($checklistItemId);
            $this->record($expected, 'new', $checklistItemId);

            foreach ([
                'materialized_resource_id' => 7001,
                'materialized_course_resource_id' => 7002,
                'materialized_physical_reference_id' => 7003,
                'materialized_folder_id' => 7004,
                'materialized_at' => date('Y-m-d H:i:s', time() - 30),
                'materialized_by_staff_id' => 'test-api119b-staff',
            ] as $field => $value) {
                $id = $this->createItem('new', $submissionId, [$field => $value]);
                $this->record($expected, 'new', $id);
            }
            $reuseMaterializedId = $this->createItem('reuse', $submissionId, [
                'materialized_folder_id' => 7005,
            ]);
            $this->record($expected, 'reuse', $reuseMaterializedId);

            $typedPair = $this->createIdentityPair($submissionId);
            $this->event($submissionId, $typedPair, 'new', 'item_marked_ready');
            $this->record($expected, 'new', $typedPair);
            $this->record($empty, 'reuse', $typedPair);

            $checklistPair = $this->createIdentityPair($submissionId);
            $this->createCompletedChecklist($checklistPair);
            $this->record($expected, 'new', $checklistPair);
            $this->record($empty, 'reuse', $checklistPair);

            $legacyPair = $this->createIdentityPair($submissionId);
            $this->event($submissionId, $legacyPair, null, 'released', 'Checklist completed');
            $this->record($expected, 'new', $legacyPair);
            $this->record($empty, 'reuse', $legacyPair);

            $wrongReleaseReasonId = $this->createItem('new', $submissionId);
            $this->event($submissionId, $wrongReleaseReasonId, 'new', 'released', 'Other reason');
            $this->record($empty, 'new', $wrongReleaseReasonId);

            $nestedStatusId = $this->createItem('new', $submissionId);
            $this->event($submissionId, $nestedStatusId, 'new', 'status_changed', null,
                ['metadata' => ['status' => 'complete']]);
            $this->record($empty, 'new', $nestedStatusId);

            $pagedHistoryId = $this->createItem('new', $submissionId);
            for ($index = 0; $index < \app\services\FacultyLockLatchBackfill::BATCH_SIZE; $index++) {
                $this->createRun('new', $pagedHistoryId, 'unavailable');
                $this->event($submissionId, $pagedHistoryId, 'new', 'step_answered');
            }
            $this->createRun('new', $pagedHistoryId, 'prepared');
            $this->event($submissionId, $pagedHistoryId, 'new', 'item_marked_ready');
            $this->record($expected, 'new', $pagedHistoryId);

            $mismatchedLegacyId = $this->createItem('new', $submissionId);
            $this->event($otherSubmissionId, $mismatchedLegacyId, null, 'item_marked_ready');
            $this->record($empty, 'new', $mismatchedLegacyId);

            $this->record($empty, 'new', $this->createItem('new', $submissionId));
            $this->record($empty, 'reuse', $this->createItem('reuse', $submissionId));

            MigrationRollback::addColumn('submission_new_resources', 'locked_for_faculty_at', 'DATETIME NULL');
            MigrationRollback::addColumn('submission_reuse_resources', 'locked_for_faculty_at', 'DATETIME NULL');
            $db->schema->refresh();

            $backfillTimestamp = date('Y-m-d H:i:s');
            (new \app\services\FacultyLockLatchBackfill($db))->backfill($backfillTimestamp);

            $timestamps = [];
            foreach ($expected as $identity => $_) {
                list($kind, $id) = explode(':', $identity, 2);
                $value = $this->latch($kind, (int)$id);
                Assert::assertNotNull($value, 'Expected latch for ' . $identity);
                Assert::assertSame($backfillTimestamp, $value, 'Unexpected backfill time for ' . $identity);
                $timestamps[$value] = true;
            }
            Assert::assertCount(1, $timestamps, 'One backfill run uses one captured timestamp.');
            foreach ($empty as $identity => $_) {
                list($kind, $id) = explode(':', $identity, 2);
                Assert::assertNull($this->latch($kind, (int)$id), 'Unexpected latch for ' . $identity);
            }
        });
    }

    public function testMigrationRerunsPreserveDataAndHideLatchSerialization(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown(self::VERSION, function () {
            $db = \Yii::$app->db;
            $submissionId = $this->createSubmission('lifecycle');
            $newId = (int)$db->createCommand(
                'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
                [':id' => $submissionId]
            )->queryScalar();
            $reuseId = $this->createItem('reuse', $submissionId);
            $oldUpdatedAt = date('Y-m-d H:i:s', time() - 3600);
            $db->createCommand()->update('submission_new_resources', [
                'item_status' => 'complete', 'updated_at' => $oldUpdatedAt,
            ], ['id' => $newId])->execute();
            $before = $db->createCommand(
                'SELECT * FROM submission_new_resources WHERE id = :id', [':id' => $newId]
            )->queryOne();

            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $firstLatch = $this->latch('new', $newId);
            Assert::assertNotNull($firstLatch);
            Assert::assertNull($this->latch('reuse', $reuseId));
            $after = $db->createCommand(
                'SELECT * FROM submission_new_resources WHERE id = :id', [':id' => $newId]
            )->queryOne();
            unset($after['locked_for_faculty_at']);
            Assert::assertSame($before, $after, 'The backfill must preserve every non-latch item column.');

            MigrationRollback::migrate('down');
            $db->schema->refresh();
            foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
                Assert::assertNull($db->getTableSchema($table, true)->getColumn('locked_for_faculty_at'));
            }
            MigrationRollback::addColumn('submission_new_resources', 'locked_for_faculty_at', 'DATETIME NULL');
            MigrationRollback::migrate('up');
            $db->schema->refresh();
            Assert::assertNotNull($this->latch('new', $newId));
            Assert::assertNotNull($db->getTableSchema('submission_reuse_resources', true)
                ->getColumn('locked_for_faculty_at'));

            $preservedLatch = date('Y-m-d H:i:s', time() - 60);
            $db->createCommand()->update('submission_new_resources', [
                'item_status' => 'pending', 'locked_for_faculty_at' => $preservedLatch,
                'updated_at' => $oldUpdatedAt,
            ], ['id' => $newId])->execute();
            $db->createCommand()->delete('migration', ['version' => self::VERSION])->execute();
            MigrationRollback::migrate('up');
            Assert::assertSame($preservedLatch, $this->latch('new', $newId));
            Assert::assertSame($oldUpdatedAt, (string)$db->createCommand(
                'SELECT updated_at FROM submission_new_resources WHERE id = :id', [':id' => $newId]
            )->queryScalar());

            Assert::assertArrayNotHasKey('locked_for_faculty_at', SubmissionNewResource::findOne($newId)->toArray());
            Assert::assertArrayNotHasKey('locked_for_faculty_at', SubmissionReuseResource::findOne($reuseId)->toArray());
            foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
                $column = $db->getTableSchema($table, true)->getColumn('locked_for_faculty_at');
                Assert::assertNotNull($column, 'Missing latch column on ' . $table);
                Assert::assertTrue($column->allowNull);
                Assert::assertSame('datetime', $column->type);
            }

            MigrationRollback::migrate('down');
            $db->schema->refresh();
            foreach (['submission_new_resources', 'submission_reuse_resources'] as $table) {
                Assert::assertNull($db->getTableSchema($table, true)->getColumn('locked_for_faculty_at'));
                if ($table === 'submission_new_resources') {
                    Assert::assertNotNull($db->getTableSchema($table, true)->getColumn('updated_at'));
                }
                Assert::assertNotNull($db->getTableSchema($table, true)->getColumn('item_status'));
            }
            MigrationRollback::migrate('up');
            $db->schema->refresh();
            Assert::assertNull($this->latch('new', $newId));
        });
    }

    private function createSubmission($suffix)
    {
        $uuid = $this->uuid();
        $this->uuids[] = $uuid;
        return TestSubmissionFixture::create($uuid, 'test-api119b-faculty', [
            'course_code' => 'TST 119B-' . substr(str_replace('-', '', $uuid), 0, 8),
            'course_title' => 'Synthetic API-119B ' . $suffix,
            'submitted_at' => date('Y-m-d H:i:s'),
        ]);
    }

    private function createItem($kind, $submissionId, array $attributes = [])
    {
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $values = array_merge([
            'submission_id' => $submissionId,
            'resource_data' => json_encode(['title' => 'Synthetic API-119B item']),
            'item_status' => 'pending',
        ], $attributes);
        if ($kind === 'reuse') {
            unset($values['resource_data']);
        }
        \Yii::$app->db->createCommand()->insert($table, $values)->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function createIdentityPair($submissionId)
    {
        $db = \Yii::$app->db;
        $newMax = (int)$db->createCommand('SELECT COALESCE(MAX(id), 0) FROM submission_new_resources')->queryScalar();
        $reuseMax = (int)$db->createCommand('SELECT COALESCE(MAX(id), 0) FROM submission_reuse_resources')->queryScalar();
        $id = max($newMax, $reuseMax) + 1;
        $this->createItem('new', $submissionId, ['id' => $id]);
        $this->createItem('reuse', $submissionId, ['id' => $id]);
        return $id;
    }

    private function createFlow()
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('flows', [
            'name' => 'Synthetic API-119B ' . $this->uuid(), 'created_by' => 'test-api119b-staff',
        ])->execute();
        $this->flowId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('flow_versions', [
            'flow_id' => $this->flowId, 'version' => 1, 'steps_json' => '[]',
            'created_by' => 'test-api119b-staff',
        ])->execute();
    }

    private function createRun($kind, $itemId, $state)
    {
        \Yii::$app->db->createCommand()->insert('item_flow_runs', [
            'item_kind' => $kind, 'item_id' => $itemId, 'flow_id' => $this->flowId, 'version' => 1,
            'finish_state' => $state, 'closed_at' => date('Y-m-d H:i:s'),
        ])->execute();
    }

    private function createPublicationState($submissionId, $kind, $itemId)
    {
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => $kind, 'item_id' => $itemId, 'submission_id' => $submissionId,
            'published_revision' => 1,
        ])->execute();
    }

    private function createCompletedChecklist($itemId)
    {
        $db = \Yii::$app->db;
        if (!$this->templateId) {
            $db->createCommand()->insert('checklist_templates', [
                'name' => 'Synthetic API-119B checklist ' . $this->uuid(),
            ])->execute();
            $this->templateId = (int)$db->getLastInsertID();
        }
        $db->createCommand()->insert('item_checklists', [
            'submission_item_id' => $itemId, 'template_id' => $this->templateId,
            'completed_at' => date('Y-m-d H:i:s', time() - 30),
        ])->execute();
    }

    private function event($submissionId, $itemId, $kind, $type, $reason = null, $before = null, $after = null)
    {
        \Yii::$app->db->createCommand()->insert('workflow_events', [
            'submission_id' => $submissionId, 'item_id' => $itemId, 'item_kind' => $kind,
            'actor_username' => 'test-api119b-staff', 'actor_role' => 'staff', 'event_type' => $type,
            'reason' => $reason, 'before_json' => $before === null ? null : json_encode($before),
            'after_json' => $after === null ? null : json_encode($after),
            'created_at' => date('Y-m-d H:i:s'),
        ])->execute();
    }

    private function record(array &$identities, $kind, $id)
    {
        $identities[$kind . ':' . $id] = true;
    }

    private function latch($kind, $id)
    {
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        return \Yii::$app->db->createCommand(
            'SELECT locked_for_faculty_at FROM ' . $table . ' WHERE id = :id', [':id' => $id]
        )->queryScalar();
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        foreach ($this->uuids as $uuid) {
            $submissionId = $db->createCommand(
                'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
                [':uuid' => $uuid]
            )->queryScalar();
            if (!$submissionId) {
                continue;
            }
            $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionId])->execute();
            $db->createCommand()->delete('submission_publication_state', ['submission_id' => $submissionId])->execute();
            foreach ([
                'new' => 'submission_new_resources', 'reuse' => 'submission_reuse_resources',
            ] as $kind => $table) {
                $ids = $db->createCommand(
                    'SELECT id FROM ' . $table . ' WHERE submission_id = :id', [':id' => $submissionId]
                )->queryColumn();
                if ($ids) {
                    $db->createCommand()->delete('item_flow_runs', ['item_kind' => $kind, 'item_id' => $ids])->execute();
                }
            }
            TestSubmissionFixture::delete($uuid);
        }
        if ($this->templateId) {
            $db->createCommand()->delete('checklist_templates', ['id' => $this->templateId])->execute();
        }
        if ($this->flowId) {
            $runIds = $db->createCommand('SELECT id FROM item_flow_runs WHERE flow_id = :id', [':id' => $this->flowId])->queryColumn();
            if ($runIds) {
                $db->createCommand()->delete('item_flow_step_results', ['run_id' => $runIds])->execute();
                $db->createCommand()->delete('item_flow_runs', ['id' => $runIds])->execute();
            }
            $db->createCommand()->delete('flow_versions', ['flow_id' => $this->flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $this->flowId])->execute();
        }
    }

    private function uuid()
    {
        $hex = bin2hex(random_bytes(16));
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3)
            . '-a' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
    }
}
