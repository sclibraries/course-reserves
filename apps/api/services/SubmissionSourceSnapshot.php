<?php

namespace app\services;

use Yii;

/** Captures only the source resource fields the item projection is allowed to inherit. */
class SubmissionSourceSnapshot
{
    public static function capture($resourceId)
    {
        if ($resourceId === null || trim((string)$resourceId) === '') {
            return null;
        }
        $source = Yii::$app->db->createCommand(
            'SELECT name, item_url, description, material_type_id, start_visibility, end_visibility, use_proxy '
            . 'FROM resources WHERE resource_id = :id LIMIT 1',
            [':id' => $resourceId]
        )->queryOne();
        if (!$source) {
            return null;
        }
        return [
            'title' => $source['name'],
            'url' => $source['item_url'],
            'description' => $source['description'],
            'material_type_id' => $source['material_type_id'] === null ? null : (int)$source['material_type_id'],
            'display_start_date' => $source['start_visibility'],
            'display_end_date' => $source['end_visibility'],
            'use_proxy' => (int)$source['use_proxy'],
        ];
    }
}
