<?php

namespace tests\unit\services;

use app\services\FacultyFolderGrouping;

class FacultyFolderGroupingTest extends \Codeception\Test\Unit
{
    public function testGroupsAndOrdersItemsIndependentlyOfInputOrder()
    {
        $folders = [
            ['folder_id' => '20', 'folder_name' => 'History', 'display_order' => '2'],
            ['folder_id' => '8', 'folder_name' => 'Week 1', 'display_order' => '1'],
            ['folder_id' => '3', 'folder_name' => 'Week 1', 'display_order' => null],
            ['folder_id' => '11', 'folder_name' => 'week 1', 'display_order' => '1'],
        ];
        $itemsByKind = [
            'new' => [
                ['id' => '7', 'folder_name' => 'Week 1', 'display_order' => '1', 'position_in_folder' => '2'],
                ['id' => '3', 'folder_name' => 'Week 1', 'display_order' => '3', 'position_in_folder' => '1'],
                ['id' => '21', 'folder_name' => 'week 1', 'display_order' => '1', 'position_in_folder' => null],
                ['id' => '30', 'folder_name' => 'Ghost', 'display_order' => '2', 'position_in_folder' => '1'],
                ['id' => '31', 'folder_name' => '101', 'display_order' => '2', 'position_in_folder' => null],
                ['id' => '32', 'folder_name' => '', 'display_order' => '0', 'position_in_folder' => null],
                ['id' => '33', 'folder_name' => null, 'display_order' => null, 'position_in_folder' => null],
                ['id' => '34', 'folder_name' => null, 'display_order' => '2', 'position_in_folder' => null],
                ['id' => '36', 'folder_name' => 'History', 'display_order' => '1', 'position_in_folder' => '2'],
                ['id' => '6', 'folder_name' => 'Week 1', 'display_order' => '1', 'position_in_folder' => '2'],
                ['id' => '9', 'folder_name' => 'Week 1', 'display_order' => '1', 'position_in_folder' => '2'],
            ],
            'reuse' => [
                ['id' => '7', 'folder_name' => 'Week 1', 'display_order' => '1', 'position_in_folder' => '2'],
                ['id' => '38', 'folder_name' => 'Week 1', 'display_order' => '1', 'position_in_folder' => null],
                ['id' => '39', 'folder_name' => 'Ghost', 'display_order' => '2', 'position_in_folder' => '1'],
                ['id' => '40', 'folder_name' => '', 'display_order' => '0', 'position_in_folder' => null],
                ['id' => '41', 'folder_name' => null, 'display_order' => '2', 'position_in_folder' => null],
                ['id' => '42', 'folder_name' => 'History', 'display_order' => '1', 'position_in_folder' => '1'],
                ['id' => '43', 'folder_name' => null, 'display_order' => null, 'position_in_folder' => null],
                ['id' => '5', 'folder_name' => 'Week 1', 'display_order' => '1', 'position_in_folder' => '2'],
                ['id' => '2', 'folder_name' => null, 'display_order' => '2', 'position_in_folder' => null],
            ],
        ];
        $original = [$folders, $itemsByKind];
        $expected = [
            'folders' => [
                ['folder_id' => 8, 'ambiguous' => true, 'items' => []],
                ['folder_id' => 11, 'ambiguous' => false, 'items' => [
                    ['kind' => 'new', 'id' => 21],
                ]],
                ['folder_id' => 20, 'ambiguous' => false, 'items' => [
                    ['kind' => 'reuse', 'id' => 42],
                    ['kind' => 'new', 'id' => 36],
                ]],
                ['folder_id' => 3, 'ambiguous' => true, 'items' => [
                    ['kind' => 'new', 'id' => 3],
                    ['kind' => 'new', 'id' => 6],
                    ['kind' => 'new', 'id' => 7],
                    ['kind' => 'new', 'id' => 9],
                    ['kind' => 'reuse', 'id' => 5],
                    ['kind' => 'reuse', 'id' => 7],
                    ['kind' => 'reuse', 'id' => 38],
                ]],
            ],
            'root' => [
                ['kind' => 'new', 'id' => 32],
                ['kind' => 'reuse', 'id' => 40],
                ['kind' => 'new', 'id' => 30],
                ['kind' => 'new', 'id' => 31],
                ['kind' => 'new', 'id' => 34],
                ['kind' => 'reuse', 'id' => 2],
                ['kind' => 'reuse', 'id' => 39],
                ['kind' => 'reuse', 'id' => 41],
                ['kind' => 'new', 'id' => 33],
                ['kind' => 'reuse', 'id' => 43],
            ],
            'containers' => [
                'new' => [
                    3 => 3,
                    6 => 3,
                    7 => 3,
                    9 => 3,
                    21 => 11,
                    30 => null,
                    31 => null,
                    32 => null,
                    33 => null,
                    34 => null,
                    36 => 20,
                ],
                'reuse' => [
                    2 => null,
                    5 => 3,
                    7 => 3,
                    38 => 3,
                    39 => null,
                    40 => null,
                    41 => null,
                    42 => 20,
                    43 => null,
                ],
            ],
            'orphan_names' => ['101', 'Ghost'],
        ];
        $grouping = new FacultyFolderGrouping();

        $this->assertSame($expected, $grouping->group($folders, $itemsByKind));
        $this->assertSame($original, [$folders, $itemsByKind]);

        $folders = array_reverse($folders);
        foreach ($itemsByKind as &$items) {
            $items = array_reverse($items);
        }
        unset($items);

        $this->assertSame($expected, $grouping->group($folders, $itemsByKind));
    }
}
