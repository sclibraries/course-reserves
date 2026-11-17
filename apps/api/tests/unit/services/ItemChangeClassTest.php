<?php

use app\services\ItemChangeClass;

class ItemChangeClassTest extends \Codeception\Test\Unit
{
    /**
     * @dataProvider changes
     */
    public function testClassifiesChangedFields(array $fields, $expected)
    {
        $this->assertSame($expected, ItemChangeClass::classify($fields));
    }

    public function changes()
    {
        return [
            'no change' => [[], null],
            'display-only' => [[
                'description', 'display_start_date', 'display_end_date', 'public_note', 'assigned_pages',
            ], 'display_only'],
            'placement' => [['folder_name', 'display_order', 'position_in_folder'], 'placement'],
            'display dominates placement' => [['description', 'folder_name'], 'display_only'],
            'identity dominates other changes' => [['title', 'description', 'folder_name'], 'identity'],
        ];
    }
}
