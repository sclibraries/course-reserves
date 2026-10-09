<?php
namespace app\services;

use yii\db\Query;
use app\models\WorkflowStep;
use app\models\WorkflowInstance;

/**
 * Guard rails for checklist style step transitions.
 */
class WorkflowGuard
{
    /**
     * Determine whether a step status can transition using the requested action.
     *
     * @param string $from
     * @param string $action
     * @return bool
     */
    public static function canTransition($from, $action)
    {
        $map = [
            'not_started' => ['start', 'complete', 'block', 'skip', 'assign'],
            'in_progress' => ['complete', 'block', 'skip', 'assign'],
            'blocked'     => ['start', 'complete', 'skip', 'revert', 'assign'],
            'skipped'     => ['revert', 'assign'],
            'completed'   => ['revert', 'assign'],
        ];

        return in_array($action, isset($map[$from]) ? $map[$from] : [], true);
    }

    /**
     * Make sure requirements are met before allowing completion.
     *
     * @param WorkflowInstance $instance
     * @param int $stepId
     * @return array tuple [bool ok, array blockers]
     */
    public static function canComplete(WorkflowInstance $instance, $stepId)
    {
        $step = WorkflowStep::findOne($stepId);
        if (!$step) {
            return [false, ['unknown_step']];
        }

        $query = new Query();
        $blockers = [];

        $gateRows = (clone $query)
            ->from('workflow_steps s')
            ->innerJoin(
                'workflow_instance_steps wis',
                'wis.step_id = s.id AND wis.instance_id = :iid',
                [':iid' => $instance->id]
            )
            ->where([
                's.template_id' => $instance->template_id,
                's.is_required' => 1,
                's.is_gate' => 1,
            ])
            ->all();

        foreach ($gateRows as $row) {
            $status = isset($row['status']) ? $row['status'] : null;
            if ($status !== 'completed') {
                $blockers[] = isset($row['step_key']) ? $row['step_key'] : ('step_' . $row['id']);
            }
        }

        $dependsOn = self::normalizeDependsOn($step->depends_on);
        if (is_array($dependsOn) && !empty($dependsOn)) {
            $dependencyRows = (clone $query)
                ->from('workflow_steps s')
                ->innerJoin(
                    'workflow_instance_steps wis',
                    'wis.step_id = s.id AND wis.instance_id = :iid',
                    [':iid' => $instance->id]
                )
                ->where(['s.template_id' => $instance->template_id])
                ->andWhere(['s.step_key' => $dependsOn])
                ->all();

            foreach ($dependencyRows as $row) {
                $status = isset($row['status']) ? $row['status'] : null;
                if ($status !== 'completed') {
                    $blockers[] = isset($row['step_key']) ? $row['step_key'] : ('step_' . $row['id']);
                }
            }
        }

        $blockers = array_values(array_unique($blockers));
        return [empty($blockers), $blockers];
    }

    protected static function normalizeDependsOn($dependsOn)
    {
        if (is_array($dependsOn)) {
            return $dependsOn;
        }

        if (!$dependsOn) {
            return [];
        }

        $decoded = json_decode($dependsOn, true);

        return is_array($decoded) ? $decoded : [];
    }
}
