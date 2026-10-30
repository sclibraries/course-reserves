<?php

use PHPUnit\Framework\Assert;

/** Locks the API-114 destination migration lifecycle and preservation contract. */
class Api114DestinationMigrationCest extends BaseFunctionalCest
{
    private $migrationVersion = 'm261030_000002_add_destination_fields_and_copy_inputs';
    private $prefix = 'test-api114-migration-';
    private $uuid;
    private $courseId;
    private $offeringId;
    private $resourceId;
    private $referenceId;
    private $submissionId;
    private $itemId;

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        if ($this->referenceId) {
            $db->createCommand()->delete('physical_resource_references', ['reference_id' => $this->referenceId])->execute();
        }
        if ($this->resourceId) {
            $db->createCommand()->delete('resources', ['resource_id' => $this->resourceId])->execute();
        }
        if ($this->submissionId) {
            $db->createCommand()->delete('submission_publication_state', [
                'item_kind' => 'new', 'item_id' => $this->itemId,
            ])->execute();
            TestSubmissionFixture::delete($this->uuid);
        }
        if ($this->offeringId) {
            $db->createCommand()->delete('course_offerings', ['offering_id' => $this->offeringId])->execute();
        }
        if ($this->courseId) {
            $db->createCommand()->delete('courses', ['course_id' => $this->courseId])->execute();
        }
    }

    public function testUpgradePartialFailureRerunAndDownPreserveExistingData(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $this->createPreservationFixtures();

            // Model an interrupted DDL migration with only a subset of its columns present.
            MigrationRollback::addColumn('resources', 'assigned_pages', 'TEXT NULL');
            MigrationRollback::addColumn('physical_resource_references', 'public_note', 'TEXT NULL');
            MigrationRollback::migrate('up');
            $db->schema->refresh();

            $this->assertDestinationColumnsAndDefaults();
            $this->assertExistingDataWasPreserved();

            // Reapplying an already completed migration must be safe and must not reset API-105 state.
            $db->createCommand()->delete('migration', ['version' => $this->migrationVersion])->execute();
            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertDestinationColumnsAndDefaults();
            $this->assertExistingDataWasPreserved();

            MigrationRollback::migrate('down');
            $db->schema->refresh();
            Assert::assertArrayNotHasKey(
                'assigned_pages', $db->schema->getTableSchema('resources', true)->columns
            );
            foreach (['public_note', 'assigned_pages', 'start_visibility', 'end_visibility', 'use_visibility'] as $column) {
                Assert::assertArrayNotHasKey(
                    $column,
                    $db->schema->getTableSchema('physical_resource_references', true)->columns,
                    'Down should remove only API-114 destination columns.'
                );
            }
            Assert::assertArrayHasKey('external_note', $db->schema->getTableSchema('resources', true)->columns);
            Assert::assertArrayHasKey('folio_instance_id', $db->schema->getTableSchema('physical_resource_references', true)->columns);
            $this->assertExistingDataWasPreserved();
        });
    }

    private function createPreservationFixtures()
    {
        $db = \Yii::$app->db;
        $this->uuid = $this->uuid();
        $this->submissionId = TestSubmissionFixture::create($this->uuid, $this->prefix . 'faculty', [
            'term_code' => 'Fall 2027',
            'course_code' => 'TST 114-' . substr(str_replace('-', '', $this->uuid), 0, 8),
            'section' => '01',
            'course_title' => $this->prefix . 'preserve',
            'submitted_at' => '2026-10-01 12:00:00',
            'link_state' => 'linked',
        ]);
        $this->itemId = (int)$db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $this->submissionId]
        )->queryScalar();
        $snapshot = json_encode([
            'eds' => ['an' => 'scf.oai.synthetic.folio.ebsco.com.fs00001114.00000000.0000.4000.8000.000000000114'],
            'title' => 'Synthetic frozen v1 title',
        ], JSON_UNESCAPED_SLASHES);
        $db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $this->materialTypeId('ebook'),
            'source_snapshot_json' => $snapshot,
        ], ['id' => $this->itemId])->execute();

        $db->createCommand()->insert('submission_publication_state', [
            'item_kind' => 'new',
            'item_id' => $this->itemId,
            'submission_id' => $this->submissionId,
            'state' => 'ready',
            'draft_revision' => 7,
            'published_revision' => 5,
            'pending_changes' => 'pending',
            'readiness_source' => 'manual',
            'readiness_reason' => 'Synthetic preserved readiness',
            'readiness_revision' => 7,
            'readiness_context_json' => json_encode(['finish_state' => 'available_online']),
            'published_destination_json' => json_encode(['kind' => 'electronic', 'resource_id' => 114001]),
            'published_snapshot' => json_encode(['resource' => ['name' => 'Synthetic live title']]),
            'reconciliation_status' => 'verified',
            'reconciliation_reason' => 'Synthetic preserved reconciliation',
        ])->execute();

        $db->createCommand()->insert('resources', [
            'name' => 'Synthetic preserved live resource',
            'external_note' => 'Synthetic live public note',
            'item_url' => 'https://live.example.test/api114',
        ])->execute();
        $this->resourceId = (int)$db->getLastInsertID();
        $db->createCommand()->update('submission_new_resources', [
            'source_resource_id' => (string)$this->resourceId,
            'materialized_resource_id' => 114001,
            'materialized_course_resource_id' => 114002,
            'materialized_physical_reference_id' => 114003,
        ], ['id' => $this->itemId])->execute();
        $db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $this->submissionId,
            'source_resource_id' => $this->resourceId,
            'material_type_id' => $this->materialTypeId('ebook'),
            'source_snapshot_json' => json_encode([
                'eds' => ['an' => 'Synthetic reuse EDS identity'],
                'title' => 'Synthetic frozen reuse title',
            ], JSON_UNESCAPED_SLASHES),
            'item_status' => 'pending',
        ])->execute();

        $this->courseId = $this->insertCourse();
        $this->offeringId = $this->insertOffering($this->courseId);
        $db->createCommand()->insert('physical_resource_references', [
            'external_resource_id' => 'API114-MIGRATION-BARCODE',
            'folio_instance_id' => '00000000-0000-4000-8000-000000000114',
            'legacy_identifier' => 'API114-MIGRATION-BARCODE',
            'legacy_identifier_type' => 'barcode',
            'identity_status' => 'verified',
            'identity_provenance_json' => json_encode([
                'evidence_source' => 'resource_data.eds.an',
                'outcome' => 'verified',
            ]),
            'resource_type' => 'physical',
            'display_name' => 'Synthetic preserved physical destination',
            'offering_id' => $this->offeringId,
            'order' => 4,
        ])->execute();
        $this->referenceId = (int)$db->getLastInsertID();
    }

    private function assertDestinationColumnsAndDefaults()
    {
        $db = \Yii::$app->db;
        $resources = $db->schema->getTableSchema('resources', true)->columns;
        $physical = $db->schema->getTableSchema('physical_resource_references', true)->columns;

        Assert::assertSame('mediumtext', strtolower($resources['external_note']->dbType));
        Assert::assertTrue($resources['external_note']->allowNull);
        Assert::assertSame('text', strtolower($resources['assigned_pages']->dbType));
        Assert::assertTrue($resources['assigned_pages']->allowNull);
        Assert::assertNull($resources['assigned_pages']->defaultValue);
        Assert::assertSame('text', strtolower($physical['public_note']->dbType));
        Assert::assertSame('text', strtolower($physical['assigned_pages']->dbType));
        Assert::assertTrue($physical['public_note']->allowNull);
        Assert::assertTrue($physical['assigned_pages']->allowNull);
        Assert::assertNull($physical['public_note']->defaultValue);
        Assert::assertNull($physical['assigned_pages']->defaultValue);
        Assert::assertSame('date', strtolower($physical['start_visibility']->dbType));
        Assert::assertSame('date', strtolower($physical['end_visibility']->dbType));
        Assert::assertTrue($physical['start_visibility']->allowNull);
        Assert::assertTrue($physical['end_visibility']->allowNull);
        Assert::assertNull($physical['start_visibility']->defaultValue);
        Assert::assertNull($physical['end_visibility']->defaultValue);
        Assert::assertSame(0, (int)$physical['use_visibility']->defaultValue);
        Assert::assertFalse($physical['use_visibility']->allowNull);
        Assert::assertSame(0, (int)$db->createCommand(
            'SELECT use_visibility FROM physical_resource_references WHERE reference_id = :id',
            [':id' => $this->referenceId]
        )->queryScalar());
    }

    private function assertExistingDataWasPreserved()
    {
        $db = \Yii::$app->db;
        $item = $db->createCommand(
            'SELECT id, material_type_id, source_resource_id, source_snapshot_json, '
            . 'materialized_resource_id, materialized_course_resource_id, '
            . 'materialized_physical_reference_id FROM submission_new_resources WHERE id = :id',
            [':id' => $this->itemId]
        )->queryOne();
        $snapshot = json_decode($item['source_snapshot_json'], true);
        Assert::assertSame(1, $snapshot['version']);
        Assert::assertSame('Synthetic frozen v1 title', $snapshot['title']);
        Assert::assertArrayHasKey('eds', $snapshot);
        Assert::assertSame('114001', (string)$item['materialized_resource_id']);
        Assert::assertSame('114002', (string)$item['materialized_course_resource_id']);
        Assert::assertSame('114003', (string)$item['materialized_physical_reference_id']);

        $reuse = $db->createCommand(
            'SELECT id, source_resource_id, material_type_id, source_snapshot_json '
            . 'FROM submission_reuse_resources WHERE submission_id = :id LIMIT 1',
            [':id' => $this->submissionId]
        )->queryOne();
        $reuseSnapshot = json_decode($reuse['source_snapshot_json'], true);
        Assert::assertSame(1, $reuseSnapshot['version']);
        Assert::assertSame('Synthetic frozen reuse title', $reuseSnapshot['title']);
        Assert::assertSame('Synthetic reuse EDS identity', $reuseSnapshot['eds']['an']);
        $this->assertVersionOneCopyInputBlockerBoundaries($item, $reuse);

        $state = $db->createCommand(
            'SELECT state, draft_revision, published_revision, readiness_source, readiness_reason, '
            . 'readiness_revision, published_snapshot FROM submission_publication_state '
            . 'WHERE item_kind = "new" AND item_id = :id',
            [':id' => $this->itemId]
        )->queryOne();
        Assert::assertSame('ready', $state['state']);
        Assert::assertSame(7, (int)$state['draft_revision']);
        Assert::assertSame(5, (int)$state['published_revision']);
        Assert::assertSame('manual', $state['readiness_source']);
        Assert::assertSame('Synthetic preserved readiness', $state['readiness_reason']);
        Assert::assertSame(7, (int)$state['readiness_revision']);
        Assert::assertSame('Synthetic live title', json_decode($state['published_snapshot'], true)['resource']['name']);

        $resource = $db->createCommand(
            'SELECT external_note FROM resources WHERE resource_id = :id', [':id' => $this->resourceId]
        )->queryScalar();
        Assert::assertSame('Synthetic live public note', $resource);
        $reference = $db->createCommand(
            'SELECT external_resource_id, folio_instance_id, legacy_identifier, identity_status, '
            . 'identity_provenance_json FROM physical_resource_references WHERE reference_id = :id',
            [':id' => $this->referenceId]
        )->queryOne();
        Assert::assertSame('API114-MIGRATION-BARCODE', $reference['external_resource_id']);
        Assert::assertSame('00000000-0000-4000-8000-000000000114', $reference['folio_instance_id']);
        Assert::assertSame('API114-MIGRATION-BARCODE', $reference['legacy_identifier']);
        Assert::assertSame('verified', $reference['identity_status']);
        Assert::assertSame('resource_data.eds.an', json_decode($reference['identity_provenance_json'], true)['evidence_source']);
    }

    private function assertVersionOneCopyInputBlockerBoundaries(array $new, array $reuse)
    {
        $projection = new \app\services\SubmissionInputProjection();
        $newElectronic = $projection->project('new', $new, 'ebook', null, true);
        $reuseElectronic = $projection->project('reuse', $reuse, 'ebook', null, true);
        $reusePrint = $projection->project('reuse', $reuse, 'book', null, true);
        $sourceLessElectronic = $new;
        $sourceLessElectronic['source_resource_id'] = null;
        $sourceLess = $projection->project('new', $sourceLessElectronic, 'ebook', null, true);

        Assert::assertContains('copy_inputs_incomplete', $newElectronic['blockers']);
        Assert::assertContains('copy_inputs_incomplete', $reuseElectronic['blockers']);
        Assert::assertNotContains('copy_inputs_incomplete', $reusePrint['blockers']);
        Assert::assertNotContains('copy_inputs_incomplete', $sourceLess['blockers']);
    }

    private function materialTypeId($name)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE LOWER(name) = :name LIMIT 1',
            [':name' => $name]
        )->queryScalar();
    }

    private function insertCourse()
    {
        $db = \Yii::$app->db;
        $uuid = $this->uuid();
        $db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $uuid,
            'course_name' => $this->prefix . 'course',
            'course_number' => 'TST-114-' . substr(str_replace('-', '', $uuid), 0, 8),
        ])->execute();
        return (int)$db->getLastInsertID();
    }

    private function insertOffering($courseId)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $courseId,
            'folio_course_id' => 'api114-listing-' . bin2hex(random_bytes(3)),
            'term_id' => 'api114-term-' . bin2hex(random_bytes(3)),
            'term_name' => 'Synthetic API-114 term',
            'section_name' => '01',
        ])->execute();
        return (int)$db->getLastInsertID();
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
