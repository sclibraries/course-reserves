<?php

use app\services\FacultySaveOperations;

class FacultySaveOperationsTest extends \Codeception\Test\Unit
{
    public function testParsesTheWholeContractAndNormalizesFields()
    {
        $payload = [
            'format' => 'faculty-save-operations-v1',
            'submission' => [
                'submission_notes' => null, 'needed_by_date' => '2027-02-01', 'course_title' => 'Synthetic seminar',
            ],
            'operations' => [
                ['op' => 'create_item', 'client_key' => 'item-a', 'folder' => ['client_key' => 'folder-a'], 'data' => [
                    'title' => 'Synthetic reading', 'material_type' => 'book', 'edition' => '2',
                    'url' => 'https://example.edu/read me',
                ]],
                ['op' => 'change_item', 'kind' => 'new', 'id' => 21, 'changes' => [
                    'journalTitle' => null, 'faculty_notes' => 'Read the introduction',
                ]],
                ['op' => 'move_item', 'kind' => 'new', 'id' => 22, 'to_folder' => ['id' => 10]],
                ['op' => 'delete_item', 'kind' => 'new', 'id' => 23],
                ['op' => 'create_folder', 'client_key' => 'folder-a', 'name' => 'Week 2'],
                ['op' => 'rename_folder', 'id' => 10, 'name' => 'Week 1'],
                ['op' => 'delete_folder', 'id' => 11],
                ['op' => 'reorder_folder', 'folder' => ['client_key' => 'folder-a'], 'order' => [
                    ['item' => ['client_key' => 'item-a']],
                ]],
                ['op' => 'reorder_root', 'order' => [
                    ['item' => ['kind' => 'new', 'id' => 21]],
                    ['folder' => ['id' => 10]], ['folder' => ['client_key' => 'folder-a']],
                ]],
            ],
        ];
        $expected = $payload;
        unset($expected['format']);
        $expected['operations'][0]['data']['url'] = 'https://example.edu/read%20me';
        $expected['operations'][0]['data']['is_reuse'] = false;
        $expected['operations'][0]['data']['priority'] = 'medium';

        $this->assertSame($expected, FacultySaveOperations::parse($payload));
    }

    public function testAcceptsHeaderOnlySaveWithEmptyOperations()
    {
        $this->assertSame(
            ['submission' => [], 'operations' => []],
            FacultySaveOperations::parse(['format' => 'faculty-save-operations-v1', 'operations' => []])
        );
        $this->assertSame(
            ['submission' => [], 'operations' => []],
            FacultySaveOperations::parse([
                'format' => 'faculty-save-operations-v1', 'submission' => [], 'operations' => [],
            ])
        );
    }

    /**
     * @dataProvider malformedPayloads
     */
    public function testRejectsMalformedPayloads(array $payload)
    {
        $this->assertSame(['error_code' => 'payload_format'], FacultySaveOperations::parse($payload));
    }

