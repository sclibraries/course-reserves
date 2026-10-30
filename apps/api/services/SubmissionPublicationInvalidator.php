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
        $params = [];
        $newHolders = $this->inList($ids, 'new_type_', $params);
        $reuseHolders = $this->inList($ids, 'reuse_type_', $params);
        $newType = EffectiveMaterialType::sql('item', 'source');
        $reuseType = EffectiveMaterialType::sql('item', 'source');
        $rows = Yii::$app->db->createCommand(
            'SELECT "new" AS kind, item.id, item.submission_id FROM submission_new_resources item '
            . 'LEFT JOIN resources source ON source.resource_id = item.source_resource_id '
            . 'WHERE ' . $newType . ' IN (' . $newHolders . ') UNION ALL '
            . 'SELECT "reuse" AS kind, item.id, item.submission_id FROM submission_reuse_resources item '
            . 'LEFT JOIN resources source ON source.resource_id = item.source_resource_id '
            . 'WHERE ' . $reuseType . ' IN (' . $reuseHolders . ') ORDER BY kind, id',
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
        $params = [];
        $newHolders = $this->inList($paths, 'new_path_', $params);
        $reuseHolders = $this->inList($paths, 'reuse_path_', $params);
        $rows = Yii::$app->db->createCommand(
            'SELECT "new" AS kind, id, submission_id FROM submission_new_resources '
            . 'WHERE access_path IN (' . $newHolders . ') UNION ALL '
            . 'SELECT "reuse" AS kind, id, submission_id FROM submission_reuse_resources '
            . 'WHERE access_path IN (' . $reuseHolders . ') ORDER BY kind, id',
            $params
        )->queryAll();
        $this->invalidateRows($rows);
    }

    public function unpinnedFlowItems($flowId)
    {
        $newType = EffectiveMaterialType::sql('item', 'source');
        $reuseType = EffectiveMaterialType::sql('item', 'source');
        $rows = Yii::$app->db->createCommand(
            'SELECT "new" AS kind, item.id, item.submission_id FROM submission_new_resources item '
            . 'LEFT JOIN resources source ON source.resource_id = item.source_resource_id '
            . 'INNER JOIN material_type_flows mapping ON mapping.material_type_id = ' . $newType . ' '
            . 'WHERE mapping.flow_id = :flow_id AND NOT EXISTS (SELECT 1 FROM item_flow_runs run '
            . 'WHERE run.item_kind = "new" AND run.item_id = item.id) UNION ALL '
            . 'SELECT "reuse" AS kind, item.id, item.submission_id FROM submission_reuse_resources item '
            . 'LEFT JOIN resources source ON source.resource_id = item.source_resource_id '
            . 'INNER JOIN material_type_flows mapping ON mapping.material_type_id = ' . $reuseType . ' '
            . 'WHERE mapping.flow_id = :flow_id AND NOT EXISTS (SELECT 1 FROM item_flow_runs run '
            . 'WHERE run.item_kind = "reuse" AND run.item_id = item.id) ORDER BY kind, id',
            [':flow_id' => (int)$flowId]
        )->queryAll();
        $this->invalidateRows($rows);
    }

    public function sourceResource($resourceId)
    {
        Transactional::run(function () use ($resourceId) {
            $rows = Yii::$app->db->createCommand(
                'SELECT "new" AS kind, id, submission_id FROM submission_new_resources '
                . 'WHERE source_resource_id = :new_id UNION ALL '
                . 'SELECT "reuse" AS kind, id, submission_id FROM submission_reuse_resources '
                . 'WHERE source_resource_id = :reuse_id ORDER BY kind, id',
                [':new_id' => (string)$resourceId, ':reuse_id' => (int)$resourceId]
            )->queryAll();
            $this->invalidateRows($rows, true);
        });
    }

    private function invalidateRows(array $rows, $draft = false)
    {
        foreach ($rows as $row) {
            Yii::$app->db->createCommand(
                'SELECT submission_id FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
                [':id' => (int)$row['submission_id']]
            )->queryScalar();
            $item = $this->items->find($row['kind'], $row['id'], true);
            if ($item && (int)$item['submission_id'] === (int)$row['submission_id']) {
                if ($draft) {
                    $this->publication->invalidateDraft($row['kind'], $row['id'], $row['submission_id']);
                } else {
                    $this->publication->invalidateContext($row['kind'], $row['id'], $row['submission_id']);
                }
            }
        }
    }

    private function inList(array $values, $prefix, array &$params)
    {
        $placeholders = [];
        foreach ($values as $index => $value) {
            $placeholder = ':' . $prefix . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $value;
        }
        return implode(', ', $placeholders);
    }
}
