<?php

namespace app\services;

use yii\web\BadRequestHttpException;

class EbscoSearchRequestValidator
{
    public static function validateSearchQuery($query)
    {
        if (!is_string($query) || trim($query) === '') {
            throw new BadRequestHttpException('A non-empty search query is required.');
        }

        if (preg_match('/^query-\d+=/', $query) && !preg_match('/^query-\d+=.+(?:&query-\d+=.+)*$/', $query)) {
            throw new BadRequestHttpException('The search query is invalid.');
        }
    }

    public static function validateRetrieveIdentifiers($dbId, $an)
    {
        if (!self::hasValue($dbId) || !self::hasValue($an)) {
            throw new BadRequestHttpException('Both dbId and an are required.');
        }
    }

    private static function hasValue($value)
    {
        return is_scalar($value) && trim((string)$value) !== '';
    }
}
