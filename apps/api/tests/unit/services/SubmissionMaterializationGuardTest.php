<?php

namespace tests\unit\services;

use app\services\SubmissionMaterializationGuard;

class SubmissionMaterializationGuardTest extends \Codeception\Test\Unit
{
    public function testUnchangedMaterializedItemIsAllowedWhenNestedJsonKeyOrderAndIdTypesDiffer()
    {
        $existing = $this->existingItem([
            'resource_data' => json_encode([
                'title' => 'Climate search result',
                'authors' => 'A. Scholar',
                'materialType' => 'article',
                'resource_id' => 314,
                'citation' => ['z' => 'last', 'a' => 'first'],
            ]),
        ]);
        $incoming = $this->incomingItem([
            'resource_data' => [
                'citation' => ['a' => 'first', 'z' => 'last'],
                'resource_id' => '314',
                'materialType' => 'article',
                'authors' => 'A. Scholar',
                'title' => 'Climate search result',
            ],
        ]);

        $changedIds = $this->guard()->changedMaterializedItemIds(
            [$existing],
            [$incoming],
            ['folder-science' => 'Science']
        );

        $this->assertSame([], $changedIds);
    }

    public function testStoredIntegerFieldsMatchNumericRequestValues()
    {
        $existing = $this->existingItem([
            'display_order' => '1',
            'position_in_folder' => '2',
        ]);

        $this->assertSame([], $this->guard()->changedMaterializedItemIds(
            [$existing],
            [$this->incomingItem(['display_order' => 1, 'position_in_folder' => 2])],
            ['folder-science' => 'Science']
        ));
    }

    public function testChangedResourceMetadataIsBlocked()
    {
        $incoming = $this->incomingItem([
            'resource_data' => ['doi' => '10.1000/changed'],
        ]);

        $this->assertSame([42], $this->guard()->changedMaterializedItemIds(
            [$this->existingItem()],
            [$incoming],
            ['folder-science' => 'Science']
        ));
    }

    public function testChangedDisplayOrderIsBlocked()
    {
        $this->assertSame([42], $this->guard()->changedMaterializedItemIds(
            [$this->existingItem()],
            [$this->incomingItem(['display_order' => 9])],
            ['folder-science' => 'Science']
        ));
    }

    public function testChangedFolderIsBlocked()
    {
        $this->assertSame([42], $this->guard()->changedMaterializedItemIds(
            [$this->existingItem()],
            [$this->incomingItem(['folder_uuid' => 'folder-history'])],
            [
                'folder-science' => 'Science',
                'folder-history' => 'History',
            ]
        ));
    }

    public function testChangedPositionNotesBarcodeAndCallNumberAreBlocked()
    {
        $changes = [
            ['position_in_folder' => 7],
            ['faculty_notes' => 'Changed note'],
            ['barcode' => '39088000000999'],
            ['call_number' => 'QA 77'],
        ];

        foreach ($changes as $change) {
            $this->assertSame([42], $this->guard()->changedMaterializedItemIds(
                [$this->existingItem()],
                [$this->incomingItem($change)],
                ['folder-science' => 'Science']
            ), key($change));
        }
    }

    public function testAnyDuplicateEntryThatChangesMaterializedItemIsBlocked()
    {
        $this->assertSame([42], $this->guard()->changedMaterializedItemIds(
            [$this->existingItem()],
            [
                $this->incomingItem(['title' => 'Changed title']),
                $this->incomingItem(),
            ],
            ['folder-science' => 'Science']
        ));
    }

    public function testOmittingMaterializedItemIsBlocked()
    {
        $this->assertSame([42], $this->guard()->changedMaterializedItemIds(
            [$this->existingItem()],
            [],
            ['folder-science' => 'Science']
        ));
    }

