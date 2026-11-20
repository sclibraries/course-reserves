<?php

/** Runs the development seed as a retry owner and pauses once where its source-resource hook discovers dependents. */
class ResourceOwnerConcurrencyWorkerOps
{
    public static function run(array $request)
    {
        $paused = false;
        Api119A4ItemLockConcurrencyCommand::setObserver(function ($sql) use ($request, &$paused) {
            if ($paused || !preg_match('/FROM submission_new_resources item WHERE item\.source_resource_id = \'' . (int)$request['resource_id'] . '\'/i', $sql)) {
                return;
            }
            $paused = true;
            PublicationDestinationConcurrencyWire::write(STDOUT, [
                'op' => $request['op'], 'attempt' => 0, 'phase' => 'discovered', 'context' => ['sql' => $sql],
            ]);
            $answer = PublicationDestinationConcurrencyWire::read(STDIN);
            if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== 'discovered'
                || (int)($answer['attempt'] ?? -1) !== 0) {
                throw new \RuntimeException('Seed worker received an invalid barrier acknowledgement.');
            }
        });
        try {
            $summary = (new \app\services\DevSeedService())->seed($request['current_period'], $request['upcoming_period']);
            return ['assignment_count' => $summary['assignmentCount']];
        } finally {
            Api119A4ItemLockConcurrencyCommand::setObserver(null);
        }
    }
}
