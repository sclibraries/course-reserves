<?php

use PHPUnit\Framework\Assert;
use app\services\FacultyLockLatchBackfill;

class Api119CHistoryReviewMigrationCest extends BaseFunctionalCest
{
    const VERSION = 'm261123_000001_create_item_history_review';

    private $uuids = [];
    private $templateId;

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    public function testFlagsSubmittedItemsWithOrderedTraceAndExactIdentity(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown(self::VERSION, function () {
            $db = \Yii::$app->db;
            $expected = [];
            $excluded = [];
            $submissionIds = [];
            foreach ([
                ['draft', false], ['submitted', true], ['in_review', true],
                ['partially_complete', true], ['complete', true], ['canceled', true], [null, false],
            ] as $index => $case) {
                list($status, $eligible) = $case;
                list($submissionId, $itemId) = $this->createSubmission('scope-' . $index, $status);
                $submissionIds[] = $submissionId;
                if ($eligible) {
                    $expected[$itemId] = [$submissionId, 'none'];
                } else {
                    $excluded[] = $itemId;
                }
            }

            list($submissionId, $plainItemId) = $this->createSubmission('traces');
            $submissionIds[] = $submissionId;
            $unlinked = $db->createCommand(
                'SELECT offering_id, folio_course_listing_id FROM faculty_submissions WHERE submission_id = :id',
                [':id' => $submissionId]
            )->queryOne();
            Assert::assertSame(['offering_id' => null, 'folio_course_listing_id' => null], $unlinked);
            $expected[$plainItemId] = [$submissionId, 'none'];
            $reuseFlagId = $this->createItem($submissionId, ['is_reuse' => 1]);
            $expected[$reuseFlagId] = [$submissionId, 'none'];

            $checklistId = $this->createItem($submissionId);
            $this->createChecklist($checklistId);
            $expected[$checklistId] = [$submissionId, 'checklist_row'];

            $staffClaimId = $this->createItem($submissionId, ['claimed_by_staff_id' => 'old-staff-id']);
            $expected[$staffClaimId] = [$submissionId, 'legacy_claim'];
            $timestampClaimId = $this->createItem($submissionId, ['claimed_at' => $this->past()]);
            $expected[$timestampClaimId] = [$submissionId, 'legacy_claim'];

            $typedEventId = $this->createItem($submissionId);
            $this->event($submissionId, $typedEventId, 'new', ['status' => 'processing'], null);
            $expected[$typedEventId] = [$submissionId, 'status_event'];
            $nullKindEventId = $this->createItem($submissionId);
            $this->event($submissionId, $nullKindEventId, null, null, ['status' => 'processing']);
            $expected[$nullKindEventId] = [$submissionId, 'status_event'];

            $combinedId = $this->createItem($submissionId, ['claimed_by_staff_id' => 'old-staff-id']);
            $this->createChecklist($combinedId);
            $this->event($submissionId, $combinedId, 'new', null, ['status' => 'processing']);
            $expected[$combinedId] = [$submissionId, 'checklist_row,legacy_claim,status_event'];

            $currentClaimId = $this->createItem($submissionId, [
                'claimed_by' => 'current-staff', 'claimed_at' => $this->past(),
            ]);
            $expected[$currentClaimId] = [$submissionId, 'none'];

            list($otherSubmissionId, $otherBaseItemId) = $this->createSubmission('event-collision');
            $submissionIds[] = $otherSubmissionId;
            $expected[$otherBaseItemId] = [$otherSubmissionId, 'none'];
            $typedCollisionId = $this->nextSharedItemId();
            $typedMismatchId = $this->createItem($submissionId, ['id' => $typedCollisionId]);
            $this->createReuseItem($submissionId, $typedCollisionId);
            $this->event($submissionId, $typedCollisionId, 'reuse', null, ['status' => 'processing']);
            $expected[$typedMismatchId] = [$submissionId, 'none'];

            $nullCollisionId = $this->createItem($submissionId);
            $this->event($otherSubmissionId, $nullCollisionId, null, null, ['status' => 'processing']);
            $expected[$nullCollisionId] = [$submissionId, 'none'];

            $reuseOnlyId = $this->nextSharedItemId();
            $legacyReuseId = $this->createReuseItem($submissionId, $reuseOnlyId);

            $latchedId = $this->createItem($submissionId, ['item_status' => 'complete']);
            $latchTime = $this->past();
            (new FacultyLockLatchBackfill($db))->backfill($latchTime);
            Assert::assertSame($latchTime, $this->latch($latchedId));
            $db->createCommand()->update('submission_new_resources', ['item_status' => 'pending'], ['id' => $latchedId])
                ->execute();
            $this->event($submissionId, $latchedId, 'new', null, ['status' => 'complete']);
            $excluded[] = $latchedId;

            $migrationLatchId = $this->createItem($submissionId, ['item_status' => 'complete']);
            MigrationRollback::migrate('up');

            $actual = [];
            $flaggedAt = [];
            foreach ($db->createCommand(
                'SELECT item_id, submission_id, trace, flagged_at FROM item_history_review '
                . 'WHERE submission_id IN (' . implode(',', array_map('intval', $submissionIds)) . ')'
            )->queryAll() as $row) {
                $itemId = (int)$row['item_id'];
                $actual[$itemId] = [(int)$row['submission_id'], $row['trace']];
                $flaggedAt[$row['flagged_at']] = true;
            }
            ksort($expected);
            ksort($actual);
            Assert::assertSame($expected, $actual);
            Assert::assertCount(1, $flaggedAt);
            $migrationLatch = $this->latch($migrationLatchId);
            Assert::assertNotNull($migrationLatch);
            Assert::assertSame(array_key_first($flaggedAt), $migrationLatch);
            Assert::assertSame([], array_intersect(array_keys($actual), $excluded));
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM item_history_review WHERE item_id = :id', [':id' => $legacyReuseId]
            )->queryScalar());
        });
    }

    public function testRerunPreservesReviewsAndDownUpKeepsLatchesAndCascades(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown(self::VERSION, function () {
            $db = \Yii::$app->db;
            list($submissionId, $latchedItemId) = $this->createSubmission('lifecycle');
            $latchTime = $this->past();
            $db->createCommand()->update('submission_new_resources', [
                'locked_for_faculty_at' => $latchTime,
            ], ['id' => $latchedItemId])->execute();
            for ($index = 0; $index < FacultyLockLatchBackfill::BATCH_SIZE + 1; $index++) {
                $this->createItem($submissionId);
            }

            MigrationRollback::migrate('up');
            $this->assertSchema($db);
            $reviewedItemId = (int)$db->createCommand(
                'SELECT item_id FROM item_history_review WHERE submission_id = :id ORDER BY id LIMIT 1',
                [':id' => $submissionId]
            )->queryScalar();
            Assert::assertSame(FacultyLockLatchBackfill::BATCH_SIZE + 1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM item_history_review WHERE submission_id = :id', [':id' => $submissionId]
            )->queryScalar());

            $review = [
                'trace' => 'preserved-trace', 'flagged_at' => $this->past(),
                'reviewed_at' => $this->past(), 'reviewed_by_staff_id' => 'synthetic-staff-id',
                'decision' => 'not_finished', 'reason' => 'Synthetic preserved decision',
            ];
            $db->createCommand()->update('item_history_review', $review, ['item_id' => $reviewedItemId])->execute();
            $db->createCommand()->delete('item_history_review', [
                'and', ['submission_id' => $submissionId], ['<>', 'item_id', $reviewedItemId],
            ])->execute();
            $db->createCommand()->delete('migration', ['version' => self::VERSION])->execute();
            MigrationRollback::migrate('up');

            Assert::assertSame(FacultyLockLatchBackfill::BATCH_SIZE + 1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM item_history_review WHERE submission_id = :id', [':id' => $submissionId]
            )->queryScalar());
            Assert::assertSame($review, $db->createCommand(
                'SELECT trace, flagged_at, reviewed_at, reviewed_by_staff_id, decision, reason '
                . 'FROM item_history_review WHERE item_id = :id', [':id' => $reviewedItemId]
            )->queryOne());

            MigrationRollback::migrate('down');
            Assert::assertSame($latchTime, $this->latch($latchedItemId));
            MigrationRollback::migrate('up');
            Assert::assertSame($latchTime, $this->latch($latchedItemId));

            $db->createCommand()->delete('submission_new_resources', ['id' => $reviewedItemId])->execute();
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM item_history_review WHERE item_id = :id', [':id' => $reviewedItemId]
            )->queryScalar());
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionId])->execute();
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM item_history_review WHERE submission_id = :id', [':id' => $submissionId]
            )->queryScalar());
        });
    }

    private function createSubmission($suffix, $status = 'submitted')
    {
        $uuid = $this->uuid();
        $this->uuids[] = $uuid;
        $submissionId = TestSubmissionFixture::create($uuid, 'test-api119c1-faculty', [
            'course_code' => 'TST 119C1-' . substr(str_replace('-', '', $uuid), 0, 8),
            'course_title' => 'Synthetic API-119C1 ' . $suffix,
            'status' => $status,
            'submitted_at' => $this->past(),
        ]);
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id ORDER BY id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        return [$submissionId, $itemId];
    }

    private function createItem($submissionId, array $attributes = [])
    {
        $values = array_merge([
            'submission_id' => $submissionId, 'resource_data' => json_encode(['title' => 'Synthetic item']),
            'item_status' => 'pending',
        ], $attributes);
        \Yii::$app->db->createCommand()->insert('submission_new_resources', $values)->execute();
        return (int)\Yii::$app->db->getLastInsertID();
    }

    private function createReuseItem($submissionId, $id)
    {
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'id' => $id, 'submission_id' => $submissionId, 'item_status' => 'pending',
        ])->execute();
        return (int)$id;
    }

    private function createChecklist($itemId)
    {
        $db = \Yii::$app->db;
        if (!$this->templateId) {
            $db->createCommand()->insert('checklist_templates', [
                'name' => 'Synthetic API-119C1 checklist ' . $this->uuid(),
            ])->execute();
            $this->templateId = (int)$db->getLastInsertID();
        }
        $db->createCommand()->insert('item_checklists', [
            'submission_item_id' => $itemId, 'template_id' => $this->templateId,
        ])->execute();
    }

    private function event($submissionId, $itemId, $kind, $before, $after)
    {
        \Yii::$app->db->createCommand()->insert('workflow_events', [
            'submission_id' => $submissionId, 'item_id' => $itemId, 'item_kind' => $kind,
            'actor_username' => 'test-api119c1-staff', 'actor_role' => 'staff', 'event_type' => 'status_changed',
            'reason' => null, 'before_json' => $before === null ? null : json_encode($before),
            'after_json' => $after === null ? null : json_encode($after), 'created_at' => $this->past(),
        ])->execute();
    }

    private function nextSharedItemId()
    {
        $db = \Yii::$app->db;
        $new = (int)$db->createCommand('SELECT COALESCE(MAX(id), 0) FROM submission_new_resources')->queryScalar();
        $reuse = (int)$db->createCommand('SELECT COALESCE(MAX(id), 0) FROM submission_reuse_resources')->queryScalar();
        return max($new, $reuse) + 100;
    }

    private function latch($itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT locked_for_faculty_at FROM submission_new_resources WHERE id = :id', [':id' => $itemId]
        )->queryScalar();
    }

    private function assertSchema($db)
    {
        $columns = [];
        foreach ($db->createCommand(
            'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, EXTRA FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "item_history_review"'
        )->queryAll() as $column) {
            $columns[$column['COLUMN_NAME']] = $column;
        }
        Assert::assertSame('bigint(20) unsigned', $columns['id']['COLUMN_TYPE']);
        Assert::assertSame('auto_increment', $columns['id']['EXTRA']);
        Assert::assertSame('bigint(20) unsigned', $columns['item_id']['COLUMN_TYPE']);
        Assert::assertSame('bigint(20) unsigned', $columns['submission_id']['COLUMN_TYPE']);
        Assert::assertSame('varchar(64)', $columns['trace']['COLUMN_TYPE']);
        Assert::assertSame('datetime', $columns['flagged_at']['COLUMN_TYPE']);
        Assert::assertSame('YES', $columns['reviewed_at']['IS_NULLABLE']);
        Assert::assertSame('varchar(255)', $columns['reviewed_by_staff_id']['COLUMN_TYPE']);
        Assert::assertSame("enum('finished','not_finished')", $columns['decision']['COLUMN_TYPE']);
        Assert::assertSame('text', $columns['reason']['COLUMN_TYPE']);

        $indexes = [];
        foreach ($db->createCommand('SHOW INDEX FROM item_history_review')->queryAll() as $index) {
            $indexes[$index['Key_name']][(int)$index['Seq_in_index']] = $index['Column_name'];
        }
        foreach ($indexes as &$indexColumns) {
            ksort($indexColumns);
            $indexColumns = array_values($indexColumns);
        }
        unset($indexColumns);
        Assert::assertSame(['item_id'], $indexes['uq_item_history_review_item_id']);
        Assert::assertSame(['reviewed_at', 'id'], $indexes['idx_item_history_review_open']);
        Assert::assertSame(['submission_id', 'reviewed_at'], $indexes['idx_item_history_review_submission_open']);
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        foreach ($this->uuids as $uuid) {
            $submissionId = $db->createCommand(
                'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid', [':uuid' => $uuid]
            )->queryScalar();
            if ($submissionId) {
                $db->createCommand()->delete('workflow_events', ['submission_id' => $submissionId])->execute();
                TestSubmissionFixture::delete($uuid);
            }
        }
        if ($this->templateId) {
            $db->createCommand()->delete('checklist_templates', ['id' => $this->templateId])->execute();
        }
    }

    private function past()
    {
        return date('Y-m-d H:i:s', time() - 300);
    }

    private function uuid()
    {
        $hex = bin2hex(random_bytes(16));
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3)
            . '-a' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
    }
}
