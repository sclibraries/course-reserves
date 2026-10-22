<?php

namespace tests\unit\services;

use app\services\ItemReadiness;

class ItemReadinessTest extends \Codeception\Test\Unit
{
    public function testOnlineAccessMakesAnItemReadyWithoutCatalogIdentity()
    {
        $result = ItemReadiness::evaluate([
            'resource_data' => ['url' => 'https://example.test/item'],
        ]);

        $this->assertSame('ready', $result['readiness']);
        $this->assertSame('Online access is available.', $result['readiness_reason']);
    }

    public function testAvailableFiveCollegeCopyMakesCatalogItemReady()
    {
        $result = ItemReadiness::evaluate([
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000095',
        ], [[
            'library' => 'Mount Holyoke College',
            'status' => 'Available',
        ]]);

        $this->assertSame('ready', $result['readiness']);
        $this->assertSame('Available at a Five College library.', $result['readiness_reason']);
    }

    public function testCatalogItemWithoutAvailableCopyIsMissing()
    {
        $result = ItemReadiness::evaluate([
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000095',
        ], [[
            'library' => 'Smith College',
            'status' => 'Checked out',
        ]]);

        $this->assertSame('missing', $result['readiness']);
        $this->assertSame('No available Five College copy or online access.', $result['readiness_reason']);
    }

    public function testManualItemWithoutCatalogIdentityIsUnknown()
    {
        $result = ItemReadiness::evaluate([
            'resource_data' => ['title' => 'Synthetic manual item'],
        ]);

        $this->assertSame('unknown', $result['readiness']);
        $this->assertSame('No catalog identity.', $result['readiness_reason']);
    }

    public function testFailedAvailabilityLookupIsUnknown()
    {
        $result = ItemReadiness::evaluate([
            'source_folio_instance_id' => '00000000-0000-4000-8000-000000000095',
        ], ['error' => true, 'reference' => 'synthetic-reference']);

        $this->assertSame('unknown', $result['readiness']);
        $this->assertSame('Availability could not be checked.', $result['readiness_reason']);
    }
}
