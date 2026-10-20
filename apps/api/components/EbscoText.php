<?php

namespace app\components;

class EbscoText
{
    public static function decode($text)
    {
        $flags = ENT_QUOTES | ENT_HTML5;
        $decoded = html_entity_decode($text, $flags, 'UTF-8');

        if (preg_match('/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i', $decoded)) {
            $decoded = html_entity_decode($decoded, $flags, 'UTF-8');
        }

        return $decoded;
    }
}
