<?php

use app\models\FacultySubmission;
use app\services\FacultyItemRepresentation;

class FacultyItemRepresentationTest extends \Codeception\Test\Unit
{
    public function testMissingEvidenceFailsInsteadOfReturningAnUnlockedItem()
    {
        $this->expectException(\Throwable::class);
        $submission = new FacultySubmission([
            'status' => FacultySubmission::STATUS_SUBMITTED,
            'is_locked' => 0,
        ]);
        (new FacultyItemRepresentation(date('Y-m-d H:i:s', time() - 300)))->represent(
            $submission,
            [],
            ['new' => [$this->item(['id' => 17])]],
            []
        );
    }

    public function testRepresentsBothKindsWithOnlyFacultyFields()
    {
        $now = date('Y-m-d H:i:s', time() - 300);
        $submission = new FacultySubmission([
            'submission_id' => 7,
            'status' => FacultySubmission::STATUS_SUBMITTED,
            'is_locked' => 0,
        ]);
        $newItem = $this->item([
            'id' => 17,
            'display_order' => 4,
            'resource_data' => json_encode([
                'authors' => 'A Writer',
                'publisher' => 'Synthetic Press',
                'publicationYear' => '2025',
                'isbn' => '9780000000001',
                'issn' => '0000-0000',
                'doi' => '10.0000/synthetic',
                'edition' => '2',
                'oclcNumber' => '123456',
                'journal' => null,
                'journalTitle' => 'Must be cleared',
                'volume' => '3',
                'issue' => '4',
                'pages' => '10-20',
                'url' => 'https://example.test/item',
                'displayStartDate' => '2026-01-01',
                'displayEndDate' => '2026-12-31',
                'barcode' => 'data-barcode',
                'callNumber' => 'data-call-number',
                'eds' => [
                    'dbId' => 'eds-db',
                    'an' => 'eds-an',
                    'plink' => 'https://example.test/eds',
                    'extra' => 'private nested value',
                ],
                'instanceId' => 'instance-from-data',
                'instanceHrid' => 'instance-hrid',
                'holdingsId' => 'holdings-from-data',
                'chapterTitle' => 'Synthetic chapter',
                'copy' => 'Copy 2',
                'temporaryLocationId' => 'temporary-id',
                'permanentLocationId' => 'permanent-id',
                'temporaryLocationObject' => [
                    'id' => 'temporary-id', 'name' => 'Temporary', 'code' => 'TMP', 'extra' => 'private',
                ],
                'permanentLocationObject' => ['id' => 'permanent-id', 'name' => 'Permanent', 'code' => 'PER'],
            ]),
            'source_resource_id' => 'opaque:source-17',
            'source_folio_instance_id' => 'instance-from-source',
            'source_folio_holdings_id' => 'holdings-from-source',
            'source_resource_name' => 'Synthetic source title',
            'material_type_name' => 'Article',
        ]);
        $newReuseItem = $this->item([
            'id' => 21,
            'display_order' => 8,
            'folder_name' => 'Week 1',
            'position_in_folder' => 1,
            'is_reuse' => 1,
            'resource_data' => '{invalid json',
            'source_barcode' => 'new-table-barcode',
            'source_call_number' => 'new-table-call',
            'source_resource_id' => 'opaque:source-21',
            'source_folio_instance_id' => 'instance-from-source-21',
            'source_folio_holdings_id' => 'holdings-from-source-21',
            'assigned_pages' => 'pp. 2-4',
            'faculty_notes' => 'Faculty note',
            'material_type_name' => 'Chapter',
        ]);
        $reuseItem = $this->item([
            'id' => 21,
            'display_order' => 8,
            'folder_name' => 'Week 1',
            'position_in_folder' => 1,
            'source_resource_id' => 'opaque:reuse-21',
            'source_folio_instance_id' => 'reuse-instance-source',
            'source_folio_holdings_id' => 'reuse-holdings-source',
            'source_resource_name' => 'Synthetic reuse source',
            'material_type_name' => 'Book',
            'barcode' => 'reuse-barcode',
            'call_number' => 'reuse-call',
        ]);
        unset($reuseItem['resource_data'], $reuseItem['is_reuse']);
        $evidence = [
            'new' => [17 => $this->emptyEvidence(), 21 => $this->emptyEvidence()],
            'reuse' => [21 => [
                'open_run' => false,
                'publication_history' => true,
                'published' => true,
                'open_review' => false,
            ]],
        ];

        $actual = (new FacultyItemRepresentation($now))->represent(
            $submission,
            [
                ['folder_id' => 10, 'folder_name' => 'Week 1', 'display_order' => 2],
                ['folder_id' => 11, 'folder_name' => 'Week 1', 'display_order' => 1],
            ],
            ['new' => [$newItem, $newReuseItem], 'reuse' => [$reuseItem]],
            $evidence
        );

        $baseExpected = $this->expectedItem();
        $this->assertSame([
            'folders' => [
                ['folder_id' => 11, 'name' => 'Week 1', 'display_order' => 1, 'ambiguous' => true, 'items' => []],
                [
                    'folder_id' => 10,
                    'name' => 'Week 1',
                    'display_order' => 2,
                    'ambiguous' => true,
                    'items' => [
                        array_replace($baseExpected, [
                            'id' => 21,
                            'folder_id' => 10,
                            'folder_name' => 'Week 1',
                            'position' => 1,
                            'display_order' => 8,
                            'is_reuse' => true,
                            'title' => 'Untitled',
                            'material_type' => 'chapter',
                            'assignedPages' => 'pp. 2-4',
                            'faculty_notes' => 'Faculty note',
                            'barcode' => 'new-table-barcode',
                            'call_number' => 'new-table-call',
                            'source_resource_id' => 'opaque:source-21',
                            'source_folio_instance_id' => 'instance-from-source-21',
                            'instance_id' => 'instance-from-source-21',
                            'holdings_id' => 'holdings-from-source-21',
                            'capabilities' => ['edit' => true, 'delete' => true, 'move' => false, 'reorder' => false],
                        ]),
                        array_replace($baseExpected, [
                            'kind' => 'reuse',
                            'id' => 21,
                            'folder_id' => 10,
                            'folder_name' => 'Week 1',
                            'position' => 1,
                            'display_order' => 8,
                            'is_reuse' => true,
                            'title' => 'Synthetic reuse source',
                            'material_type' => 'book',
                            'barcode' => 'reuse-barcode',
                            'call_number' => 'reuse-call',
                            'source_resource_id' => 'opaque:reuse-21',
                            'source_folio_instance_id' => 'reuse-instance-source',
                            'instance_id' => 'reuse-instance-source',
                            'holdings_id' => 'reuse-holdings-source',
                            'lock' => [
                                'locked' => true,
                                'kind' => 'published',
                                'reason' => 'This item is on your course page. To change it, send a message.',
                            ],
                            'capabilities' => ['edit' => false, 'delete' => false, 'move' => false, 'reorder' => false],
                        ]),
                    ],
                ],
            ],
            'unfoldered_items' => [array_replace($baseExpected, [
                'id' => 17,
                'display_order' => 4,
                'title' => 'Synthetic source title',
                'authors' => 'A Writer',
                'publisher' => 'Synthetic Press',
                'publicationYear' => '2025',
                'isbn' => '9780000000001',
                'issn' => '0000-0000',
                'doi' => '10.0000/synthetic',
                'edition' => '2',
                'oclcNumber' => '123456',
                'journalTitle' => null,
                'volume' => '3',
                'issue' => '4',
                'pages' => '10-20',
                'url' => 'https://example.test/item',
                'displayStartDate' => '2026-01-01',
                'displayEndDate' => '2026-12-31',
                'material_type' => 'article',
                'barcode' => 'data-barcode',
                'call_number' => 'data-call-number',
                'eds' => ['dbId' => 'eds-db', 'an' => 'eds-an', 'plink' => 'https://example.test/eds'],
                'source_resource_id' => 'opaque:source-17',
                'source_folio_instance_id' => 'instance-from-source',
                'instance_id' => 'instance-from-data',
                'instance_hrid' => 'instance-hrid',
                'holdings_id' => 'holdings-from-data',
                'chapter_title' => 'Synthetic chapter',
                'copy' => 'Copy 2',
                'temporary_location_id' => 'temporary-id',
                'permanent_location_id' => 'permanent-id',
                'temporary_location' => ['id' => 'temporary-id', 'name' => 'Temporary', 'code' => 'TMP'],
                'permanent_location' => ['id' => 'permanent-id', 'name' => 'Permanent', 'code' => 'PER'],
            ])],
        ], $actual);
    }

