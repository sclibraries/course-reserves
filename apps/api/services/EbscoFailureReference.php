<?php

namespace app\services;

class EbscoFailureReference
{
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const LENGTH = 6;

    public static function generate()
    {
        $reference = '';
        $lastIndex = strlen(self::ALPHABET) - 1;
        for ($index = 0; $index < self::LENGTH; $index++) {
            $reference .= self::ALPHABET[random_int(0, $lastIndex)];
        }

        return $reference;
    }
}
