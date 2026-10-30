<?php

namespace tests\unit\services;

use app\services\PublicationDraftSnapshot;

class PublicationDraftSnapshotTest extends \Codeception\Test\Unit
{
    public function testStaleFacultyTypeDoesNotChangeAnOverriddenEffectiveType()
    {
        $before = [
            'material_type_id' => 2,
            'staff_material_type_id' => 5,
            'resource_data' => json_encode([
                'title' => 'Climate', 'materialType' => 'book', 'material_type_id' => 2,
            ]),
        ];
        $after = [
            'material_type_id' => 3,
            'staff_material_type_id' => 5,
            'resource_data' => json_encode([
                'title' => 'Climate', 'materialType' => 'article', 'material_type_id' => 3,
            ]),
        ];

        $this->assertFalse(PublicationDraftSnapshot::changed($before, $after));
    }

    public function testFacultyCompatibilityDefaultsDoNotChangeProjectedInputs()
    {
        $before = [
            'material_type_id' => 3,
            'staff_material_type_id' => 5,
            'resource_data' => json_encode([
                'title' => 'Faculty title', 'url' => 'https://example.test/item',
                'materialType' => 'article', 'material_type_id' => 3,
            ]),
        ];
        $after = $before;
        $after['resource_data'] = json_encode([
            'title' => 'Faculty title', 'authors' => '', 'url' => 'https://example.test/item',
            'materialType' => 'article', 'material_type_id' => 3,
        ]);

        $this->assertFalse(PublicationDraftSnapshot::changed($before, $after));
    }

    public function testSourceSnapshotAndClassificationChoiceArePublishableDraftInputs()
    {
        $before = [
            'material_type_id' => 5,
            'source_snapshot_json' => json_encode(['title' => 'Source title']),
            'destination_class_choice' => null,
        ];
        $sourceChanged = $before;
        $sourceChanged['source_snapshot_json'] = json_encode(['title' => 'Corrected source title']);
        $classificationChanged = $before;
        $classificationChanged['destination_class_choice'] = 'electronic';

        $this->assertTrue(PublicationDraftSnapshot::changed($before, $sourceChanged));
        $this->assertTrue(PublicationDraftSnapshot::changed($before, $classificationChanged));
    }
}
