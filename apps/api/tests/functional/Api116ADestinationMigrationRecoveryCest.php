<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationMigrationRecoveryCest extends Api116ADestinationMigrationTestBase
{
    public function testPartialDdlApplyRerunAndDownPreserveExistingRegistryRows(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $offering = $this->fixtures->createOffering('partial');
            $item = $this->fixtures->createItem('partial-item', $offering);
            $destination = $this->fixtures->createElectronicDestination($offering, 'partial-live');
            $this->fixtures->setMarkers($item, [
                'materialized_resource_id' => $destination['resource_id'],
                'materialized_course_resource_id' => $destination['course_resource_id'],
            ]);
            $physical = $this->fixtures->createPhysicalDestination(
                $offering,
                'partial-physical',
                '00000000-0000-4000-8000-000000001165'
            );
            $beforeItem = $this->fixtures->itemRow($item);
            $beforeElectronicContent = $this->electronicLiveContent($destination);
            $beforePhysicalIdentity = $this->physicalIdentity($physical['physical_reference_id']);
            $beforePhysicalContent = $this->physicalContent($physical['physical_reference_id']);
            $db->createCommand()->insert('submission_publication_state', [
                'item_kind' => $item['kind'],
                'item_id' => $item['id'],
                'submission_id' => $item['submission_id'],
                'state' => 'ready',
                'draft_revision' => 9,
                'readiness_source' => 'manual',
                'readiness_reason' => 'Synthetic partial-apply readiness',
                'readiness_revision' => 9,
            ])->execute();
            $beforeState = $db->createCommand(
                'SELECT * FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryOne();
            $this->createPartiallyAppliedTables();
            $db->createCommand()->insert('publication_destinations', [
                'destination_kind' => 'electronic',
                'course_resource_id' => $destination['course_resource_id'],
                'physical_reference_id' => null,
                'offering_id' => $offering,
                'origin_offering_id' => $offering,
                'owner_item_kind' => null,
                'owner_item_id' => null,
                'owner_live' => null,
                'ownership_source' => 'none',
                'created_at' => '2026-10-03 10:00:00',
                'updated_at' => '2026-10-03 10:00:01',
                'retired_at' => null,
            ])->execute();
            $destinationId = (int)$db->getLastInsertID();
            $db->createCommand()->insert('publication_attachments', [
                'destination_id' => $destinationId,
                'item_kind' => $item['kind'],
                'item_id' => $item['id'],
                'attached_snapshot_json' => '{"destination_kind":"electronic","name":"Synthetic old snapshot"}',
                'live' => null,
                'attached_at' => '2026-10-03 10:00:02',
                'updated_at' => '2026-10-03 10:00:03',
                'detached_at' => '2026-10-03 10:00:04',
            ])->execute();
            $beforeDestination = $db->createCommand(
                'SELECT * FROM publication_destinations WHERE id = :id', [':id' => $destinationId]
            )->queryOne();
            $beforeAttachment = $db->createCommand(
                'SELECT * FROM publication_attachments WHERE destination_id = :id',
                [':id' => $destinationId]
            )->queryOne();
            $this->assertMigrationNotApplied();

            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertRegistrySchema();
            Assert::assertSame($beforeState, $db->createCommand(
                'SELECT * FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryOne());
            Assert::assertSame($beforeDestination, $db->createCommand(
                'SELECT * FROM publication_destinations WHERE id = :id', [':id' => $destinationId]
            )->queryOne());
            Assert::assertSame($beforeAttachment, $db->createCommand(
                'SELECT * FROM publication_attachments WHERE destination_id = :id',
                [':id' => $destinationId]
            )->queryOne());

            $db->createCommand()->delete('migration', ['version' => $this->migrationVersion])->execute();
            MigrationRollback::migrate('up');
            $db->schema->refresh();
            Assert::assertSame($beforeState, $db->createCommand(
                'SELECT * FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryOne());
            Assert::assertSame($beforeDestination, $db->createCommand(
                'SELECT * FROM publication_destinations WHERE id = :id', [':id' => $destinationId]
            )->queryOne());
            Assert::assertSame($beforeAttachment, $db->createCommand(
                'SELECT * FROM publication_attachments WHERE destination_id = :id',
                [':id' => $destinationId]
            )->queryOne());
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM publication_attachments WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryScalar(), 'Rerun skips any item that already has live or detached attachment history.');

            MigrationRollback::migrate('down');
            $db->schema->refresh();
            Assert::assertNull($db->schema->getTableSchema('publication_attachments', true));
            Assert::assertNull($db->schema->getTableSchema('publication_destinations', true));
            Assert::assertSame(
                $this->fixtures->electronicResourceName('partial-live'),
                $this->resourceContent($destination['resource_id'])['name']
            );
            Assert::assertSame($beforeItem, $this->fixtures->itemRow($item));
            Assert::assertSame($beforeElectronicContent, $this->electronicLiveContent($destination));
            Assert::assertSame($beforePhysicalIdentity, $this->physicalIdentity($physical['physical_reference_id']));
            Assert::assertSame($beforePhysicalContent, $this->physicalContent($physical['physical_reference_id']));
            Assert::assertSame($item['id'], (int)$db->createCommand(
                'SELECT id FROM submission_new_resources WHERE id = :id', [':id' => $item['id']]
            )->queryScalar());
            Assert::assertSame($destination['course_resource_id'], (int)$db->createCommand(
                'SELECT materialized_course_resource_id FROM submission_new_resources WHERE id = :id',
                [':id' => $item['id']]
            )->queryScalar());
            Assert::assertSame(1, (int)$db->createCommand(
                'SELECT COUNT(*) FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryScalar(), 'Down drops only the two API-116A tables.');
            Assert::assertSame($beforeState, $db->createCommand(
                'SELECT * FROM submission_publication_state WHERE item_kind = :kind AND item_id = :id',
                [':kind' => $item['kind'], ':id' => $item['id']]
            )->queryOne());
        });
    }

    public function testPartialDdlApplyCreatesMissingAttachmentTableAndAddsMissingConstraints(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $offering = $this->fixtures->createOffering('partial-one-table');
            $destination = $this->fixtures->createElectronicDestination($offering, 'partial-one-table');
            $this->createPartiallyAppliedTables(false);
            $db->createCommand()->insert('publication_destinations', [
                'destination_kind' => 'electronic',
                'course_resource_id' => $destination['course_resource_id'],
                'physical_reference_id' => null,
                'offering_id' => $offering,
                'origin_offering_id' => $offering,
                'owner_item_kind' => null,
                'owner_item_id' => null,
                'owner_live' => null,
                'ownership_source' => 'none',
                'created_at' => '2026-10-05 10:00:00',
                'updated_at' => '2026-10-05 10:00:01',
                'retired_at' => null,
            ])->execute();
            $destinationId = (int)$db->getLastInsertID();
            $beforeDestination = $db->createCommand(
                'SELECT * FROM publication_destinations WHERE id = :id', [':id' => $destinationId]
            )->queryOne();

            MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertRegistrySchema();
            Assert::assertSame($beforeDestination, $db->createCommand(
                'SELECT * FROM publication_destinations WHERE id = :id', [':id' => $destinationId]
            )->queryOne());
            Assert::assertSame('BASE TABLE', $db->createCommand(
                'SELECT TABLE_TYPE FROM information_schema.TABLES '
                . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table',
                [':table' => 'publication_attachments']
            )->queryScalar());
        });
    }
}
