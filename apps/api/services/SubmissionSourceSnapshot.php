<?php

namespace app\services;

use Yii;

/** Captures the versioned, allowlisted source inputs a course-specific copy needs. */
class SubmissionSourceSnapshot
{
    public const BIBLIOGRAPHIC_FIELDS = [
        'title' => ['title'],
        'authors' => ['authors'],
        'publisher' => ['publisher'],
        'publicationYear' => ['publicationYear', 'publication_year'],
        'isbn' => ['isbn'],
        'issn' => ['issn'],
        'doi' => ['doi'],
        'journalTitle' => ['journalTitle', 'journal_title'],
        'volume' => ['volume'],
        'issue' => ['issue'],
        'edition' => ['edition'],
        'pages' => ['pages'],
    ];

    public static function capture($resourceId)
    {
        if ($resourceId === null || trim((string)$resourceId) === '') {
            return null;
        }
        $source = Yii::$app->db->createCommand(
            'SELECT name, item_url, description, material_type_id, start_visibility, end_visibility, use_proxy, '
            . 'use_primary_link_visibility, primary_link_start_visibility, primary_link_end_visibility '
            . 'FROM resources WHERE resource_id = :id LIMIT 1',
            [':id' => $resourceId]
        )->queryOne();
        if (!$source) {
            return null;
        }

        return [
            'version' => 2,
            'title' => $source['name'],
            'url' => $source['item_url'],
            'description' => $source['description'],
            'material_type_id' => $source['material_type_id'] === null ? null : (int)$source['material_type_id'],
            'display_start_date' => $source['start_visibility'],
            'display_end_date' => $source['end_visibility'],
            'use_proxy' => (int)$source['use_proxy'],
            'copy_inputs' => [
                'primary_link' => [
                    'url' => $source['item_url'],
                    'use_proxy' => (int)$source['use_proxy'],
                    'use_primary_link_visibility' => (int)$source['use_primary_link_visibility'],
                    'primary_link_start_visibility' => $source['primary_link_start_visibility'],
                    'primary_link_end_visibility' => $source['primary_link_end_visibility'],
                ],
                'additional_links' => self::additionalLinks($resourceId),
                'bibliographic_metadata' => self::bibliographicMetadata($resourceId),
            ],
        ];
    }

    public static function emptySnapshot()
    {
        return [
            'version' => 2,
            'copy_inputs' => [
                'primary_link' => [
                    'url' => null,
                    'use_proxy' => 0,
                    'use_primary_link_visibility' => 0,
                    'primary_link_start_visibility' => null,
                    'primary_link_end_visibility' => null,
                ],
                'additional_links' => [],
                'bibliographic_metadata' => array_fill_keys(array_keys(self::BIBLIOGRAPHIC_FIELDS), null),
            ],
        ];
    }

    private static function additionalLinks($resourceId)
    {
        $rows = Yii::$app->db->createCommand(
            'SELECT url, title, `order`, use_proxy, use_link_visibility, start_visibility, end_visibility '
            . 'FROM resource_links WHERE resource_id = :id ORDER BY `order`, url, title',
            [':id' => (int)$resourceId]
        )->queryAll();
        return array_map(function ($row) {
            return [
                'url' => $row['url'],
                'label' => $row['title'],
                'order' => $row['order'] === null ? null : (int)$row['order'],
                'use_proxy' => (int)$row['use_proxy'],
                'use_link_visibility' => (int)$row['use_link_visibility'],
                'start_visibility' => $row['start_visibility'],
                'end_visibility' => $row['end_visibility'],
            ];
        }, $rows);
    }

    private static function bibliographicMetadata($resourceId)
    {
        $fieldNames = [];
        foreach (self::BIBLIOGRAPHIC_FIELDS as $aliases) {
            $fieldNames = array_merge($fieldNames, $aliases);
        }
        $holders = [];
        $params = [':resource_id' => (int)$resourceId];
        foreach (array_values(array_unique($fieldNames)) as $index => $fieldName) {
            $holder = ':field_' . $index;
            $holders[] = $holder;
            $params[$holder] = $fieldName;
        }
        $rows = Yii::$app->db->createCommand(
            'SELECT field_name, field_value FROM resource_metadata WHERE resource_id = :resource_id '
            . 'AND field_name IN (' . implode(', ', $holders) . ') ORDER BY field_name, field_value',
            $params
        )->queryAll();
        $metadata = array_fill_keys(array_keys(self::BIBLIOGRAPHIC_FIELDS), null);
        foreach ($rows as $row) {
            foreach (self::BIBLIOGRAPHIC_FIELDS as $field => $aliases) {
                if (in_array($row['field_name'], $aliases, true)) {
                    $metadata[$field] = $row['field_value'];
                    break;
                }
            }
        }
        return $metadata;
    }
}