    public function testChangedOrOmittedUnprocessedItemsAreUnrestricted()
    {
        $unprocessed = $this->existingItem([
            'materialized_resource_id' => null,
            'materialized_course_resource_id' => null,
            'materialized_physical_reference_id' => null,
            'materialized_folder_id' => null,
            'materialized_by_staff_id' => null,
            'materialized_at' => null,
        ]);

        $this->assertSame([], $this->guard()->changedMaterializedItemIds(
            [$unprocessed],
            [$this->incomingItem(['title' => 'Edited unprocessed item'])],
            ['folder-science' => 'Science']
        ));
        $this->assertSame([], $this->guard()->changedMaterializedItemIds(
            [$unprocessed],
            [],
            []
        ));
    }

    public function testEveryMaterializationMarkerProtectsAnOmittedItem()
    {
        $markers = [
            'materialized_resource_id' => 91,
            'materialized_course_resource_id' => 92,
            'materialized_physical_reference_id' => 93,
            'materialized_folder_id' => 94,
            'materialized_by_staff_id' => 'test-api033-staff',
            'materialized_at' => '2026-10-14 12:00:00',
        ];

        foreach ($markers as $field => $value) {
            $item = $this->existingItem([
                'materialized_resource_id' => null,
                'materialized_course_resource_id' => null,
                'materialized_physical_reference_id' => null,
                'materialized_folder_id' => null,
                'materialized_by_staff_id' => null,
                'materialized_at' => null,
                $field => $value,
            ]);

            $this->assertSame([42], $this->guard()->changedMaterializedItemIds([$item], [], []), $field);
        }
    }

    public function testFolderDeletionWithoutItemsPayloadDetectsFolderMutation()
    {
        $guard = $this->guard();
        $item = $this->existingItem();
        $incoming = $guard->incomingItemsAfterFolderUpdate([$item], [
            ['folder_name' => 'History'],
        ]);

        $this->assertSame([42], $guard->changedMaterializedItemIds([$item], $incoming, []));
    }

    public function testFolderUuidMapUsesTheNamesAcceptedByFolderUpdates()
    {
        $this->assertSame(
            ['folder-science' => 'Science', 'folder-history' => 'History'],
            SubmissionMaterializationGuard::folderUuidToNameMap([
                ['folder_uuid' => 'folder-science', 'folder_name' => 'Science'],
                ['id' => 'folder-history', 'name' => 'History'],
                ['folder_uuid' => 'folder-invalid', 'folder_name' => ''],
            ])
        );
    }

    public function testMissingMaterialTypeDoesNotBecomeBookDuringFacultyUpdate()
    {
        $updated = SubmissionMaterializationGuard::buildUpdatedResourceData(['title' => 'Untyped'], []);

        $this->assertArrayNotHasKey('materialType', $updated);
    }

    private function guard()
    {
        return new SubmissionMaterializationGuard();
    }

    private function existingItem(array $overrides = [])
    {
        return array_merge([
            'id' => 42,
            'resource_data' => json_encode([
                'title' => 'Climate search result',
                'authors' => 'A. Scholar',
                'materialType' => 'article',
                'doi' => '10.1000/original',
                'resource_id' => 314,
                'citation' => ['a' => 'first', 'z' => 'last'],
            ]),
            'display_order' => 1,
            'folder_name' => 'Science',
            'position_in_folder' => 2,
            'faculty_notes' => 'Faculty note',
            'source_barcode' => '39088000000123',
            'source_call_number' => 'QA 76.9',
            'materialized_resource_id' => null,
            'materialized_course_resource_id' => 77,
            'materialized_physical_reference_id' => null,
            'materialized_folder_id' => null,
            'materialized_by_staff_id' => 'test-api033-staff',
            'materialized_at' => '2026-10-14 12:00:00',
        ], $overrides);
    }

    private function incomingItem(array $overrides = [])
    {
        return array_merge([
            'item_uuid' => '42',
            'title' => 'Climate search result',
            'authors' => 'A. Scholar',
            'material_type' => 'article',
            'resource_data' => [
                'doi' => '10.1000/original',
                'resource_id' => 314,
                'citation' => ['a' => 'first', 'z' => 'last'],
            ],
            'display_order' => 1,
            'folder_uuid' => 'folder-science',
            'position_in_folder' => 2,
            'faculty_notes' => 'Faculty note',
            'barcode' => '39088000000123',
            'call_number' => 'QA 76.9',
        ], $overrides);
    }
}
