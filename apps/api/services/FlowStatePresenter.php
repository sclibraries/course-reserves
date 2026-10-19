<?php

namespace app\services;

/** Builds the staff item-flow response from a pinned run and its retained history. */
class FlowStatePresenter
{
    private $flows;

    public function __construct(FlowRepository $flows)
    {
        $this->flows = $flows;
    }

    public function present($kind, $itemId, array $item, $run, $canAct)
    {
        if (!$run) {
            return [
                'flow' => null,
                'run_id' => null,
                'current_step' => null,
                'finished' => null,
                'history' => $this->flows->history($kind, $itemId),
                'can_act' => (bool)$canAct,
            ];
        }
        $steps = json_decode($run['steps_json'], true) ?: [];
        $currentStep = $run['current_step_key'] === null ? null : $this->stepByKey($steps, $run['current_step_key']);
        return [
            'flow' => ['id' => (int)$run['flow_id'], 'name' => $run['flow_name'], 'version' => (int)$run['version']],
            'run_id' => (int)$run['id'],
            'current_step' => $currentStep ? ['step' => $currentStep] : null,
            'finished' => $run['finish_state'] === null ? null : [
                'finish_state' => $run['finish_state'], 'reason' => $run['finish_reason'],
            ],
            'history' => $this->flows->history($kind, $itemId),
            'can_act' => (bool)$canAct,
        ];
    }

    public function runSnapshot(array $run)
    {
        return [
            'run_id' => (int)$run['id'],
            'flow_id' => (int)$run['flow_id'],
            'version' => (int)$run['version'],
            'current_step_key' => $run['current_step_key'],
            'finish_state' => $run['finish_state'],
        ];
    }

    public function stepByKey(array $steps, $key)
    {
        foreach ($steps as $step) {
            if (($step['key'] ?? null) === $key) {
                return $step;
            }
        }
        return [];
    }

    public function outcomeByKey(array $step, $key)
    {
        foreach ($step['outcomes'] ?? [] as $outcome) {
            if (($outcome['key'] ?? null) === $key) {
                return $outcome;
            }
        }
        return null;
    }
}
