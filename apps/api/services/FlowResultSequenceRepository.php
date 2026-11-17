<?php

namespace app\services;

use Yii;

/** Counts the outcomes recorded on a flow run. */
class FlowResultSequenceRepository
{
    public function count($runId, $forUpdate = false)
    {
        $sql = 'SELECT id FROM item_flow_step_results WHERE run_id = :run_id ORDER BY id'
            . ($forUpdate ? ' FOR UPDATE' : '');
        return count(Yii::$app->db->createCommand($sql, [':run_id' => (int)$runId])->queryColumn());
    }
}