    public function malformedPayloads()
    {
        return [
            'unknown envelope key' => [[
                'format' => 'faculty-save-operations-v1', 'operations' => [], 'other' => true,
            ]],
            'wrong format' => [['format' => 'old-payload', 'operations' => []]],
            'operations not a list' => [[
                'format' => 'faculty-save-operations-v1', 'operations' => ['first' => []],
            ]],
            'unknown operation' => [self::payload([['op' => 'copy_item']])],
            'missing exact operation key' => [self::payload([['op' => 'delete_item', 'kind' => 'new']])],
            'extra operation key' => [self::payload([[
                'op' => 'delete_item', 'kind' => 'new', 'id' => 1, 'reason' => 'x',
            ]])],
            'existing id must be integer' => [self::payload([[
                'op' => 'delete_item', 'kind' => 'new', 'id' => '1',
            ]])],
            'existing id must be positive' => [self::payload([[
                'op' => 'delete_item', 'kind' => 'new', 'id' => 0,
            ]])],
            'client key grammar' => [self::payload([[
                'op' => 'create_folder', 'client_key' => '-folder', 'name' => 'Week 2',
            ]])],
            'reference cannot mix shapes' => [self::payload([[
                'op' => 'create_item', 'client_key' => 'item-a', 'folder' => ['id' => 1, 'client_key' => 'folder-a'],
                'data' => ['title' => 'Title', 'material_type' => 'book'],
            ]])],
            'changes cannot be empty' => [self::payload([[
                'op' => 'change_item', 'kind' => 'new', 'id' => 1, 'changes' => [],
            ]])],
            'create data cannot be empty' => [self::payload([[
                'op' => 'create_item', 'client_key' => 'item-a', 'folder' => null, 'data' => [],
            ]])],
            'folder entry in folder order' => [self::payload([[
                'op' => 'reorder_folder', 'folder' => ['id' => 1], 'order' => [['folder' => ['id' => 1]]],
            ]])],
            'order is not a list' => [self::payload([[
                'op' => 'reorder_root', 'order' => ['first' => ['item' => ['kind' => 'new', 'id' => 1]]],
            ]])],
            'item order reference missing kind' => [self::payload([[
                'op' => 'reorder_root', 'order' => [['item' => ['id' => 1]]],
            ]])],
            'unknown data key' => [self::payload([[
                'op' => 'create_item', 'client_key' => 'item-a', 'folder' => null,
                'data' => ['title' => 'Title', 'material_type' => 'book', 'copiedItem' => true],
            ]])],
            'undeclared item key in order' => [self::payload([[
                'op' => 'reorder_root', 'order' => [['item' => ['client_key' => 'item-missing']]],
            ]])],
        ];
    }

    /**
     * @dataProvider duplicatePayloads
     */
    public function testRejectsDuplicateReferences(array $operations)
    {
        $this->assertSame(['error_code' => 'duplicate_reference'], FacultySaveOperations::parse(self::payload($operations)));
    }

    public function duplicatePayloads()
    {
        $change = ['op' => 'change_item', 'kind' => 'new', 'id' => 1, 'changes' => ['authors' => 'A']];
        $move = ['op' => 'move_item', 'kind' => 'new', 'id' => 1, 'to_folder' => null];
        $delete = ['op' => 'delete_item', 'kind' => 'new', 'id' => 1];
        $rename = ['op' => 'rename_folder', 'id' => 2, 'name' => 'Week 2'];
        $deleteFolder = ['op' => 'delete_folder', 'id' => 2];
        $item = ['item' => ['kind' => 'new', 'id' => 1]];
        return [
            'two changes' => [[$change, $change]],
            'two moves' => [[$move, $move]],
            'two deletes' => [[$delete, $delete]],
            'change and delete' => [[$change, $delete]],
            'move and delete' => [[$move, $delete]],
            'deleted item in order' => [[$delete, ['op' => 'reorder_root', 'order' => [$item]]]],
            'two folder renames' => [[$rename, $rename]],
            'two folder deletes' => [[$deleteFolder, $deleteFolder]],
            'folder rename and delete' => [[$rename, $deleteFolder]],
            'two root reorders' => [[['op' => 'reorder_root', 'order' => []], ['op' => 'reorder_root', 'order' => []]]],
            'two reorders of one folder' => [[
                ['op' => 'reorder_folder', 'folder' => ['id' => 2], 'order' => []],
                ['op' => 'reorder_folder', 'folder' => ['id' => 2], 'order' => []],
            ]],
            'same item twice in one order' => [[['op' => 'reorder_root', 'order' => [$item, $item]]]],
            'same folder twice in one order' => [[['op' => 'reorder_root', 'order' => [
                ['folder' => ['id' => 2]], ['folder' => ['id' => 2]],
            ]]]],
            'item in two orders' => [[
                ['op' => 'reorder_folder', 'folder' => ['id' => 2], 'order' => [$item]],
                ['op' => 'reorder_folder', 'folder' => ['id' => 3], 'order' => [$item]],
            ]],
            'duplicate key across create kinds' => [[
                ['op' => 'create_item', 'client_key' => 'same', 'folder' => null,
                    'data' => ['title' => 'Title', 'material_type' => 'book']],
                ['op' => 'create_folder', 'client_key' => 'same', 'name' => 'Week 2'],
            ]],
        ];
    }

