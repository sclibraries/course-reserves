<?php

namespace tests\unit\services;

use app\services\FacultySubmissionPresenter;
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

    public function testProtectionPublicationDraftAndFacultyPassThroughKeepStoredUuid()
    {
        $uuid = '4e5a0000-0000-4000-8000-000000000118';
        $item = [
            'id' => 118,
            'source_resource_id' => $uuid,
            'material_type_id' => 1,
            'resource_data' => json_encode(['title' => 'Synthetic stored source']),
        ];

        $draft = PublicationDraftSnapshot::fromNewItem($item);
        $response = FacultySubmissionPresenter::submissionResponse([
            'submission_uuid' => '11800000-0000-4000-8000-000000000001',
            'newResources' => [$item],
        ]);

        $this->assertSame($uuid, $draft['source_resource_id']);
        $this->assertSame($uuid, $response['newResources'][0]['source_resource_id']);
    }
}
