<?php

use app\services\LegacySubmissionItemUpdateService;
use app\services\SubmissionCopyInputRefreshService;
use app\services\SubmissionItemDetailsService;

/** Runs item writers behind an acknowledged barrier after their plain discovery read. */
class PostLockReadConcurrencyWorkerOps
{
    private static $paused;

    public static function run(array $request, $db)
    {
        PublicationDestinationConcurrencyWorkerOps::assertFixtureManifest($request['manifest'] ?? [], $db);
        self::$paused = false;
        Api119A4ItemLockConcurrencyCommand::setObserver(function ($sql) use ($request) {
            if (self::$paused || !preg_match(
                '/SELECT\s+submission_id\s+FROM\s+submission_(?:new|reuse)_resources\s+WHERE\s+id\s*=/i',
                $sql
            )) {
                return;
            }
            self::$paused = true;
            self::checkpoint($request['op'], $sql);
        });

        try {
            if (isset($request['caller_read'])) {
                return self::nested($request, $db);
            }
            return self::invoke($request);
        } finally {
            Api119A4ItemLockConcurrencyCommand::setObserver(null);
        }
    }

    private static function nested(array $request, $db)
    {
        $transaction = $db->beginTransaction();
        try {
            $before = self::callerRead($request, $db);
            $result = self::invoke($request);
            $after = self::callerRead($request, $db);
            $transaction->commit();
            return [
                'result' => self::response($result),
                'caller_read_before' => $before,
                'caller_read_after' => $after,
            ];
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    private static function callerRead(array $request, $db)
    {
        $read = $request['caller_read'];
        return $db->createCommand($read['sql'], $read['params'] ?? [])->queryScalar();
    }

    private static function invoke(array $request)
    {
        $actor = $request['actor'];
        if ($request['op'] === 'item_lock_a5_details') {
            return (new SubmissionItemDetailsService())->update(
                $request['kind'], $request['item_id'], $actor, $request['body']
            );
        }
        if ($request['op'] === 'item_lock_a5_copy_refresh') {
            return (new SubmissionCopyInputRefreshService())->refresh(
                $request['kind'], $request['item_id'], $actor
            );
        }
        if ($request['op'] === 'item_lock_a5_legacy_update') {
            return (new LegacySubmissionItemUpdateService())->update(
                $request['item_id'], $actor, $request['body']
            );
        }
        throw new \RuntimeException('Unknown post-lock read operation: ' . $request['op']);
    }

    private static function response(array $result)
    {
        $body = $result['body'] ?? [];
        if (isset($body['item']) && is_object($body['item']) && method_exists($body['item'], 'getAttributes')) {
            $body['item'] = $body['item']->getAttributes();
        }
        return ['status' => $result['status'], 'body' => $body];
    }

    private static function checkpoint($operation, $sql)
    {
        PublicationDestinationConcurrencyWire::write(STDOUT, [
            'op' => $operation,
            'attempt' => 1,
            'phase' => 'discovered',
            'context' => ['sql' => $sql],
        ]);
        $answer = PublicationDestinationConcurrencyWire::read(STDIN);
        if (($answer['command'] ?? null) !== 'go' || ($answer['phase'] ?? null) !== 'discovered'
            || (int)($answer['attempt'] ?? -1) !== 1) {
            throw new \RuntimeException('Post-lock read worker received an invalid discovery acknowledgement.');
        }
    }
}
