<?php

namespace tests\unit\services;

use app\services\SubmissionInputProjection;

class SubmissionInputProjectionTest extends \Codeception\Test\Unit
{
    public function testProjectionUsesFieldPrecedenceAndKeepsExplicitClears()
    {
        $item = [
            'id' => 9,
            'material_type_id' => 2,
            'staff_material_type_id' => 3,
            'is_reuse' => 1,
            'source_resource_id' => '44',
            'source_folio_instance_id' => 'folio-44',
            'resource_data' => json_encode([
                'title' => 'Saved title',
                'authors' => null,
                'url' => null,
                'holdingsId' => 'folio-holdings-44',
            ]),
            'staff_corrections_json' => json_encode([
                'title' => 'Staff title',
                'publisher' => null,
            ]),
            'source_snapshot_json' => json_encode([
                'title' => 'Source title',
                'authors' => 'Source author',
                'publisher' => 'Source publisher',
                'url' => 'https://source.example/item',
                'description' => 'Source abstract',
            ]),
            'public_note' => null,
            'assigned_pages' => '1-3',
        ];
        $published = [
            'kind' => 'electronic',
            'resource' => [
                'name' => 'Published title',
                'item_url' => 'https://published.example/item',
                'description' => 'Published description',
            ],
        ];

        $projection = (new SubmissionInputProjection())->project('new', $item, 'ebook', $published, true);

        $this->assertSame('new', $projection['kind']);
        $this->assertSame(9, $projection['id']);
        $this->assertSame('Staff title', $projection['inputs']['title']);
        $this->assertNull($projection['inputs']['publisher']);
        $this->assertNull($projection['inputs']['authors']);
        $this->assertNull($projection['inputs']['url']);
        $this->assertSame('Source abstract', $projection['inputs']['description']);
        $this->assertNull($projection['inputs']['public_note']);
        $this->assertSame('1-3', $projection['inputs']['assigned_pages']);
        $this->assertSame('44', $projection['source']['resource_id']);
        $this->assertSame('folio-44', $projection['source']['folio_instance_id']);
        $this->assertSame('folio-holdings-44', $projection['source']['folio_holdings_id']);
        $this->assertSame(3, $projection['effective_material_type']['id']);
        $this->assertSame('electronic', $projection['destination_class']);
        $this->assertSame([], $projection['blockers']);
    }

    public function testLegacyReuseUsesLocalTypeAndNestedPublishedSnapshot()
    {
        $projection = (new SubmissionInputProjection())->project('reuse', [
            'id' => 9,
            'material_type_id' => 4,
            'source_resource_id' => 44,
            'source_snapshot_json' => null,
        ], 'book', [
            'kind' => 'electronic',
            'resource' => [
                'name' => 'Published reuse title',
                'item_url' => 'https://published.example/reuse',
            ],
        ], true);

        $this->assertSame('reuse', $projection['kind']);
        $this->assertSame(9, $projection['id']);
        $this->assertSame('Published reuse title', $projection['inputs']['title']);
        $this->assertSame('44', $projection['source']['resource_id']);
        $this->assertNull($projection['source']['folio_instance_id']);
        $this->assertSame('print', $projection['destination_class']);
    }

    public function testClassificationUsesTypeBeforeFolioIdentityAndRequiresChoiceForVideo()
    {
        $projection = new SubmissionInputProjection();
        $cases = [
            ['book', null, null, 'print', []],
            ['ebook', null, 'instance-1', 'electronic', []],
            ['article', null, null, 'electronic', []],
            ['chapter', null, null, 'electronic', []],
            ['website', null, null, 'electronic', []],
            ['video', null, 'instance-2', 'print', []],
            ['video', 'electronic', null, 'electronic', []],
            ['video', null, null, null, ['destination_class_required']],
            ['other', 'print', null, 'print', []],
            ['audiobook', 'print', 'instance-3', null, ['unknown_material_type']],
            [null, 'electronic', 'instance-4', null, ['unknown_material_type']],
        ];

        foreach ($cases as $case) {
            list($type, $choice, $instanceId, $expectedClass, $expectedBlockers) = $case;
            $actual = $projection->project('new', [
                'id' => 1,
                'material_type_id' => $type === null ? null : 1,
                'destination_class_choice' => $choice,
                'source_folio_instance_id' => $instanceId,
            ], $type, null, false);

            $this->assertSame($expectedClass, $actual['destination_class'], (string)$type);
            $this->assertSame($expectedBlockers, $actual['blockers'], (string)$type);
        }
    }

    public function testOnlyDanglingLocalResourceReferencesBlockProjection()
    {
        $projection = new SubmissionInputProjection();
        $dangling = $projection->project('new', [
            'id' => 1,
            'material_type_id' => 1,
            'source_resource_id' => '123',
        ], 'book', null, false);
        $newItem = $projection->project('new', [
            'id' => 2,
            'material_type_id' => 1,
            'source_folio_instance_id' => 'folio-123',
        ], 'book', null, false);

        $this->assertSame(['source_resource_missing'], $dangling['blockers']);
        $this->assertSame([], $newItem['blockers']);
    }
}
