<?php

namespace app\components;

class FolioCourseQuery
{
    public static function courseNumberAndTermClauses($courseNumber, $termId = null)
    {
        $clauses = ['courseNumber=="' . self::escape($courseNumber) . '"'];
        if (!empty($termId)) {
            $clauses[] = 'courseListing.termId=="' . self::escape($termId) . '"';
        }

        return implode(' and ', $clauses);
    }

    private static function escape($value)
    {
        return str_replace(['\\', '"'], ['\\\\', '\\"'], (string)$value);
    }
}