    private function item(array $overrides)
    {
        return array_replace([
            'id' => 0,
            'submission_id' => 7,
            'is_reuse' => 0,
            'source_barcode' => null,
            'source_call_number' => null,
            'source_resource_id' => null,
            'source_folio_instance_id' => null,
            'source_folio_holdings_id' => null,
            'resource_data' => '{}',
            'display_order' => 3,
            'folder_name' => null,
            'faculty_notes' => null,
            'assigned_pages' => null,
            'item_status' => 'pending',
            'position_in_folder' => null,
            'claimed_by' => null,
            'claimed_at' => null,
            'last_activity_at' => null,
            'assigned_group_id' => null,
            'locked_for_faculty_at' => null,
            'material_type_name' => null,
            'source_resource_name' => null,
            'staff_notes' => 'Staff-only column',
            'public_note' => 'Staff-only public note',
            'source_snapshot_json' => '{"title":"staff snapshot"}',
            'staff_corrections_json' => '{"title":"staff correction"}',
        ], $overrides);
    }

    private function emptyEvidence()
    {
        return [
            'open_run' => false,
            'publication_history' => false,
            'published' => false,
            'open_review' => false,
        ];
    }

    private function expectedItem()
    {
        return [
            'kind' => 'new',
            'id' => 0,
            'folder_id' => null,
            'folder_name' => null,
            'position' => null,
            'display_order' => 3,
            'is_reuse' => false,
            'status' => 'pending',
            'title' => 'Untitled',
            'journalTitle' => null,
            'material_type' => null,
            'assignedPages' => null,
            'faculty_notes' => null,
            'barcode' => null,
            'call_number' => null,
            'eds' => null,
            'source_resource_id' => null,
            'source_folio_instance_id' => null,
            'instance_id' => null,
            'holdings_id' => null,
            'temporary_location' => null,
            'permanent_location' => null,
            'lock' => ['locked' => false, 'kind' => null, 'reason' => null],
            'capabilities' => ['edit' => true, 'delete' => true, 'move' => true, 'reorder' => true],
            'authors' => null,
            'publisher' => null,
            'publicationYear' => null,
            'isbn' => null,
            'issn' => null,
            'doi' => null,
            'edition' => null,
            'oclcNumber' => null,
            'volume' => null,
            'issue' => null,
            'pages' => null,
            'url' => null,
            'displayStartDate' => null,
            'displayEndDate' => null,
            'instance_hrid' => null,
            'chapter_title' => null,
            'copy' => null,
            'temporary_location_id' => null,
            'permanent_location_id' => null,
        ];
    }
}
