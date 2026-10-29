<?php

namespace app\services;

use Yii;

/** Finds items affected by shared flow and access-path mapping writes and invalidates them under lock. */
class SubmissionPublicationInvalidator
{
    private $items;
    private $publication;

    public function __construct($items = null, $publication = null)
    {
        $this->items = $items ?: new ItemClaimRepository();
        $this->publication = $publication ?: Yii::$container->get(SubmissionPublicationStateService::class);
    }

    public function materialTypes(array $materialTypeIds)
    {
        $ids = array_values(array_unique(array_map('intval', $materialTypeIds)));
        if (!$ids) {
            return;
        }
        $holders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge($ids, $ids);
        $rows = Yii::$app->db->createCommand(
            'SELECT "new" AS kind, id, submission_id FROM submission_new_resources '
            . 'WHERE material_type_id IN (' . $holders . ') UNION ALL '
            . 'SELECT "reuse" AS kind, item.id, item.submission_id FROM submission_reuse_resources item '
            . 'LEFT JOIN resources source ON source.resource_id = item.source_resource_id '
            . 'WHERE source.material_type_id IN (' . $holders . ') ORDER BY kind, id',
            $params
        )->queryAll();
        $this->invalidateRows($rows);
    }

    public function accessPaths(array $accessPaths)
    {
        $paths = array_values(array_unique(array_filter($accessPaths, 'is_string')));
        if (!$paths) {
            return;
        }
        $holders = implode(',', array_fill(0, count($paths), '?'));
        $params = array_merge($paths, $paths);
        $rows = Yii::$app->db->createCommand(
            'SELECT "new" AS kind, id, submission_id FROM submission_new_resources '
            . 'WHERE access_path IN (' . $holders . ') UNION ALL '
            . 'SELECT "reuse" AS kind, id, submission_id FROM submission_reuse_resources '
            . 'WHERE access_path IN (' . $holders . ') ORDER BY kind, id',
            $params
        )->queryAll();
        $this->invalidateRows($rows);
    }

    public function unpinnedFlowItems($flowId)
    {
        $rows = Yii::$app->db->createCommand(
            'SELECT "new" AS kind, item.id, item.submission_id FROM submission_new_resources item '
            . 'INNER JOIN material_type_flows mapping ON mapping.material_type_id = item.material_type_id '
            . 'WHERE mapping.flow_id = :flow_id AND NOT EXISTS (SELECT 1 FROM item_flow_runs run '
            . 'WHERE run.item_kind = "new" AND run.item_id = item.id) UNION ALL '
            . 'SELECT "reuse" AS kind, item.id, item.submission_id FROM submission_reuse_resources item '
            . 'INNER JOIN resources source ON source.resource_id = item.source_resource_id '
            . 'INNER JOIN material_type_flows mapping ON mapping.material_type_id = source.material_type_id '
            . 'WHERE mapping.flow_id = :flow_id AND NOT EXISTS (SELECT 1 FROM item_flow_runs run '
            . 'WHERE run.item_kind = "reuse" AND run.item_id = item.id) ORDER BY kind, id',
            [':flow_id' => (int)$flowId]
        )->queryAll();
        $this->invalidateRows($rows);
    }

    private function invalidateRows(array $rows)
    {
        foreach ($rows as $row) {
            Yii::$app->db->createCommand(
                'SELECT submission_id FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
                [':id' => (int)$row['submission_id']]
            )->queryScalar();
            $item = $this->items->find($row['kind'], $row['id'], true);
            if ($item && (int)$item['submission_id'] === (int)$row['submission_id']) {
                $this->publication->invalidateContext($row['kind'], $row['id'], $row['submission_id']);
            }
        }
    }
}
