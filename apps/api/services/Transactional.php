<?php

namespace app\services;

use Yii;
use yii\db\IntegrityException;

/** Runs a database operation atomically and maps unique-key conflicts when requested. */
class Transactional
{
    public static function run(callable $callback, ?callable $onIntegrity = null)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $result = $callback($transaction);
            if ($transaction->isActive) {
                $transaction->commit();
            }
            return $result;
        } catch (IntegrityException $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            if ($onIntegrity) {
                return $onIntegrity($exception);
            }
            throw $exception;
        } catch (\Throwable $exception) {
            if ($transaction->isActive) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }
}
