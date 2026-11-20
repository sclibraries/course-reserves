<?php

namespace app\services;

use Yii;

/** Reads one material-type mapping and its current flow definition inside the caller's transaction. */
class FlowMappingReadRepository
{
    public function materialTypeFlow($materialTypeId)
    {
        $mapping = Yii::$app->db->createCommand(
            'SELECT flow_id FROM material_type_flows WHERE material_type_id = :id LOCK IN SHARE MODE',
            [':id' => (int)$materialTypeId]
        )->queryOne();
        if (!$mapping || $mapping['flow_id'] === null) {
            return null;
        }
        return $this->definition((int)$mapping['flow_id']);
    }

    private function definition($flowId)
    {
        $flow = Yii::$app->db->createCommand(
            'SELECT id, name FROM flows WHERE id = :id LOCK IN SHARE MODE',
            [':id' => (int)$flowId]
        )->queryOne();
        if (!$flow) {
            return null;
        }
        $version = Yii::$app->db->createCommand(
            'SELECT version, steps_json FROM flow_versions WHERE flow_id = :id '
            . 'ORDER BY version DESC LIMIT 1 LOCK IN SHARE MODE',
            [':id' => (int)$flowId]
        )->queryOne();
        if (!$version) {
            return null;
        }
        return [
            'id' => (int)$flow['id'],
            'name' => $flow['name'],
            'version' => (int)$version['version'],
            'steps_json' => $version['steps_json'],
        ];
    }
}
