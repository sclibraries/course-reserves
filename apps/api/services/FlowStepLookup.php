<?php

namespace app\services;

/** Looks up one step or outcome in a normalized flow definition. */
class FlowStepLookup
{
    public static function stepByKey(array $steps, $key)
    {
        foreach ($steps as $step) {
            if (($step['key'] ?? null) === $key) {
                return $step;
            }
        }
        return [];
    }

    public static function outcomeByKey(array $step, $key)
    {
        foreach ($step['outcomes'] ?? [] as $outcome) {
            if (($outcome['key'] ?? null) === $key) {
                return $outcome;
            }
        }
        return [];
    }
}
