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
            self::rollBack($transaction);
            if ($onIntegrity) {
                return $onIntegrity($exception);
            }
            throw $exception;
        } catch (\Throwable $exception) {
            self::runFailureCallback($onFailure, $exception);
            self::rollBack($transaction);
            throw $exception;
        }
    }

    /**
     * A missing savepoint means the server already rolled the whole transaction back (a deadlock); the original
     * exception then propagates instead of the rollback error, so outer handlers can still classify it.
     */
    private static function rollBack($transaction)
    {
        if (!$transaction->isActive) {
            return;
        }
        try {
            $transaction->rollBack();
        } catch (\yii\db\Exception $exception) {
            if ((int)($exception->errorInfo[1] ?? 0) !== 1305) {
                throw $exception;
            }
        }
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
