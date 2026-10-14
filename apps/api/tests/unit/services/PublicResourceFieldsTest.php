<?php

namespace tests\unit\services;

use app\services\PublicResourceFields;

class PublicResourceFieldsTest extends \Codeception\Test\Unit
{
    public function testPublicSerializationKeepsPublicResourceAndNestedFieldsOnly()
    {
        $resource = [
            'resource_id' => 52,
            'name' => 'Synthetic resource',
            'internal_note' => 'secret',
            'external_note' => 'public',
            'start_visibility' => '2026-01-01',
            'order' => 7,
            'future_staff_flag' => true,
            'metadata' => [['metadata_id' => 3, 'field_name' => 'term', 'field_value' => 'Fall']],
            'links' => [['link_id' => 4, 'url' => 'https://example.test/resource', 'created_at' => '2026-01-01']],
        ];

        $result = PublicResourceFields::serialize($resource, null);

        $this->assertSame([
            'resource_id' => 52,
            'name' => 'Synthetic resource',
            'external_note' => 'public',
            'start_visibility' => '2026-01-01',
            'order' => 7,
            'metadata' => [['metadata_id' => 3, 'field_name' => 'term', 'field_value' => 'Fall']],
            'links' => [['link_id' => 4, 'url' => 'https://example.test/resource', 'created_at' => '2026-01-01']],
        ], $result);
    }

    public function testStaffSerializationAddsInternalNoteWithoutChangingPublicFields()
    {
        $resource = [
            'resource_id' => 52,
            'name' => 'Synthetic resource',
            'internal_note' => 'secret',
            'external_note' => 'public',
            'order' => 7,
        ];

        $result = PublicResourceFields::serialize($resource, (object) ['role' => 'staff']);

        $this->assertSame([
            'resource_id' => 52,
            'name' => 'Synthetic resource',
            'internal_note' => 'secret',
            'external_note' => 'public',
            'order' => 7,
        ], $result);
    }

    public function testFacultyAndUnknownRolesDoNotReceiveStaffFields()
    {
        $resource = ['name' => 'Synthetic resource', 'internal_note' => 'secret'];

        $this->assertSame(['name' => 'Synthetic resource'], PublicResourceFields::serialize($resource, (object) ['role' => 'faculty']));
        $this->assertSame(['name' => 'Synthetic resource'], PublicResourceFields::serialize($resource, (object) ['role' => 'unknown']));
    }

    public function testResourceModelFieldDefinitionsUseTheSameRoleAllowlist()
    {
        $fields = [
            'resource_id' => 'resource_id',
            'internal_note' => 'internal_note',
            'name' => 'name',
            'future_field' => 'future_field',
        ];

        $this->assertSame(
            ['resource_id' => 'resource_id', 'name' => 'name'],
            PublicResourceFields::filterFieldDefinitions($fields, null)
        );
        $this->assertSame(
            ['resource_id' => 'resource_id', 'internal_note' => 'internal_note', 'name' => 'name'],
            PublicResourceFields::filterFieldDefinitions($fields, (object) ['role' => 'admin'])
        );
    }
}
