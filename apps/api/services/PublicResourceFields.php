<?php

namespace app\services;

use app\components\Roles;
use yii\base\Arrayable;

/**
 * Allowlisted fields for resource data returned by public API routes.
 *
 * Keep the endpoint's existing public fields here. Staff-only resource fields
 * are added only when the request has an authenticated staff identity.
 */
class PublicResourceFields
{
    private const PUBLIC_FIELDS = [
        'resource_id',
        'legacy_resource_id',
        'name',
        'item_url',
        'use_proxy',
        'folder_id',
        'description',
        'external_note',
        'start_visibility',
        'end_visibility',
        'institution',
        'material_type_id',
        'created_at',
        'order',
        'use_primary_link_visibility',
        'primary_link_start_visibility',
        'primary_link_end_visibility',
        'material_type_name',
        'course_count',
        'course_resource_id',
        'folder_name',
        'use_resource_visibility',
        'resource_type',
        'id',
        'title',
        'reference_id',
        'display_name',
        'metadata',
        'links',
    ];

    private const STAFF_FIELDS = ['internal_note'];

    private const METADATA_FIELDS = [
        'metadata_id',
        'resource_id',
        'field_name',
        'field_value',
        'created_at',
    ];

    private const LINK_FIELDS = [
        'link_id',
        'resource_id',
        'url',
        'title',
        'description',
        'use_proxy',
        'order',
        'created_at',
        'start_visibility',
        'end_visibility',
        'use_link_visibility',
    ];

    public static function serialize($resource, $identity)
    {
        if ($resource instanceof Arrayable) {
            $resource = $resource->toArray();
        }
        if (!is_array($resource)) {
            return $resource;
        }

        $allowed = self::allowedFields($identity);

        $serialized = [];
        foreach ($resource as $field => $value) {
            if (!isset($allowed[$field])) {
                continue;
            }
            if ($field === 'metadata') {
                $value = self::serializeRows($value, self::METADATA_FIELDS);
            } elseif ($field === 'links') {
                $value = self::serializeRows($value, self::LINK_FIELDS);
            }
            $serialized[$field] = $value;
        }

        return $serialized;
    }

    public static function serializeMany(array $resources, $identity)
    {
        $serialized = [];
        foreach ($resources as $key => $resource) {
            $serialized[$key] = self::serialize($resource, $identity);
        }

        return $serialized;
    }

    public static function filterFieldDefinitions(array $fields, $identity)
    {
        $allowed = self::allowedFields($identity);
        $filtered = [];
        foreach ($fields as $key => $definition) {
            $name = is_string($key) ? $key : $definition;
            if (isset($allowed[$name])) {
                $filtered[$key] = $definition;
            }
        }

        return $filtered;
    }

    private static function allowedFields($identity)
    {
        $fields = self::PUBLIC_FIELDS;
        if (Roles::isStaff($identity->role ?? null)) {
            $fields = array_merge($fields, self::STAFF_FIELDS);
        }

        return array_flip($fields);
    }

    private static function serializeRows($rows, array $fields)
    {
        if (!is_array($rows)) {
            return $rows;
        }

        $allowed = array_flip($fields);
        foreach ($rows as $key => $row) {
            if ($row instanceof Arrayable) {
                $row = $row->toArray();
            }
            if (is_array($row)) {
                $filtered = [];
                foreach ($row as $field => $value) {
                    if (isset($allowed[$field])) {
                        $filtered[$field] = $value;
                    }
                }
                $rows[$key] = $filtered;
            }
        }

        return $rows;
    }
}
