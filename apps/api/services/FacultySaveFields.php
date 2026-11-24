<?php

namespace app\services;

/** Validates faculty-editable fields without reading application state. */
class FacultySaveFields
{
    const NULLABLE_STRING = ['type' => 'string', 'limit' => null, 'create_only' => false];
    const ID_VALUE = ['type' => 'string', 'limit' => 255];
    const CREATE_STRING = ['type' => 'string', 'limit' => null, 'create_only' => true];
    const CREATE_ID = ['type' => 'string', 'limit' => 255, 'create_only' => true];
    const DATE = ['type' => 'date', 'limit' => null, 'create_only' => false];
    const BYTE_LIMIT = ['type' => 'bytes', 'limit' => 65535, 'create_only' => false];
    const LOCATION = [
        'type' => 'map', 'limit' => null, 'create_only' => true,
        'members' => [
            'id' => self::ID_VALUE,
            'name' => self::NULLABLE_STRING,
            'code' => self::NULLABLE_STRING,
        ],
    ];
    const RULES = [
        'item' => [
            'title' => ['type' => 'nonblank', 'limit' => null, 'create_only' => false, 'required' => true],
            'material_type' => ['type' => 'material_type', 'limit' => null, 'create_only' => false, 'required' => true],
            'authors' => self::NULLABLE_STRING,
            'publisher' => self::NULLABLE_STRING,
            'publicationYear' => self::NULLABLE_STRING,
            'isbn' => self::NULLABLE_STRING,
            'issn' => self::NULLABLE_STRING,
            'doi' => self::NULLABLE_STRING,
            'edition' => self::NULLABLE_STRING,
            'oclcNumber' => self::NULLABLE_STRING,
            'journalTitle' => self::NULLABLE_STRING,
            'volume' => self::NULLABLE_STRING,
            'issue' => self::NULLABLE_STRING,
            'pages' => self::NULLABLE_STRING,
            'url' => ['type' => 'url', 'limit' => null, 'create_only' => false],
            'displayStartDate' => self::DATE,
            'displayEndDate' => self::DATE,
            'assignedPages' => self::BYTE_LIMIT,
            'faculty_notes' => self::BYTE_LIMIT,
            'is_reuse' => ['type' => 'boolean', 'limit' => null, 'create_only' => true, 'default' => false],
            'priority' => [
                'type' => 'priority', 'limit' => null, 'create_only' => true, 'default' => 'medium',
            ],
            'barcode' => self::CREATE_ID,
            'call_number' => ['type' => 'string', 'limit' => 512, 'create_only' => true],
            'source_resource_id' => self::CREATE_ID,
            'source_folio_instance_id' => self::CREATE_ID,
            'instance_id' => self::CREATE_ID,
            'instance_hrid' => self::CREATE_ID,
            'holdings_id' => self::CREATE_ID,
            'chapter_title' => self::CREATE_STRING,
            'copy' => self::CREATE_STRING,
            'temporary_location_id' => self::CREATE_ID,
            'permanent_location_id' => self::CREATE_ID,
            'eds' => [
                'type' => 'map', 'limit' => null, 'create_only' => true,
                'members' => [
                    'dbId' => ['type' => 'string', 'limit' => 255],
                    'an' => ['type' => 'string', 'limit' => null],
                    'plink' => ['type' => 'string', 'limit' => null],
                ],
            ],
            'temporary_location' => self::LOCATION,
            'permanent_location' => self::LOCATION,
        ],
        'submission' => [
            'submission_notes' => self::BYTE_LIMIT,
            'needed_by_date' => self::DATE,
            'course_title' => ['type' => 'nonblank', 'limit' => 500, 'create_only' => false],
        ],
        'folder' => [
            'name' => ['type' => 'nonblank', 'limit' => 255, 'create_only' => false],
        ],
    ];

    public static function item(array $fields, $create)
    {
        return self::validate('item', $fields, $create);
    }

    public static function submission(array $fields)
    {
        return self::validate('submission', $fields, false);
    }

    public static function folderName($name)
    {
        $result = self::validate('folder', ['name' => $name], false);
        return $result === false ? false : $result['name'];
    }

    private static function validate($scope, array $fields, $create)
    {
        $result = [];
        foreach ($fields as $name => $value) {
            if (!isset(self::RULES[$scope][$name])) {
                return false;
            }
            $rule = self::RULES[$scope][$name];
            if (($rule['create_only'] && !$create) || !self::normalize($value, $rule, $normalized)) {
                return false;
            }
            $result[$name] = $normalized;
        }

        foreach (self::RULES[$scope] as $name => $rule) {
            if ($create && !empty($rule['required']) && !array_key_exists($name, $result)) {
                return false;
            }
            if ($create && array_key_exists('default', $rule) && !array_key_exists($name, $result)) {
                $result[$name] = $rule['default'];
            }
        }
        return $result;
    }

    private static function normalize($value, array $rule, &$normalized)
    {
        $type = $rule['type'];
        if ($type === 'string' || $type === 'bytes' || $type === 'nonblank') {
            if (!is_string($value) && !($type !== 'nonblank' && $value === null)) {
                return false;
            }
            if ($type === 'nonblank' && trim($value) === '') {
                return false;
            }
            if ($value !== null && $rule['limit'] !== null) {
                $length = $type === 'bytes' ? strlen($value) : mb_strlen($value, 'UTF-8');
                if ($length > $rule['limit']) {
                    return false;
                }
            }
            $normalized = $value;
            return true;
        }
        if ($type === 'material_type') {
            if (!is_string($value) || !in_array($value, EffectiveMaterialType::KEYS, true)) {
                return false;
            }
            $normalized = $value;
            return true;
        }
        if ($type === 'url') {
            if ($value === null || $value === '') {
                $normalized = $value;
                return true;
            }
            $normalized = \app\components\ResourceUrl::normalize($value);
            return $normalized !== null;
        }
        if ($type === 'date') {
            if ($value === null) {
                $normalized = null;
                return true;
            }
            if (!is_string($value)) {
                return false;
            }
            $date = \DateTime::createFromFormat('!Y-m-d', $value);
            if ($date === false || $date->format('Y-m-d') !== $value) {
                return false;
            }
            $normalized = $value;
            return true;
        }
        if ($type === 'boolean') {
            if (!is_bool($value)) {
                return false;
            }
            $normalized = $value;
            return true;
        }
        if ($type === 'priority') {
            if (!is_string($value) || !in_array($value, ['high', 'medium', 'low'], true)) {
                return false;
            }
            $normalized = $value;
            return true;
        }
        if ($type === 'map') {
            if ($value === null) {
                $normalized = null;
                return true;
            }
            $members = $rule['members'];
            if (!is_array($value) || count($value) !== count($members)
                || array_diff(array_keys($value), array_keys($members))) {
                return false;
            }
            $normalized = [];
            foreach ($members as $name => $memberRule) {
                if (!array_key_exists($name, $value) || !self::normalize($value[$name], $memberRule, $member)) {
                    return false;
                }
                $normalized[$name] = $member;
            }
            return true;
        }
        return false;
    }
}
