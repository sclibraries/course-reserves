<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationBackfillCest extends Api116ADestinationMigrationTestBase
{
    public function testBackfillReportsEveryOutcomeAndAttachesAllThreeItemRepresentations(FunctionalTester $I)
    {
        MigrationRollback::withTargetDown($this->migrationVersion, function () {
            $db = \Yii::$app->db;
            $offering = $this->fixtures->createOffering('backfill-one');
            $otherOffering = $this->fixtures->createOffering('backfill-other');
            $electronic = $this->fixtures->createElectronicDestination($offering, 'backfill-shared');
            $otherElectronic = $this->fixtures->createElectronicDestination($otherOffering, 'backfill-other');
            $unmarkedStaffEntry = $this->fixtures->createElectronicDestination($offering, 'direct-staff-entry');
            $uuidSourceDecoy = $this->fixtures->createElectronicDestination($offering, 'uuid-source-decoy');
            $instanceId = '00000000-0000-4000-8000-000000001161';
            $physical = $this->fixtures->createPhysicalDestination($offering, 'verified', $instanceId);
            $unverifiedPhysical = $this->fixtures->createPhysicalDestination(
                $offering,
                'unverified',
                '00000000-0000-4000-8000-000000001162',
                'unverified'
            );
            $ambiguousInstance = '00000000-0000-4000-8000-000000001163';
            $ambiguousPhysical = $this->fixtures->createPhysicalDestination(
                $offering,
                'ambiguous-one',
                $ambiguousInstance
            );
            $ambiguousPhysicalDuplicate = $this->fixtures->createPhysicalDestination(
                $offering,
                'ambiguous-two',
                $ambiguousInstance
            );

            $originalNewAutoIncrement = $this->autoIncrement('submission_new_resources');
            $originalReuseAutoIncrement = $this->autoIncrement('submission_reuse_resources');
            $sharedItemId = max($originalNewAutoIncrement, $originalReuseAutoIncrement) + 100;
            $newItem = $this->fixtures->createItem('same-id-new', $offering);
            $this->replaceItemId($newItem, $sharedItemId);
            $newItem['id'] = $sharedItemId;
            $newTableReuse = $this->fixtures->createItem('new-table-reuse', $offering, 'new_table_reuse');
            $this->replaceItemId($newTableReuse, $sharedItemId + 2);
            $newTableReuse['id'] = $sharedItemId + 2;
            $legacyReuse = $this->fixtures->createItem('same-id-legacy-reuse', $offering, 'legacy_reuse');
            $this->replaceItemId($legacyReuse, $sharedItemId);
            $legacyReuse['id'] = $sharedItemId;

            foreach ([$newItem, $newTableReuse, $legacyReuse] as $item) {
                $this->fixtures->setMarkers($item, [
                    'materialized_resource_id' => $electronic['resource_id'],
                    'materialized_course_resource_id' => $electronic['course_resource_id'],
                    'materialized_at' => '2026-10-01 12:00:00',
                ]);
            }

            $physicalItem = $this->fixtures->createItem('physical-verified', $offering);
            $this->setIdentity($physicalItem, $instanceId);
            $this->fixtures->setMarkers($physicalItem, [
                'materialized_physical_reference_id' => $physical['physical_reference_id'],
            ]);
            $unverifiedItem = $this->fixtures->createItem('physical-unverified', $offering, 'legacy_reuse');
            $this->setIdentity($unverifiedItem, '00000000-0000-4000-8000-000000001162');
            $this->fixtures->setMarkers($unverifiedItem, [
                'materialized_physical_reference_id' => $unverifiedPhysical['physical_reference_id'],
            ]);
            $ambiguousItem = $this->fixtures->createItem('physical-ambiguous', $offering);
            $this->setIdentity($ambiguousItem, $ambiguousInstance);
            $this->fixtures->setMarkers($ambiguousItem, [
                'materialized_physical_reference_id' => $ambiguousPhysical['physical_reference_id'],
            ]);

            $missing = $this->fixtures->createItem('missing-entry', $offering);
            $this->fixtures->setMarkers($missing, [
                'materialized_resource_id' => 2147483000,
                'materialized_course_resource_id' => 2147483000,
            ]);
            $mismatch = $this->fixtures->createItem('mismatch', $offering);
            $this->fixtures->setMarkers($mismatch, [
                'materialized_resource_id' => $electronic['resource_id'] + 1,
                'materialized_course_resource_id' => $electronic['course_resource_id'],
            ]);
            $wrongOffering = $this->fixtures->createItem('other-offering', $offering);
            $this->fixtures->setMarkers($wrongOffering, [
                'materialized_resource_id' => $otherElectronic['resource_id'],
                'materialized_course_resource_id' => $otherElectronic['course_resource_id'],
            ]);
            $conflict = $this->fixtures->createItem('conflict-markers', $offering);
            $this->fixtures->setMarkers($conflict, [
                'materialized_resource_id' => $electronic['resource_id'],
                'materialized_course_resource_id' => $electronic['course_resource_id'],
                'materialized_physical_reference_id' => $physical['physical_reference_id'],
            ]);
            $incomplete = $this->fixtures->createItem('incomplete-marker', $offering);
            $this->fixtures->setMarkers($incomplete, ['materialized_resource_id' => $electronic['resource_id']]);
            $metadataOnly = $this->fixtures->createItem('metadata-only-marker', $offering);
            $this->fixtures->setMarkers($metadataOnly, [
                'materialized_at' => '2026-10-01 12:05:00',
                'materialized_by_staff_id' => 'synthetic-api116a-staff',
            ]);
            $noOffering = $this->fixtures->createItem('no-offering', null);
            $this->fixtures->setMarkers($noOffering, [
                'materialized_resource_id' => $electronic['resource_id'],
                'materialized_course_resource_id' => $electronic['course_resource_id'],
            ]);
            $noMarker = $this->fixtures->createItem('no-marker', $offering);

            $db->createCommand()->update('submission_new_resources', [
                'source_resource_id' => $uuidSourceDecoy['resource_id'] . '-f8c0-4000-8000-000000001164',
                'source_snapshot_json' => json_encode([
                    'version' => 1,
                    'title' => 'Synthetic frozen source snapshot',
                ]),
                'updated_at' => '2026-10-01 12:10:00',
            ], ['id' => $newItem['id']])->execute();
            $markerItems = [
                $newItem, $newTableReuse, $legacyReuse, $physicalItem, $unverifiedItem, $ambiguousItem,
                $missing, $mismatch, $wrongOffering, $conflict, $incomplete, $metadataOnly, $noOffering, $noMarker,
            ];
            $beforeItems = [];
            foreach ($markerItems as $item) {
                $beforeItems[] = $this->fixtures->itemRow($item);
            }
            $beforePhysical = $this->physicalIdentity($physical['physical_reference_id']);
            $beforeAmbiguous = [
                $this->physicalIdentity($ambiguousPhysical['physical_reference_id']),
                $this->physicalIdentity($ambiguousPhysicalDuplicate['physical_reference_id']),
            ];
            $beforePhysicalContent = $this->physicalContent($physical['physical_reference_id']);
            $beforeElectronicContent = $this->electronicLiveContent($electronic);
            $this->assertMigrationNotApplied();

            $output = MigrationRollback::migrate('up');
            $db->schema->refresh();
            $this->assertRegistrySchema();
            $this->assertReportedCategoryCounts($output, [
                'attached' => 4,
                'missing_entry' => 1,
                'mismatch' => 1,
                'other_offering' => 1,
                'unresolved' => 1,
                'ambiguous' => 1,
                'conflict' => 1,
                'incomplete' => 2,
                'no_offering' => 1,
            ]);

            foreach ([$newItem, $newTableReuse, $legacyReuse] as $item) {
                $this->assertLiveAttachment($item, $electronic, 'electronic');
            }
            Assert::assertSame($newItem['id'], $legacyReuse['id']);
            Assert::assertNotFalse($this->attachmentRow($legacyReuse), 'Equal ids remain distinct by item_kind.');
            $this->assertLiveAttachment($physicalItem, $physical, 'physical');
            $physicalSnapshot = $this->snapshot($physicalItem);
            Assert::assertSame('physical', $physicalSnapshot['destination_kind']);
            Assert::assertSame($physical['physical_reference_id'], $physicalSnapshot['physical_reference_id']);
            Assert::assertSame('test-api116a-migration-live physical verified', $physicalSnapshot['display_name']);
            Assert::assertSame('test-api116a-migration-barcode-verified', $physicalSnapshot['external_resource_id']);
            Assert::assertSame($instanceId, $physicalSnapshot['folio_instance_id']);
            Assert::assertArrayNotHasKey('identity_provenance_json', $physicalSnapshot);
            $this->assertNoAttachment($unverifiedItem, 'Unverified physical identity is unresolved.');
            $this->assertNoAttachment($ambiguousItem, 'Duplicate verified canonical rows are not merged.');
            $this->assertNoAttachment($missing, 'Missing electronic entry is reported without rewriting its marker.');
            $this->assertNoAttachment($mismatch, 'Mismatched resource and course-resource markers are reported.');
            $this->assertNoAttachment($wrongOffering, 'A live entry from another offering is never attached.');
            $this->assertNoAttachment($conflict, 'Both destination marker kinds are reported as a conflict.');
            $this->assertNoAttachment($incomplete, 'A partial electronic marker is incomplete.');
            $this->assertNoAttachment($metadataOnly, 'Metadata-only materialization markers are incomplete.');
            $this->assertNoAttachment($noOffering, 'An item without an offering is not attached.');
            $this->assertNoAttachment($noMarker, 'An item without markers is ignored.');
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM publication_destinations WHERE course_resource_id = :id',
                [':id' => $unmarkedStaffEntry['course_resource_id']]
            )->queryScalar(), 'A direct staff entry remains unowned when no item marker points to it.');
            $electronicDestinationId = $this->destinationIdForCourseResource($electronic['course_resource_id']);
            $electronicRegistryRow = $db->createCommand(
                'SELECT owner_item_kind, owner_item_id, owner_live, ownership_source '
                . 'FROM publication_destinations WHERE id = :id',
                [':id' => $electronicDestinationId]
            )->queryOne();
            Assert::assertSame([
                'owner_item_kind' => null,
                'owner_item_id' => null,
                'owner_live' => null,
                'ownership_source' => 'none',
            ], $electronicRegistryRow, 'Backfill creates attachments without inferring ownership.');
            Assert::assertSame(0, (int)$db->createCommand(
                'SELECT COUNT(*) FROM publication_destinations WHERE physical_reference_id = :id',
                [':id' => $unverifiedPhysical['physical_reference_id']]
            )->queryScalar(), 'An unresolved physical row does not get a registry row.');
            foreach ($markerItems as $index => $item) {
                Assert::assertSame($beforeItems[$index], $this->fixtures->itemRow($item));
            }
            Assert::assertSame($beforePhysical, $this->physicalIdentity($physical['physical_reference_id']));
            Assert::assertSame($beforeAmbiguous, [
                $this->physicalIdentity($ambiguousPhysical['physical_reference_id']),
                $this->physicalIdentity($ambiguousPhysicalDuplicate['physical_reference_id']),
            ], 'Ambiguous canonical rows are preserved separately and are never merged.');
            Assert::assertSame($ambiguousInstance, $beforeAmbiguous[0]['folio_instance_id']);
            Assert::assertSame($ambiguousInstance, $beforeAmbiguous[1]['folio_instance_id']);
            Assert::assertSame(
                $beforePhysicalContent,
                $this->physicalContent($physical['physical_reference_id']),
                'Backfill preserves physical live content and timestamps.'
            );
            Assert::assertSame(
                $beforeElectronicContent,
                $this->electronicLiveContent($electronic),
                'Backfill preserves electronic content and timestamps.'
            );
            $this->assertElectronicSnapshotUsesLiveContent($newItem, $electronic);
            $electronicSnapshot = $this->snapshot($newItem);
            Assert::assertSame('Synthetic public metadata backfill-shared', $electronicSnapshot['metadata'][0]['field_value']);
            Assert::assertSame('Synthetic public link backfill-shared', $electronicSnapshot['links'][0]['title']);
        });
    }
}
