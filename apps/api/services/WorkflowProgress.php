<?php
namespace app\services;

use yii\db\Query;

/**
 * Helpers to recompute progress and derive instance status using the checklist rows.
 */
class WorkflowProgress
{
    /**
     * Compute percentage based on required steps only.
     *
     * @param int $instanceId
     * @return float
     */
    public static function computeRequiredOnly($instanceId)
    {
        $query = new Query();

        $total = (clone $query)
            ->from('workflow_steps s')
            ->innerJoin(
                'workflow_instance_steps wis',
                'wis.step_id = s.id AND wis.instance_id = :iid',
                [':iid' => $instanceId]
            )
            ->where(['s.is_required' => 1])
            ->count('*');

        if (!$total) {
            return 100.0;
        }

        $completed = (clone $query)
            ->from('workflow_steps s')
            ->innerJoin(
                'workflow_instance_steps wis',
                'wis.step_id = s.id AND wis.instance_id = :iid',
                [':iid' => $instanceId]
            )
            ->where(['s.is_required' => 1, 'wis.status' => 'completed'])
            ->count('*');

        return round(($completed / $total) * 100, 2);
    }

    /**
     * Derive high-level instance status from step statuses.
     *
     * @param int $instanceId
     * @return string
     */
    public static function deriveStatus($instanceId)
    {
        $query = new Query();
        $rows = (clone $query)
            ->from('workflow_steps s')
            ->innerJoin(
                'workflow_instance_steps wis',
                'wis.step_id = s.id AND wis.instance_id = :iid',
                [':iid' => $instanceId]
            )
            ->where(['s.is_required' => 1])
            ->all();

        if (!$rows) {
            return 'completed';
        }

        $anyBlocked = false;
        $anyTouched = false;
        $allDone = true;

        foreach ($rows as $row) {
            $status = isset($row['status']) ? $row['status'] : null;

            if (in_array($status, ['in_progress', 'blocked', 'skipped', 'completed'], true)) {
                $anyTouched = true;
            }
            if ($status === 'blocked') {
                $anyBlocked = true;
            }
            if ($status !== 'completed') {
                $allDone = false;
            }
        }

        if ($allDone) {
            return 'completed';
        }
        if ($anyBlocked) {
            return 'on_hold';
        }
        return $anyTouched ? 'in_progress' : 'not_started';
    }
}
