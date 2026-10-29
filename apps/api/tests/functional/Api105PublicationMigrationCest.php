<?php

use PHPUnit\Framework\Assert;

/** Verifies destination-based migration reconciliation and non-destructive rollback. */
class Api105PublicationMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261029_000002_add_submission_publication_state';
    private $prefix = 'test-api105-migration-';

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    public function reconcilesVerifiedDestinationsAndDoesNotTrustCompleteStatus(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $offering = $this->createOffering('one');
            $otherOffering = $this->createOffering('other');
            $electronic = $this->createSubmission('electronic', $offering);
            $sameOffering = $this->createSubmission('same-offering', $offering);
            $physical = $this->createSubmission('physical', $offering, 'reuse');
            $shared = $this->createSubmission('shared', $offering);
            $completeOnly = $this->createSubmission('complete-only', $offering);
            $mismatch = $this->createSubmission('mismatch', $offering);

            $db->createCommand()->insert('resources', [
                'name' => $this->prefix . 'live electronic title',
                'item_url' => 'https://example.edu/item',
            ])->execute();
            $resourceId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('course_resources', [
                'offering_id' => $offering,
                'resource_id' => $resourceId,
            ])->execute();
            $courseResourceId = (int)$db->getLastInsertID();
            $db->createCommand()->update('submission_new_resources', [
                'materialized_resource_id' => $resourceId,
                'materialized_course_resource_id' => $courseResourceId,
                'materialized_at' => '2026-10-01 12:00:00',
                'materialized_by_staff_id' => 'synthetic-staff',
            ], ['id' => $electronic['item_id']])->execute();
            $db->createCommand()->update('submission_new_resources', [
                'materialized_resource_id' => $resourceId,
                'materialized_course_resource_id' => $courseResourceId,
                'materialized_at' => '2026-10-01 12:02:00',
                'materialized_by_staff_id' => 'synthetic-staff',
            ], ['id' => $sameOffering['item_id']])->execute();

            $db->createCommand()->insert('resources', [
                'name' => $this->prefix . 'shared electronic title',
                'item_url' => 'https://example.edu/shared-item',
            ])->execute();
            $sharedResourceId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('course_resources', [
                'offering_id' => $offering,
                'resource_id' => $sharedResourceId,
            ])->execute();
            $sharedCourseResourceId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('course_resources', [
                'offering_id' => $otherOffering,
                'resource_id' => $sharedResourceId,
            ])->execute();
            $db->createCommand()->update('submission_new_resources', [
                'materialized_resource_id' => $sharedResourceId,
                'materialized_course_resource_id' => $sharedCourseResourceId,
                'materialized_at' => '2026-10-01 12:05:00',
                'materialized_by_staff_id' => 'synthetic-staff',
            ], ['id' => $shared['item_id']])->execute();

            $db->createCommand()->insert('physical_resource_references', [
                'external_resource_id' => $this->prefix . 'barcode',
                'resource_type' => 'physical',
                'display_name' => $this->prefix . 'live physical title',
                'offering_id' => $offering,
            ])->execute();
            $physicalReferenceId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('physical_resource_references', [
                'external_resource_id' => $this->prefix . 'barcode',
                'resource_type' => 'physical',
                'display_name' => $this->prefix . 'shared physical title',
                'offering_id' => $otherOffering,
            ])->execute();
            $db->createCommand()->update('submission_reuse_resources', [
                'barcode' => $this->prefix . 'barcode',
                'materialized_physical_reference_id' => $physicalReferenceId,
                'materialized_at' => '2026-10-02 12:00:00',
                'materialized_by_staff_id' => 'synthetic-staff',
            ], ['id' => $physical['item_id']])->execute();

            $db->createCommand()->update('submission_new_resources', [
                'item_status' => 'complete',
            ], ['id' => $completeOnly['item_id']])->execute();

            $db->createCommand()->insert('resources', [
                'name' => $this->prefix . 'mismatched offering resource',
            ])->execute();
            $wrongResourceId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('course_resources', [
                'offering_id' => $otherOffering,
                'resource_id' => $wrongResourceId,
            ])->execute();
            $wrongCourseResourceId = (int)$db->getLastInsertID();
            $db->createCommand()->update('submission_new_resources', [
                'materialized_resource_id' => $wrongResourceId,
                'materialized_course_resource_id' => $wrongCourseResourceId,
                'materialized_at' => '2026-10-03 12:00:00',
                'materialized_by_staff_id' => 'synthetic-staff',
            ], ['id' => $mismatch['item_id']])->execute();

            MigrationRollback::migrate('up');
            $electronicState = $this->state('new', $electronic['item_id']);
            Assert::assertSame('published', $electronicState['state']);
            Assert::assertSame('verified', $electronicState['reconciliation_status']);
            $liveSnapshot = json_decode($electronicState['published_snapshot'], true);
            Assert::assertSame($this->prefix . 'live electronic title', $liveSnapshot['resource']['name']);
            Assert::assertSame($courseResourceId, (int)$liveSnapshot['course_resource']['course_resource_id']);

            $sameOfferingState = $this->state('new', $sameOffering['item_id']);
            Assert::assertSame('verified', $sameOfferingState['reconciliation_status']);

            $sharedState = $this->state('new', $shared['item_id']);
            Assert::assertSame('verified_shared', $sharedState['reconciliation_status']);
            Assert::assertTrue(json_decode($sharedState['published_destination'], true)['shared']);

            $physicalState = $this->state('reuse', $physical['item_id']);
            Assert::assertSame('published', $physicalState['state']);
            Assert::assertSame('verified_shared', $physicalState['reconciliation_status']);
            Assert::assertTrue(json_decode($physicalState['published_destination'], true)['shared']);
            Assert::assertSame('physical', json_decode($physicalState['published_snapshot'], true)['kind']);

            $completeState = $this->state('new', $completeOnly['item_id']);
            Assert::assertSame('pending', $completeState['state']);
            Assert::assertNull($completeState['published_revision']);
            Assert::assertSame('no_materialization_marker', $completeState['reconciliation_status']);

            $mismatchState = $this->state('new', $mismatch['item_id']);
            Assert::assertSame('pending', $mismatchState['state']);
            Assert::assertSame('offering_mismatch', $mismatchState['reconciliation_status']);

            MigrationRollback::migrate('down');
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM resources WHERE resource_id = :id', [':id' => $resourceId]
            )->queryScalar());
            Assert::assertSame($courseResourceId, (int)$db->createCommand(
                'SELECT materialized_course_resource_id FROM submission_new_resources WHERE id = :id',
                [':id' => $electronic['item_id']]
            )->queryScalar());
            Assert::assertSame($physicalReferenceId, (int)$db->createCommand(
                'SELECT materialized_physical_reference_id FROM submission_reuse_resources WHERE id = :id',
                [':id' => $physical['item_id']]
            )->queryScalar());
        });
    }

    private function createSubmission($suffix, $offering, $kind = 'new')
    {
        $uuid = $this->uuid();
        $submissionId = TestSubmissionFixture::create($uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 105-' . substr(str_replace('-', '', $uuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . $suffix,
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
            'folio_course_listing_id' => $this->prefix . 'folio-' . $suffix,
            'offering_id' => $offering,
        ]);
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $itemId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM ' . $table . ' WHERE submission_id = :id LIMIT 1',
            [':id' => $submissionId]
        )->queryScalar();
        return ['submission_id' => $submissionId, 'item_id' => $itemId];
    }

    private function createOffering($suffix)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('courses', [
            'course_name' => $this->prefix . $suffix,
            'course_number' => $this->prefix . $suffix,
        ])->execute();
        $courseId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('course_offerings', [
            'course_id' => $courseId,
            'folio_course_id' => $this->prefix . 'folio-course-' . $suffix,
            'term_id' => $this->prefix . 'term-' . $suffix,
            'term_name' => 'Fall 2027',
            'section_name' => '01',
        ])->execute();
        return (int)$db->getLastInsertID();
    }

    private function state($kind, $itemId)
    {
        return \Yii::$app->db->createCommand(
            'SELECT state, published_revision, reconciliation_status, published_snapshot, '
            . 'published_destination_json AS published_destination '
            . 'FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
            [':kind' => $kind, ':id' => $itemId]
        )->queryOne();
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $courseIds = $db->createCommand(
            'SELECT course_id FROM courses WHERE course_number LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        $submissionIds = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE course_title LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($submissionIds) {
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        if ($courseIds) {
            $offeringIds = $db->createCommand(
                'SELECT offering_id FROM course_offerings WHERE course_id IN ('
                . implode(',', array_map('intval', $courseIds)) . ')'
            )->queryColumn();
            if ($offeringIds) {
                $db->createCommand()->delete('physical_resource_references', ['offering_id' => $offeringIds])->execute();
                $db->createCommand()->delete('course_offerings', ['offering_id' => $offeringIds])->execute();
            }
            $db->createCommand()->delete('courses', ['course_id' => $courseIds])->execute();
        }
        $resourceIds = $db->createCommand(
            'SELECT resource_id FROM resources WHERE name LIKE :prefix', [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($resourceIds) {
            $db->createCommand()->delete('resources', ['resource_id' => $resourceIds])->execute();
        }
    }
}
