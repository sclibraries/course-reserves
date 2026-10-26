<?php

namespace app\services;

use Yii;

/** Persists the admin mapping from acquisition paths to flows and staff groups. */
class AccessPathMappingRepository
{
    public function find($accessPath)
    {
        return Yii::$app->db->createCommand(
            'SELECT access_path, flow_id, group_id FROM access_path_flows WHERE access_path = :path LIMIT 1',
            [':path' => $accessPath]
        )->queryOne() ?: null;
    }

    public function all()
    {
        return Yii::$app->db->createCommand(
            'SELECT access_path, flow_id, group_id FROM access_path_flows ORDER BY access_path'
        )->queryAll();
    }

    public function flowExists($id)
    {
        return (bool)Yii::$app->db->createCommand(
            'SELECT 1 FROM flows WHERE id = :id LIMIT 1', [':id' => (int)$id]
        )->queryScalar();
    }

    public function groupExists($id)
    {
        return (bool)Yii::$app->db->createCommand(
            'SELECT 1 FROM staff_groups WHERE id = :id LIMIT 1', [':id' => (int)$id]
        )->queryScalar();
    }

    public function replace(array $rows)
    {
        Yii::$app->db->createCommand()->delete('access_path_flows')->execute();
        foreach ($rows as $row) {
            Yii::$app->db->createCommand()->insert('access_path_flows', $row)->execute();
        }
    }
}
