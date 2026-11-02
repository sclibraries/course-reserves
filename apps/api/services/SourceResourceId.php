<?php

namespace app\services;

/** Defines which stored source ids can identify a local resources row. */
class SourceResourceId
{
    const MAX_VALUE = 2147483647;
    const POSITIVE_INTEGER_PATTERN = '[1-9][0-9]{0,9}';

    public static function canonical($value): ?int
    {
        if (is_int($value)) {
            return $value > 0 && $value <= self::MAX_VALUE ? $value : null;
        }
        if (!is_string($value) || preg_match('/\A' . self::POSITIVE_INTEGER_PATTERN . '\z/', $value) !== 1) {
            return null;
        }

        $maximum = (string)self::MAX_VALUE;
        if (strlen($value) > strlen($maximum)
            || (strlen($value) === strlen($maximum) && strcmp($value, $maximum) > 0)) {
            return null;
        }
        return (int)$value;
    }

    public static function sqlValue($expression): string
    {
        $expression = '(' . $expression . ')';
        $pattern = '^' . self::POSITIVE_INTEGER_PATTERN . '$';
        $maximum = (string)self::MAX_VALUE;
        $length = 'CHAR_LENGTH(' . $expression . ')';
        $withinMaximum = $length . ' < ' . strlen($maximum)
            . ' OR (' . $length . ' = ' . strlen($maximum)
            . ' AND BINARY ' . $expression . " <= BINARY '" . $maximum . "')";

        return '(CASE WHEN ' . $expression . " REGEXP '" . $pattern . "' AND LOCATE(CHAR(10), "
            . $expression . ') = 0 THEN CASE WHEN ' . $withinMaximum . ' THEN ' . $expression
            . ' END END)';
    }
}