    /**
     * @dataProvider unknownReferencePayloads
     */
    public function testRejectsUnknownFolderReferences(array $operations, $errorCode)
    {
        $this->assertSame(['error_code' => $errorCode], FacultySaveOperations::parse(self::payload($operations)));
    }

    public function unknownReferencePayloads()
    {
        $create = ['op' => 'create_item', 'client_key' => 'item-a', 'data' => [
            'title' => 'Title', 'material_type' => 'book',
        ]];
        return [
            'undeclared create target folder' => [[$create + ['folder' => ['client_key' => 'missing']]], 'unknown_folder'],
            'undeclared root order folder' => [[
                ['op' => 'reorder_root', 'order' => [['folder' => ['client_key' => 'missing']]]],
            ], 'unknown_folder'],
            'deleted target folder' => [[
                ['op' => 'delete_folder', 'id' => 2],
                ['op' => 'move_item', 'kind' => 'new', 'id' => 1, 'to_folder' => ['id' => 2]],
            ], 'unknown_folder'],
            'deleted folder in order' => [[
                ['op' => 'delete_folder', 'id' => 2],
                ['op' => 'reorder_root', 'order' => [['folder' => ['id' => 2]]]],
            ], 'unknown_folder'],
            'item key cannot declare a folder' => [[
                ['op' => 'create_item', 'client_key' => 'same', 'folder' => null,
                    'data' => ['title' => 'Title', 'material_type' => 'book']],
                ['op' => 'create_item', 'client_key' => 'item-b', 'folder' => ['client_key' => 'same'],
                    'data' => ['title' => 'Title', 'material_type' => 'book']],
            ], 'unknown_folder'],
        ];
    }

    public function testChecksDuplicatesBeforeUnknownReferencesAndReadOnly()
    {
        $operations = [
            ['op' => 'change_item', 'kind' => 'reuse', 'id' => 1, 'changes' => ['authors' => 'A']],
            ['op' => 'change_item', 'kind' => 'reuse', 'id' => 1, 'changes' => ['authors' => 'B']],
            ['op' => 'create_item', 'client_key' => 'item-a', 'folder' => ['client_key' => 'missing'],
                'data' => ['title' => 'Title', 'material_type' => 'book']],
        ];
        $this->assertSame(['error_code' => 'duplicate_reference'], FacultySaveOperations::parse(self::payload($operations)));

        unset($operations[1]);
        $this->assertSame(['error_code' => 'unknown_folder'], FacultySaveOperations::parse(self::payload(array_values($operations))));

        unset($operations[2]);
        $this->assertSame(['error_code' => 'item_read_only'], FacultySaveOperations::parse(self::payload(array_values($operations))));
    }

    public function testAllowsForwardReferencesAndDistinctItemKinds()
    {
        $operations = [
            ['op' => 'reorder_root', 'order' => [
                ['item' => ['client_key' => 'item-later']], ['folder' => ['client_key' => 'folder-later']],
                ['item' => ['kind' => 'new', 'id' => 7]], ['item' => ['kind' => 'reuse', 'id' => 7]],
            ]],
            ['op' => 'create_folder', 'client_key' => 'folder-later', 'name' => 'Week 2'],
            ['op' => 'create_item', 'client_key' => 'item-later', 'folder' => ['client_key' => 'folder-later'],
                'data' => ['title' => 'Title', 'material_type' => 'book']],
            ['op' => 'change_item', 'kind' => 'new', 'id' => 7, 'changes' => ['authors' => 'A']],
            ['op' => 'move_item', 'kind' => 'new', 'id' => 7, 'to_folder' => null],
        ];
        $result = FacultySaveOperations::parse(self::payload($operations));
        $this->assertArrayHasKey('operations', $result);
        $this->assertCount(5, $result['operations']);
    }

    private static function payload(array $operations)
    {
        return ['format' => 'faculty-save-operations-v1', 'operations' => $operations];
    }
}
