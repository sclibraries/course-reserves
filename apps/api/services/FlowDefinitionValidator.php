<?php

namespace app\services;

/** Validates a complete, ordered flow version without reading application state. */
class FlowDefinitionValidator
{
    private $finishStates = ['on_reserve', 'available_online', 'unavailable', 'withdrawn'];
    private $stepKinds = ['question', 'action', 'confirm_on_reserve', 'publish_online', 'finish'];

    public function validate(array $steps, array $existingGroups)
    {
        $errors = [];
        $stepsByKey = [];
        $groupNames = array_fill_keys($existingGroups, true);
        if (!$steps) {
            return [['step_key' => null, 'message' => 'A flow must contain at least one step.']];
        }

        foreach ($steps as $step) {
            if (!is_array($step)) {
                $errors[] = ['step_key' => null, 'message' => 'Each step must be an object.'];
                continue;
            }
            $key = isset($step['key']) ? trim((string)$step['key']) : '';
            if ($key === '') {
                $errors[] = ['step_key' => null, 'message' => 'Every step needs a key.'];
                continue;
            }
            if (strlen($key) > 128) {
                $this->addError($errors, $key, 'Step keys cannot exceed 128 characters.');
            }
            if (isset($stepsByKey[$key])) {
                $errors[] = ['step_key' => $key, 'message' => 'Duplicate step key.'];
                continue;
            }
            $stepsByKey[$key] = $step;
        }

        foreach ($steps as $step) {
            if (!is_array($step)) {
                continue;
            }
            $key = isset($step['key']) ? trim((string)$step['key']) : null;
            if (!$key || !isset($stepsByKey[$key])) {
                continue;
            }
            if (!in_array($step['kind'] ?? null, $this->stepKinds, true)) {
                $this->addError($errors, $key, 'Unknown step kind.');
                continue;
            }
            if (trim((string)($step['label'] ?? '')) === '') {
                $this->addError($errors, $key, 'A step label is required.');
            }
            if (isset($step['help_text']) && $step['help_text'] !== null && !is_string($step['help_text'])) {
                $this->addError($errors, $key, 'help_text must be a string or null.');
            }
            $outcomes = $step['outcomes'] ?? null;
            if (!is_array($outcomes)) {
                $this->addError($errors, $key, 'Outcomes must be an array.');
                continue;
            }
            $this->validateOutcomeCount($step, $outcomes, $errors);
            $seenOutcomes = [];
            foreach ($outcomes as $outcome) {
                if (!is_array($outcome)) {
                    $this->addError($errors, $key, 'Every outcome must be an object.');
                    continue;
                }
                $outcomeKey = trim((string)($outcome['key'] ?? ''));
                if ($outcomeKey === '') {
                    $this->addError($errors, $key, 'Every outcome needs a key.');
                } elseif (strlen($outcomeKey) > 128) {
                    $this->addError($errors, $key, 'Outcome keys cannot exceed 128 characters.');
                } elseif (isset($seenOutcomes[$outcomeKey])) {
                    $this->addError($errors, $key, 'Duplicate outcome key "' . $outcomeKey . '".');
                }
                $seenOutcomes[$outcomeKey] = true;
                if (trim((string)($outcome['label'] ?? '')) === '') {
                    $this->addError($errors, $key, 'Every outcome needs a label.');
                }
                if (isset($outcome['reason_required']) && !is_bool($outcome['reason_required'])) {
                    $this->addError($errors, $key, 'Outcome reason_required must be boolean.');
                }
                $this->validateNext($key, $outcome, $stepsByKey, $groupNames, $errors);
            }
            if ($step['kind'] === 'finish') {
                if (!in_array($step['finish_state'] ?? null, $this->finishStates, true)) {
                    $this->addError($errors, $key, 'Finish step has an invalid finish_state.');
                }
                if (isset($step['reason_required']) && !is_bool($step['reason_required'])) {
                    $this->addError($errors, $key, 'reason_required must be boolean.');
                }
            }
        }

        $finishKeys = [];
        foreach ($stepsByKey as $key => $step) {
            if (($step['kind'] ?? null) === 'finish') {
                $finishKeys[$key] = true;
            }
        }
        if (!$finishKeys) {
            $errors[] = ['step_key' => null, 'message' => 'A flow must contain at least one finish step.'];
        }
        $this->validateReachability($steps, $stepsByKey, $errors);
        return $errors;
    }

    private function validateOutcomeCount(array $step, array $outcomes, array &$errors)
    {
        $kind = $step['kind'];
        $key = $step['key'];
        if ($kind === 'question' && count($outcomes) < 2) {
            $this->addError($errors, $key, 'Question steps need at least two outcomes.');
        } elseif ($kind === 'finish' && $outcomes) {
            $this->addError($errors, $key, 'Finish steps cannot have outcomes.');
        } elseif (in_array($kind, ['confirm_on_reserve', 'publish_online'], true)) {
            if (count($outcomes) !== 1 || ($outcomes[0]['key'] ?? null) !== 'done') {
                $this->addError($errors, $key, 'This step kind needs only the done outcome.');
            }
        } elseif ($kind === 'action') {
            $keys = array_column($outcomes, 'key');
            if (!in_array('done', $keys, true) || count(array_diff($keys, ['done', 'not_done'])) > 0) {
                $this->addError($errors, $key, 'Action steps need done and may include not_done.');
            }
        }
    }

    private function validateNext($stepKey, array $outcome, array $stepsByKey, array $groupNames, array &$errors)
    {
        $next = $outcome['next'] ?? null;
        if (!is_array($next) || count($next) !== 1) {
            $this->addError($errors, $stepKey, 'Each outcome needs exactly one next target.');
            return;
        }
        if (isset($next['step'])) {
            if (!isset($stepsByKey[$next['step']])) {
                $this->addError($errors, $stepKey, 'Outcome points to an unknown step.');
            }
            return;
        }
        if (isset($next['finish'])) {
            if (!isset($stepsByKey[$next['finish']]) || ($stepsByKey[$next['finish']]['kind'] ?? null) !== 'finish') {
                $this->addError($errors, $stepKey, 'Outcome points to an unknown finish step.');
            }
            return;
        }
        if (isset($next['handoff_group'])) {
            if (!isset($groupNames[$next['handoff_group']])) {
                $this->addError($errors, $stepKey, 'Outcome points to an unknown group.');
            }
            return;
        }
        $this->addError($errors, $stepKey, 'Outcome has an invalid next target.');
    }

    private function validateReachability(array $steps, array $stepsByKey, array &$errors)
    {
        $firstKey = isset($steps[0]['key']) ? $steps[0]['key'] : null;
        if (!$firstKey || !isset($stepsByKey[$firstKey])) {
            return;
        }
        $visited = [];
        $pending = [$firstKey];
        while ($pending) {
            $key = array_pop($pending);
            if (isset($visited[$key]) || !isset($stepsByKey[$key])) {
                continue;
            }
            $visited[$key] = true;
            foreach ($stepsByKey[$key]['outcomes'] ?? [] as $outcome) {
                $next = $outcome['next'] ?? [];
                $target = $next['step'] ?? ($next['finish'] ?? null);
                if ($target !== null) {
                    $pending[] = $target;
                }
            }
        }
        foreach ($steps as $step) {
            $key = $step['key'] ?? null;
            if ($key && !isset($visited[$key])) {
                $this->addError($errors, $key, 'Step is unreachable from the first step.');
            }
        }
    }

    private function addError(array &$errors, $stepKey, $message)
    {
        $errors[] = ['step_key' => $stepKey, 'message' => $message];
    }
}
