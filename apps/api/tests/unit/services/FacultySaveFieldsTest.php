<?php

use app\services\FacultySaveOperations;

class FacultySaveFieldsTest extends \Codeception\Test\Unit
{
    /**
     * @dataProvider invalidFieldCases
     */
    public function testRejectsInvalidFieldValues($scope, $field, $value, $remove = false)
    {
        $payload = ['format' => 'faculty-save-operations-v1', 'operations' => []];
        if ($scope === 'create') {
            $data = ['title' => 'Synthetic title', 'material_type' => 'book'];
            $this->changeField($data, $field, $value, $remove);
            $payload['operations'][] = [
                'op' => 'create_item', 'client_key' => 'item-a', 'folder' => null, 'data' => $data,
            ];
        } elseif ($scope === 'change') {
            $changes = ['authors' => 'Synthetic author'];
            $this->changeField($changes, $field, $value, $remove);
            $payload['operations'][] = [
                'op' => 'change_item', 'kind' => 'new', 'id' => 1, 'changes' => $changes,
            ];
        } elseif ($scope === 'submission') {
            $payload['submission'] = [];
            $this->changeField($payload['submission'], $field, $value, $remove);
        } else {
            $payload['operations'][] = ['op' => 'create_folder', 'client_key' => 'folder-a', 'name' => 'Week 2'];
            $payload['operations'][0]['name'] = $value;
        }

        $this->assertSame(['error_code' => 'payload_format'], FacultySaveOperations::parse($payload));
    }

    public function invalidFieldCases()
    {
        return [
            'create title missing' => ['create', 'title', null, true],
            'create title blank' => ['create', 'title', " \t"],
            'create title wrong type' => ['create', 'title', 5],
            'material type missing' => ['create', 'material_type', null, true],
            'material type null' => ['create', 'material_type', null],
            'material type outside shared keys' => ['create', 'material_type', 'magazine'],
            'nullable item string wrong type' => ['change', 'journalTitle', 5],
            'url invalid scheme' => ['create', 'url', 'ftp://example.edu/book'],
            'url wrong type' => ['change', 'url', 7],
            'date wrong shape' => ['change', 'displayStartDate', '2027-2-01'],
            'date impossible' => ['create', 'displayEndDate', '2027-02-29'],
            'date wrong type' => ['submission', 'needed_by_date', 20270201],
            'barcode too many characters' => ['create', 'barcode', str_repeat('é', 256)],
            'call number too many characters' => ['create', 'call_number', str_repeat('x', 513)],
            'nested id too many characters' => [
                'create', 'temporary_location', ['id' => str_repeat('x', 256), 'name' => null, 'code' => null],
            ],
            'course title too many characters' => ['submission', 'course_title', str_repeat('x', 501)],
            'notes too many bytes' => ['submission', 'submission_notes', str_repeat('x', 65536)],
            'assigned pages too many bytes' => ['change', 'assignedPages', str_repeat('x', 65536)],
            'faculty notes too many bytes' => ['create', 'faculty_notes', str_repeat('x', 65536)],
            'folder name blank' => ['folder', 'name', " \t"],
            'folder name too many characters' => ['folder', 'name', str_repeat('x', 256)],
            'priority invalid' => ['create', 'priority', 'urgent'],
            'reuse flag wrong type' => ['create', 'is_reuse', 'false'],
            'create-only field in change' => ['change', 'barcode', '123456'],
            'eds map missing member' => ['create', 'eds', ['dbId' => '1', 'an' => '2']],
            'eds member wrong type' => ['create', 'eds', ['dbId' => '1', 'an' => [], 'plink' => null]],
            'location map extra member' => [
                'create', 'permanent_location', ['id' => '1', 'name' => 'Library', 'code' => 'LIB', 'extra' => 'x'],
            ],
            'location member wrong type' => [
                'create', 'temporary_location', ['id' => '1', 'name' => 4, 'code' => 'LIB'],
            ],
            'unknown item field' => ['create', 'copiedItem', 'forbidden'],
            'unknown submission field' => ['submission', 'section', 'A'],
        ];
    }

    public function testAcceptsUtf8LimitsNullableFieldsAndEmptyUrls()
    {
        $payload = [
            'format' => 'faculty-save-operations-v1',
            'operations' => [
                [
                    'op' => 'create_item', 'client_key' => 'item-a', 'folder' => null,
                    'data' => [
                        'title' => 'Synthetic title', 'material_type' => 'book', 'barcode' => str_repeat('é', 255),
                        'url' => null, 'displayStartDate' => null,
                    ],
                ],
                [
                    'op' => 'create_item', 'client_key' => 'item-b', 'folder' => null,
                    'data' => ['title' => 'Synthetic title', 'material_type' => 'book', 'url' => ''],
                ],
            ],
        ];
        $result = FacultySaveOperations::parse($payload);
        $this->assertSame(str_repeat('é', 255), $result['operations'][0]['data']['barcode']);
        $this->assertNull($result['operations'][0]['data']['url']);
        $this->assertNull($result['operations'][0]['data']['displayStartDate']);
        $this->assertSame('', $result['operations'][1]['data']['url']);
    }

    public function testAcceptsCreateOnlyMetadata()
    {
        $data = [
            'title' => 'Synthetic title', 'material_type' => 'book', 'is_reuse' => true, 'priority' => 'high',
            'eds' => ['dbId' => null, 'an' => '123456', 'plink' => null],
            'temporary_location' => ['id' => 'loc-1', 'name' => null, 'code' => 'STACKS'],
            'permanent_location' => null,
        ];
        $payload = [
            'format' => 'faculty-save-operations-v1',
            'operations' => [[
                'op' => 'create_item', 'client_key' => 'item-a', 'folder' => null, 'data' => $data,
            ]],
        ];
        $result = FacultySaveOperations::parse($payload);
        $this->assertSame($data, $result['operations'][0]['data']);
    }

    private function changeField(array &$fields, $field, $value, $remove)
    {
        if ($remove) {
            unset($fields[$field]);
        } else {
            $fields[$field] = $value;
        }
    }
}
