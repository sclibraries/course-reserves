<?php

namespace tests\unit\services;

use app\services\ItemReadiness;

class ItemReadinessTest extends \Codeception\Test\Unit
{
    public function testOnlineAccessMakesAnItemReadyWithoutCatalogIdentity()
    {
        $item = ['resource_data' => ['url' => 'https://example.test/item']];
        $result = ItemReadiness::evaluate($item, null, ItemReadiness::catalogInstanceId($item));

        $this->assertSame('ready', $result['readiness']);
        $this->assertSame('Online access is available.', $result['readiness_reason']);
    }

    public function testAvailableFiveCollegeCopyMakesCatalogItemReady()
    {
        $item = ['source_folio_instance_id' => '00000000-0000-4000-8000-000000000095'];
        $result = ItemReadiness::evaluate($item, [[
            'library' => 'Mount Holyoke College', 'status' => 'Available',
        ]], ItemReadiness::catalogInstanceId($item));

        $this->assertSame('ready', $result['readiness']);
        $this->assertSame('Available at a Five College library.', $result['readiness_reason']);
    }

    public function testCatalogItemWithoutAvailableCopyIsMissing()
    {
        $item = ['source_folio_instance_id' => '00000000-0000-4000-8000-000000000095'];
        $result = ItemReadiness::evaluate($item, [[
            'library' => 'Smith College', 'status' => 'Checked out',
        ]], ItemReadiness::catalogInstanceId($item));

        $this->assertSame('missing', $result['readiness']);
        $this->assertSame('No available Five College copy or online access.', $result['readiness_reason']);
    }

    public function testManualItemWithoutCatalogIdentityIsUnknown()
    {
        $item = ['resource_data' => ['title' => 'Synthetic manual item']];
        $result = ItemReadiness::evaluate($item, null, ItemReadiness::catalogInstanceId($item));

        $this->assertSame('unknown', $result['readiness']);
        $this->assertSame('No catalog identity.', $result['readiness_reason']);
    }

    public function testFailedAvailabilityLookupIsUnknown()
    {
        $item = ['source_folio_instance_id' => '00000000-0000-4000-8000-000000000095'];
        $result = ItemReadiness::evaluate(
            $item,
            ['error' => true, 'reference' => 'synthetic-reference'],
            ItemReadiness::catalogInstanceId($item)
        );

        $this->assertSame('unknown', $result['readiness']);
        $this->assertSame('Availability could not be checked.', $result['readiness_reason']);
    }

    public function testOpenCurrentRunAndSetPathAreInProgress()
    {
        $result = ItemReadiness::evaluate(
            ['access_path' => 'ill'], null, null, ['finish_state' => null, 'closed_at' => null]
        );

        $this->assertSame('in_progress', $result['readiness']);
    }

    public function testPathWithoutAnOpenCurrentRunUsesExistingReadinessRules()
    {
        $result = ItemReadiness::evaluate(['access_path' => 'ill'], null, null, [
            'finish_state' => null, 'closed_at' => '2026-10-26 12:00:00',
        ]);

        $this->assertSame('unknown', $result['readiness']);
    }
}
