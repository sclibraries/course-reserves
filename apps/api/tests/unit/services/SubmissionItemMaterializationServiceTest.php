<?php

namespace tests\unit\services;

use app\models\SubmissionNewResource;
use app\services\SubmissionItemMaterializationService;

class SubmissionItemMaterializationServiceTest extends \Codeception\Test\Unit
{
    public function testEveryNonNullMaterializationFieldMarksTheItemAsMaterialized()
    {
        $markers = [
            'materialized_resource_id' => 91,
            'materialized_course_resource_id' => 92,
            'materialized_physical_reference_id' => 93,
            'materialized_folder_id' => 94,
            'materialized_by_staff_id' => 'test-api033-staff',
            'materialized_at' => '2026-10-14 12:00:00',
        ];

        foreach ($markers as $field => $value) {
            $item = (object)[
                'materialized_resource_id' => null,
                'materialized_course_resource_id' => null,
                'materialized_physical_reference_id' => null,
                'materialized_folder_id' => null,
                'materialized_by_staff_id' => null,
                'materialized_at' => null,
                $field => $value,
            ];

            $this->assertTrue(SubmissionItemMaterializationService::isMaterialized($item), $field);
        }

        $this->assertTrue(SubmissionItemMaterializationService::isMaterialized([
            'materialized_folder_id' => 0,
        ]));
        $this->assertFalse(SubmissionItemMaterializationService::isMaterialized([
            'materialized_folder_id' => null,
            'materialized_at' => null,
        ]));
    }

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

    public function testFacultyAndStaffNotesStayOutOfStudentVisibleResourceText()
    {
        $item = new SubmissionNewResource();
        $item->resource_data = json_encode([
            'description' => '',
            'abstract' => 'Synthetic public abstract',
            'notes' => 'test-faculty-note-in-resource-data',
        ]);
        $item->faculty_notes = 'test-faculty-note';
        $item->public_note = 'test-staff-public-note';

        $this->assertSame([
            'description' => 'Synthetic public abstract',
            'external_note' => null,
        ], (new SubmissionItemMaterializationService())->safePublicText($item));
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
