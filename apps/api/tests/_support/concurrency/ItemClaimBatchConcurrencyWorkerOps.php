<?php

/** Races claim-all candidates against movement or deletion after the batch has discovered them. */
class ItemClaimBatchConcurrencyWorkerOps
{
    private static $request;
    private static $paused = false;
    private static $discoveries = 0;

    public static function run(array $request)
    {
        self::$request = $request;
        self::$paused = false;
        self::$discoveries = 0;
        Api119A4ItemLockConcurrencyCommand::setObserver(function ($sql) {
            self::observe($sql);
        });
        try {
            $result = (new \app\services\ItemClaimService())->claimAll(
                self::$request['uuid'],
                ['username' => self::$request['actor'], 'role' => 'staff']
            );
            return ['status' => $result['status'], 'body' => $result['body']];
        } finally {
            Api119A4ItemLockConcurrencyCommand::setObserver(null);
        }
    }

    private static function observe($sql)
    {
        $pausePoint = self::$request['pause_point'];
        if ($pausePoint === 'refs' && !self::$paused && preg_match(
            '/SELECT id, display_order AS position FROM submission_new_resources WHERE submission_id =/i',
            $sql
        )) {
            self::$paused = true;
            self::checkpoint('discovered', 0, $sql);
            return;
        }

        $id = (int)self::$request['candidate_id'];
        if ($pausePoint === 'discovery' && preg_match(
            '/SELECT submission_id FROM submission_new_resources WHERE id\s*=\s*' . $id . '\s+LIMIT 1/i',
            $sql
        )) {
            self::$discoveries++;
            if (self::$discoveries === 1) {
                self::checkpoint('discovered', 1, $sql);
            }
        }
    }

    private static function checkpoint($phase, $attempt, $sql)
    {
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => self::$request['op'],
            'attempt' => $attempt,
            'phase' => $phase,
            'context' => ['sql' => $sql],
        ]);
        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== $phase
            || (int)($answer['attempt'] ?? -1) !== $attempt) {
            throw new \RuntimeException('Batch claim worker received an invalid barrier acknowledgement.');
        }
    }
}
