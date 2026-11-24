<?php

namespace app\services;

/** Validates faculty-editable fields without reading application state. */
class FacultySaveFields
{
    const STRING_TYPES = ['string', 'bytes', 'nonblank', 'url', 'date', 'material_type', 'priority'];
    const NULLABLE_STRING = ['type' => 'string'];
    const ID_VALUE = ['type' => 'string', 'limit' => 255];
    const CREATE_STRING = ['type' => 'string', 'create_only' => true];
    const CREATE_ID = ['type' => 'string', 'limit' => 255, 'create_only' => true];
    const DATE = ['type' => 'date'];
    const BYTE_LIMIT = ['type' => 'bytes', 'limit' => 65535];
    const LOCATION = [
        'type' => 'map', 'create_only' => true,
        'members' => [
            'id' => self::ID_VALUE,
            'name' => self::NULLABLE_STRING,
            'code' => self::NULLABLE_STRING,
        ],
    ];
    const RULES = [
        'item' => [
            'title' => ['type' => 'nonblank', 'required' => true],
            'material_type' => ['type' => 'material_type', 'required' => true],
            'authors' => self::NULLABLE_STRING, 'publisher' => self::NULLABLE_STRING,
            'publicationYear' => self::NULLABLE_STRING, 'isbn' => self::NULLABLE_STRING,
            'issn' => self::NULLABLE_STRING, 'doi' => self::NULLABLE_STRING,
            'edition' => self::NULLABLE_STRING, 'oclcNumber' => self::NULLABLE_STRING,
            'journalTitle' => self::NULLABLE_STRING, 'volume' => self::NULLABLE_STRING,
            'issue' => self::NULLABLE_STRING, 'pages' => self::NULLABLE_STRING,
            'url' => ['type' => 'url'],
            'displayStartDate' => self::DATE, 'displayEndDate' => self::DATE,
            'assignedPages' => self::BYTE_LIMIT, 'faculty_notes' => self::BYTE_LIMIT,
            'is_reuse' => ['type' => 'boolean', 'create_only' => true, 'default' => false],
            'priority' => ['type' => 'priority', 'create_only' => true, 'default' => 'medium'],
            'barcode' => self::CREATE_ID,
            'call_number' => ['type' => 'string', 'limit' => 512, 'create_only' => true],
            'source_resource_id' => self::CREATE_ID, 'source_folio_instance_id' => self::CREATE_ID,
            'instance_id' => self::CREATE_ID, 'instance_hrid' => self::CREATE_ID,
            'holdings_id' => self::CREATE_ID,
            'chapter_title' => self::CREATE_STRING,
            'copy' => self::CREATE_STRING,
            'temporary_location_id' => self::CREATE_ID,
            'permanent_location_id' => self::CREATE_ID,
            'eds' => [
                'type' => 'map', 'create_only' => true,
                'members' => [
                    'dbId' => ['type' => 'string', 'limit' => 255], 'an' => ['type' => 'string'],
                    'plink' => ['type' => 'string'],
                ],
            ],
            'temporary_location' => self::LOCATION,
            'permanent_location' => self::LOCATION,
        ],
        'submission' => [
            'submission_notes' => self::BYTE_LIMIT,
            'needed_by_date' => self::DATE,
            'course_title' => ['type' => 'nonblank', 'limit' => 500],
        ],
        'folder' => [
            'name' => ['type' => 'nonblank', 'limit' => 255],
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
        return self::validate('folder', ['name' => $name], false)['name'];
    }

    private static function validate($scope, array $fields, $create)
    {
        $result = [];
        foreach ($fields as $name => $value) {
            self::ensure(isset(self::RULES[$scope][$name]));
            $rule = self::RULES[$scope][$name];
            self::ensure(empty($rule['create_only']) || $create);
            $result[$name] = self::normalize($value, $rule);
        }
        foreach (self::RULES[$scope] as $name => $rule) {
            self::ensure(!$create || empty($rule['required']) || array_key_exists($name, $result));
            if ($create && array_key_exists('default', $rule) && !array_key_exists($name, $result)) {
                $result[$name] = $rule['default'];
            }
        }
        return $result;
    }

    private static function normalize($value, array $rule)
    {
        $type = $rule['type'];
        if ($value === null) {
            self::ensure(!in_array($type, ['nonblank', 'material_type', 'boolean', 'priority'], true));
            return null;
        }
        self::ensure(!in_array($type, self::STRING_TYPES, true) || is_string($value));
        if (isset($rule['limit'])) {
            self::ensure(($type === 'bytes' ? strlen($value) : mb_strlen($value, 'UTF-8')) <= $rule['limit']);
        }

        switch ($type) {
            case 'string':
            case 'bytes':
                return $value;
            case 'nonblank':
                self::ensure(trim($value) !== ''); return $value;
            case 'material_type':
                self::ensure(in_array($value, EffectiveMaterialType::KEYS, true)); return $value;
            case 'url':
                $url = $value === '' ? '' : \app\components\ResourceUrl::normalize($value);
                self::ensure($url !== null); return $url;
            case 'date':
                $date = \DateTime::createFromFormat('!Y-m-d', $value);
                self::ensure($date !== false && $date->format('Y-m-d') === $value); return $value;
            case 'boolean':
                self::ensure(is_bool($value)); return $value;
            case 'priority':
                self::ensure(in_array($value, ['high', 'medium', 'low'], true)); return $value;
            case 'map':
                return self::normalizeMap($value, $rule['members']);
            default:
                self::ensure(false);
        }
    }

    private static function normalizeMap($value, array $members)
    {
        self::ensure(is_array($value) && count($value) === count($members));
        $result = [];
        foreach ($members as $name => $rule) {
            self::ensure(array_key_exists($name, $value));
            $result[$name] = self::normalize($value[$name], $rule);
        }
        return $result;
    }

    private static function ensure($condition)
    {
        if (!$condition) {
            throw new \DomainException('payload_format');
        }
    }
}
