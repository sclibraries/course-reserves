<?php

namespace tests\unit\services;

use app\services\EffectiveMaterialType;

class EffectiveMaterialTypeTest extends \Codeception\Test\Unit
{
    public function testCanonicalKeyUsesStaffOverrideThenItemKeyThenTypeName()
    {
        $this->assertSame('book', EffectiveMaterialType::key([
            'staff_material_type_id' => 8,
            'material_type' => 'test-api096-book',
            'material_type_key' => 'article',
            'resource_data' => json_encode(['materialType' => 'article']),
        ]));
        $this->assertSame('article', EffectiveMaterialType::key([
            'material_type' => 'test-api096-book',
            'resource_data' => json_encode(['materialType' => 'article']),
        ]));
        $this->assertSame('ebook', EffectiveMaterialType::key([], 'E-Book'));
        $this->assertSame('chapter', EffectiveMaterialType::key([
            'materialType' => ['name' => 'test-api096-chapter'],
        ]));
    }

    public function testLegacyItemTypeFallsBackToSourceType()
    {
        $this->assertSame(4, EffectiveMaterialType::id([
            'staff_material_type_id' => null,
            'material_type_id' => null,
            'source_material_type_id' => 4,
        ]));
        $this->assertSame(7, EffectiveMaterialType::id([
            'staff_material_type_id' => 7,
            'material_type_id' => 2,
            'source_material_type_id' => 4,
        ]));
    }

    public function testSqlCanFallBackToTheSourceType()
    {
        $this->assertSame(
            'COALESCE(item.staff_material_type_id, item.material_type_id, source.material_type_id)',
            EffectiveMaterialType::sql('item', 'source')
        );
    }
}
