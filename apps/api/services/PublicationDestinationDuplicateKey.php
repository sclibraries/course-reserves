<?php

namespace app\services;

use yii\db\IntegrityException;

/** Identifies duplicate-key errors from this registry's own unique indexes. */
class PublicationDestinationDuplicateKey
{
    public static function name(IntegrityException $exception, array $keys)
    {
        $info = $exception->errorInfo;
        $message = $info[2] ?? null;
        if (($info[0] ?? null) !== '23000' || (int)($info[1] ?? 0) !== 1062 || !is_string($message)) {
            return null;
        }
        foreach ($keys as $key) {
            if (strpos($message, $key) !== false) {
                return $key;
            }
        }
        return null;
    }
}
