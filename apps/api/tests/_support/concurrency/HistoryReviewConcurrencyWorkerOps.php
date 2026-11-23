<?php

/** Runs single and submission history reviews behind deterministic SQL barriers. */
class HistoryReviewConcurrencyWorkerOps
{
    private static $request;
    private static $pausePoints;

    public static function run(array $request)
    {
        self::$request = $request;
        self::$pausePoints = array_fill_keys($request['pause_points'] ?? [], true);
        Api119A4ItemLockConcurrencyCommand::setObserver(function ($sql) {
            self::observe($sql);
        });
        try {
            self::checkpointIfRequested('before_action', 'discovered', '');
            $service = new \app\services\ItemHistoryReviewService();
            $actor = ['username' => $request['actor'], 'role' => 'staff'];
            $result = $request['review_type'] === 'submission'
                ? $service->reviewSubmission(
                    $request['submission_id'],
                    $actor,
                    $request['reviewer_id'],
                    $request['decision'],
                    $request['reason']
                )
                : $service->review(
                    $request['item_id'],
                    $actor,
                    $request['reviewer_id'],
                    $request['decision'],
                    $request['reason']
                );
            return ['status' => $result['status'], 'body' => $result['body']];
        } finally {
            Api119A4ItemLockConcurrencyCommand::setObserver(null);
        }
    }

    private static function observe($sql)
    {
        $itemId = (int)(self::$request['item_id'] ?? 0);
        if ($itemId && preg_match(
            '/SELECT\s+submission_id\s+FROM\s+submission_new_resources\s+WHERE\s+id\s*=\s*'
                . $itemId . '\s+LIMIT\s+1/i',
            $sql
        )) {
            self::checkpointIfRequested('discovered', 'discovered', $sql);
            return;
        }

        if (preg_match('/^UPDATE\s+`?item_history_review`?.*WHERE\s+`?item_id`?\s*=\s*\d+/i', $sql)) {
            self::checkpointIfRequested('review_written', 'locked', $sql);
        }
    }

    private static function checkpointIfRequested($pausePoint, $phase, $sql)
    {
        if (!isset(self::$pausePoints[$pausePoint])) {
            return;
        }
        unset(self::$pausePoints[$pausePoint]);
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => self::$request['op'],
            'attempt' => 1,
            'phase' => $phase,
            'context' => ['sql' => $sql],
        ]);
        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== $phase
            || (int)($answer['attempt'] ?? -1) !== 1) {
            throw new \RuntimeException('History-review worker received an invalid barrier acknowledgement.');
        }
    }
}
