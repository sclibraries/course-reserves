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
        $currentStep = $this->currentStep($run);
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

    public function summary($run, $mappedFlow = null)
    {
        if ($run) {
            $currentStep = $this->currentStep($run);
            return [
                'name' => $run['flow_name'],
                'current_step_label' => $currentStep['label'] ?? null,
                'finish_state' => $run['finish_state'],
            ];
        }
        if ($mappedFlow) {
            $steps = json_decode($mappedFlow['steps_json'], true) ?: [];
            $firstStep = $steps ? reset($steps) : [];
            $firstStep = FlowStepLookup::stepByKey($steps, $firstStep['key'] ?? null);
            return [
                'name' => $mappedFlow['flow_name'],
                'current_step_label' => $firstStep['label'] ?? null,
                'finish_state' => null,
            ];
        }
        return ['name' => null, 'current_step_label' => null, 'finish_state' => null];
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

    private function currentStep(array $run)
    {
        $steps = json_decode($run['steps_json'], true) ?: [];
        return $run['current_step_key'] === null
            ? []
            : FlowStepLookup::stepByKey($steps, $run['current_step_key']);
    }
}
