<?php

namespace tests\unit\services;

use app\models\FacultySubmission;
use app\services\FacultyItemRepresentation;
use app\services\PublicationDraftSnapshot;
use app\services\SubmissionInputProjection;

class Api118SourceResourceProjectionTest extends \Codeception\Test\Unit
{
    public function testNoncanonicalUuidIsNoLocalSourceWhileDanglingCanonicalIdStillBlocks()
    {
        $uuid = '81390788-f8c0-4000-8000-000000000118';
        $projection = new SubmissionInputProjection();
        $noncanonical = $projection->project('new', [
            'id' => 118,
            'material_type_id' => 1,
            'source_resource_id' => $uuid,
            'resource_data' => json_encode(['title' => 'Synthetic UUID-only item', 'materialType' => 'ebook']),
        ], 'ebook');
        $dangling = $projection->project('new', [
            'id' => 119,
            'material_type_id' => 1,
            'source_resource_id' => '2147483647',
            'resource_data' => json_encode(['title' => 'Synthetic dangling local item', 'materialType' => 'book']),
        ], 'book', null, false);

        $this->assertNull($noncanonical['source']['resource_id']);
        $this->assertNotContains('source_resource_missing', $noncanonical['blockers']);
        $this->assertNotContains('copy_inputs_incomplete', $noncanonical['blockers']);
        $this->assertContains('source_resource_missing', $dangling['blockers']);
        $this->assertSame('2147483647', $dangling['source']['resource_id']);
    }

    public function testProtectionDraftAndCanonicalFacultyProjectionKeepStoredUuid()
    {
        $uuid = '4e5a0000-0000-4000-8000-000000000118';
        $item = [
            'id' => 118,
            'source_resource_id' => $uuid,
            'material_type_id' => 1,
            'resource_data' => json_encode(['title' => 'Synthetic stored source']),
        ];

        $draft = PublicationDraftSnapshot::fromNewItem($item);
        $submission = new FacultySubmission([
            'submission_id' => 118,
            'status' => FacultySubmission::STATUS_DRAFT,
            'is_locked' => 0,
        ]);
        $represented = (new FacultyItemRepresentation(date('Y-m-d H:i:s')))->represent(
            $submission,
            [],
            ['new' => [[
                'id' => 118,
                'submission_id' => 118,
                'is_reuse' => 0,
                'source_barcode' => null,
                'source_call_number' => null,
                'source_resource_id' => $uuid,
                'source_folio_instance_id' => null,
                'source_folio_holdings_id' => null,
                'resource_data' => json_encode(['title' => 'Synthetic stored source']),
                'display_order' => 1,
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
                'material_type_name' => 'Book',
                'source_resource_name' => 'Synthetic stored source',
            ]], 'reuse' => []],
            ['new' => [118 => [
                'open_run' => false,
                'publication_history' => false,
                'published' => false,
                'open_review' => false,
            ]], 'reuse' => []]
        );

        $this->assertSame($uuid, $draft['source_resource_id']);
        $this->assertSame($uuid, $represented['unfoldered_items'][0]['source_resource_id']);
    }
}
