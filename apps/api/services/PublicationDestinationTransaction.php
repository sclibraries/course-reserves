<?php

namespace app\services;

use Yii;
use yii\db\IntegrityException;

/**
 * Runs one registry operation. Outermost, it owns the transaction and re-runs the whole callback after a deadlock
 * (1213) or a registry-key duplicate (1062), at most three attempts; a lock wait timeout (1205) is not retried.
 * Nested in a caller's transaction, such a failure ends the caller's transaction and raises RestartRequired.
 */
class PublicationDestinationTransaction
{
    private const REGISTRY_KEYS = [
        'uq_pub_dest_course_resource', 'uq_pub_dest_physical_reference', 'uq_pub_dest_owner_live',
        'uq_pub_attach_item_live',
    ];
    private const SAVEPOINT_MISSING = 1305;

    public static function run(callable $callback, ?PublicationDestinationProbe $probe = null)
    {
        $db = Yii::$app->db;
        $probe = $probe ?: new NullPublicationDestinationProbe();
        if ($db->getTransaction() !== null) {
            return self::nested($db, $callback, $probe);
        }
        for ($attempt = 1;; $attempt++) {
            $transaction = $db->beginTransaction();
            try {
                $probe->checkpoint('attempt_started', $attempt);
                $result = call_user_func($callback, $attempt);
                $probe->checkpoint('before_commit', $attempt);
                $transaction->commit();
            } catch (\Throwable $exception) {
                $cause = $exception instanceof PublicationDestinationRestartRequired ? $exception->getPrevious() : $exception;
                $code = self::failureCode($cause);
                $cleaned = self::unwind($db, $code === 1213, $probe, $attempt);
                if ($code === null) {
                    throw $exception;
                }
                $probe->checkpoint('attempt_failed', $attempt, ['mysql_code' => $code]);
                if ($code === 1205 || $attempt === 3 || !$cleaned) {
                    throw new PublicationDestinationContention('Destination operation hit lock contention.', 0, $cause);
                }
                continue;
            }
            $probe->checkpoint('committed', $attempt);
            return $result;
        }
    }

    private static function nested($db, callable $callback, PublicationDestinationProbe $probe)
    {
        try {
            $probe->checkpoint('attempt_started', 1);
            return call_user_func($callback, 1);
        } catch (\yii\db\Exception $exception) {
            $code = self::failureCode($exception);
            if ($code === null) {
                throw $exception;
            }
            self::unwind($db, $code === 1213, $probe, 1);
            $probe->checkpoint('attempt_failed', 1, ['mysql_code' => $code]);
            throw new PublicationDestinationRestartRequired('Destination operation must restart.', 0, $exception);
        }
    }

    private static function failureCode($exception)
    {
        $code = self::mysqlCode($exception);
        if ($code === 1062) {
            return $exception instanceof IntegrityException
                && PublicationDestinationDuplicateKey::name($exception, self::REGISTRY_KEYS) !== null ? 1062 : null;
        }
        return in_array($code, [1205, 1213], true) ? $code : null;
    }

    private static function mysqlCode($exception)
    {
        return $exception instanceof \yii\db\Exception ? (int)($exception->errorInfo[1] ?? 0) : 0;
    }

    /**
     * Rolls back every Yii level and returns whether that succeeded. After a deadlock the server has already rolled
     * back, so a missing savepoint is expected; any other rollback failure may leave a server transaction open, so
     * the connection is closed (the server then rolls back) and the failure is recorded.
     */
    private static function unwind($db, $serverRolledBack, PublicationDestinationProbe $probe, $attempt)
    {
        while (($transaction = $db->getTransaction()) !== null) {
            try {
                $transaction->rollBack();
            } catch (\Exception $error) {
                if ($serverRolledBack && self::mysqlCode($error) === self::SAVEPOINT_MISSING) {
                    continue;
                }
                Yii::error('Destination rollback failed; closing the connection: ' . $error->getMessage(), __METHOD__);
                $probe->checkpoint('cleanup_failed', $attempt, ['error' => get_class($error)]);
                $db->close();
                return false;
            }
        }
        return true;
    }
}
