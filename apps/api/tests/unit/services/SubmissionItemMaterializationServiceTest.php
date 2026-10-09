<?php

namespace tests\unit\services;

use app\services\SubmissionItemMaterializationService;

class SubmissionItemMaterializationServiceTest extends \Codeception\Test\Unit
{
    public function testPhysicalItemsAreDetectedFromBarcodeOrFolioInstance()
    {
        $service = new SubmissionItemMaterializationService();

        $barcodeItem = (object)['source_barcode' => '39088000000123', 'source_folio_instance_id' => null];
        $folioItem = (object)['source_barcode' => null, 'source_folio_instance_id' => 'folio-instance-123'];
        $electronicItem = (object)[
            'source_barcode' => null,
            'source_folio_instance_id' => null,
            'resource_data' => json_encode(['title' => 'Online article', 'url' => 'https://example.test/article']),
        ];

        $this->assertTrue($service->isPhysicalItem($barcodeItem));
        $this->assertTrue($service->isPhysicalItem($folioItem));
        $this->assertFalse($service->isPhysicalItem($electronicItem));
    }

    public function testCourseResourceOrderUsesFacultyDisplayOrder()
    {
        $service = new SubmissionItemMaterializationService();

        $item = (object)[
            'display_order' => 17,
            'position_in_folder' => 2,
        ];

        $this->assertSame(17, $service->getFinalDisplayOrder($item));
    }

    public function testVisibilityDatesUseFacultyRequestedDates()
    {
        $service = new SubmissionItemMaterializationService();

        $item = (object)[
            'resource_data' => json_encode([
                'title' => 'Climate search result',
                'displayStartDate' => '2026-08-31',
                'displayEndDate' => '2026-12-18',
            ]),
        ];

        $this->assertSame([
            'start_visibility' => '2026-08-31',
            'end_visibility' => '2026-12-18',
            'use_resource_visibility' => 1,
        ], $service->getVisibilitySettings($item));
    }
}
