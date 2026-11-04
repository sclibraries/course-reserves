<?php

namespace app\services;

use Yii;
use yii\db\IntegrityException;

/** Runs a database operation atomically and maps unique-key conflicts when requested. */
class Transactional
{
    public static function run(callable $callback, ?callable $onIntegrity = null, ?callable $onFailure = null)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $result = $callback($transaction);
            if ($transaction->isActive) {
                $transaction->commit();
            }
            return $result;
        } catch (IntegrityException $exception) {
            self::runFailureCallback($onFailure, $exception);
            self::rollBack($transaction, $exception);
            if ($onIntegrity) {
                return $onIntegrity($exception);
            }
            throw $exception;
        } catch (\Throwable $exception) {
            self::runFailureCallback($onFailure, $exception);
            self::rollBack($transaction, $exception);
            throw $exception;
        }
    }

    /**
     * After a deadlock the server has already rolled the whole transaction back, so the savepoint is gone; the
     * original exception then propagates instead of the 1305, so outer handlers can still classify it. In every
     * other case a failed rollback propagates.
     */
    private static function rollBack($transaction, \Throwable $cause)
    {
        if (!$transaction->isActive) {
            return;
        }
        try {
            $transaction->rollBack();
        } catch (\yii\db\Exception $exception) {
            if (self::mysqlCode($exception) !== 1305 || !self::isDeadlock($cause)) {
                throw $exception;
            }
        }
    }

    private static function isDeadlock(?\Throwable $exception)
    {
        for (; $exception !== null; $exception = $exception->getPrevious()) {
            if (self::mysqlCode($exception) === 1213) {
                return true;
            }
        }
        return false;
    }

    private static function mysqlCode(\Throwable $exception)
    {
        $info = $exception instanceof \yii\db\Exception || $exception instanceof \PDOException
            ? $exception->errorInfo : null;
        return (int)($info[1] ?? 0);
    }

    private static function runFailureCallback($callback, $exception)
    {
        if ($callback === null) {
            return;
        }
        try {
            call_user_func($callback, $exception);
        } catch (\Throwable $cleanupError) {
            Yii::error('Transaction failure cleanup failed: ' . $cleanupError->getMessage(), __METHOD__);
        }
    }
}
