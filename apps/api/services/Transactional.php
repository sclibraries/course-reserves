<?php

namespace app\services;

use Yii;
use yii\db\IntegrityException;

/** Runs a database operation atomically and maps unique-key conflicts when requested. */
class Transactional
{
    public static function retrying(callable $callback)
    {
        $db = Yii::$app->db;
        $transaction = $db->getTransaction();
        $notifications = $transaction !== null ? Yii::$app->get('workflowNotificationQueue') : null;
        if ($transaction !== null) {
            return self::runRetryingSavepoint($callback, $transaction, $notifications);
        }

        $notifications = Yii::$app->get('workflowNotificationQueue');
        for ($attempt = 1; ; $attempt++) {
            $checkpoint = $notifications->checkpoint();
            $transaction = $db->beginTransaction();
            $level = $transaction->level;
            try {
                $result = call_user_func($callback, $transaction);
                if ($transaction->level === $level) {
                    $transaction->commit();
                    $notifications->flushAfterCommit();
                } else {
                    $notifications->discardSince($checkpoint);
                }
            } catch (\Throwable $exception) {
                try {
                    self::rollBackToLevel($transaction, 0, $exception);
                } finally {
                    $notifications->discardSince($checkpoint);
                }
                if (!self::isDeadlock($exception) && !self::isAssociationChange($exception)) {
                    throw $exception;
                }
                if ($attempt < 3) {
                    continue;
                }

                $reference = FailureReference::generate();
                Yii::error('Item operation contention reference=' . $reference, __METHOD__);
                throw new ItemContention($reference, $exception);
            }
            return $result;
        }
    }

    private static function runRetryingSavepoint(callable $callback, $transaction, WorkflowNotificationQueue $notifications)
    {
        $baseLevel = $transaction->level;
        $checkpoint = $notifications->checkpoint();
        $transaction = Yii::$app->db->beginTransaction();
        $savepointLevel = $transaction->level;
        try {
            $result = call_user_func($callback, $transaction);
            if ($transaction->level === $savepointLevel) {
                $transaction->commit();
            } else {
                $notifications->discardSince($checkpoint);
            }
            return $result;
        } catch (\Throwable $exception) {
            try {
                self::rollBackToLevel($transaction, $baseLevel, $exception);
            } finally {
                $notifications->discardSince($checkpoint);
            }
            throw $exception;
        }
    }

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

    private static function rollBackToLevel($transaction, $level, \Throwable $cause)
    {
        while ($transaction->isActive && $transaction->level > $level) {
            self::rollBack($transaction, $cause);
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

    private static function isAssociationChange(?\Throwable $exception)
    {
        for (; $exception !== null; $exception = $exception->getPrevious()) {
            if ($exception instanceof ItemAssociationChanged) {
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
