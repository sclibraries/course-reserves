<?php

namespace app\services;

use Yii;

/** Owns whole-operation retries when the caller has not opened a transaction. */
class PublicationDestinationTransaction
{
    public static function run(callable $callback, ?PublicationDestinationProbe $probe = null)
    {
        $db = Yii::$app->db;
        $transaction = $db->getTransaction();
        if ($transaction !== null && $transaction->isActive) {
            return call_user_func($callback, 1);
        }

        $probe = $probe ?: new NullPublicationDestinationProbe();
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $transaction = $db->beginTransaction();
            try {
                $result = call_user_func($callback, $attempt);
                $probe->checkpoint('before_commit', $attempt);
                $transaction->commit();
            } catch (PublicationDestinationRestartRequired $exception) {
                if ($transaction->isActive) {
                    $transaction->rollBack();
                }
                if ($attempt === 3) {
                    throw new PublicationDestinationContention(
                        'Destination closure did not stabilize after three attempts.',
                        0,
                        $exception
                    );
                }
                continue;
            } catch (\Throwable $exception) {
                if ($transaction->isActive) {
                    $transaction->rollBack();
                }
                throw $exception;
            }

            $probe->checkpoint('committed', $attempt);
            return $result;
        }

        throw new PublicationDestinationContention('Destination closure did not stabilize.');
    }
}
