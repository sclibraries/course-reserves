<?php

namespace app\services;

use Yii;
use yii\httpclient\Client;
use yii\web\BadRequestHttpException;
use yii\web\HttpException;

class EbscoErrorMapper
{
    const UNAVAILABLE_MESSAGE = 'Library search is temporarily unavailable.';

    public static function createSearchClient($query)
    {
        self::validateSearchQuery($query);

        return self::createClient();
    }

    public static function createRetrieveClient($dbId, $an)
    {
        if (!self::hasValue($dbId) || !self::hasValue($an)) {
            throw new BadRequestHttpException('Both dbId and an are required.');
        }

        return self::createClient();
    }

    public static function createInfoClient()
    {
        return self::createClient();
    }

    public static function assertConfigured()
    {
        $settings = Yii::$app->params['ebsco'];
        $requiredSettings = [
            'userId' => 'EBSCO_USER_ID',
            'password' => 'EBSCO_PASSWORD',
            'edsProfile' => 'EBSCO_PROFILE',
        ];

        foreach ($requiredSettings as $key => $settingName) {
            if (!isset($settings[$key]) || trim((string)$settings[$key]) === '') {
                throw new \RuntimeException('Missing EBSCO setting: ' . $settingName);
            }
        }
    }

    public static function mapFailure(\Exception $exception, array $requestSecrets = [])
    {
        if ($exception instanceof BadRequestHttpException) {
            throw $exception;
        }
        if ($exception instanceof HttpException && $exception->statusCode >= 400 && $exception->statusCode < 500) {
            throw $exception;
        }

        $settings = Yii::$app->params['ebsco'];
        $secretValues = array_merge($requestSecrets, [
            isset($settings['userId']) ? $settings['userId'] : null,
            isset($settings['password']) ? $settings['password'] : null,
        ]);
        Yii::error('EBSCO request failed: ' . self::redact($exception->getMessage(), $secretValues), 'ebsco');
        Yii::$app->response->statusCode = 503;

        return [
            'error_code' => 'search_unavailable',
            'message' => self::UNAVAILABLE_MESSAGE,
        ];
    }

    private static function createClient()
    {
        return Yii::createObject(Client::class);
    }

    private static function validateSearchQuery($query)
    {
        if (!is_string($query) || trim($query) === '') {
            throw new BadRequestHttpException('A non-empty search query is required.');
        }

        if (preg_match('/^query-\d+=/', $query) && !preg_match('/^query-\d+=.+(?:&query-\d+=.+)*$/', $query)) {
            throw new BadRequestHttpException('The search query is invalid.');
        }
    }

    private static function hasValue($value)
    {
        return is_scalar($value) && trim((string)$value) !== '';
    }

    private static function redact($message, array $secretValues)
    {
        $message = preg_replace(
            '/("(?:UserId|Password|AuthToken|SessionToken|x-authenticationToken|x-sessionToken)"\s*:\s*)"[^"]*"/i',
            '$1"[redacted]"',
            $message
        );
        $message = preg_replace(
            '/((?:UserId|Password|AuthToken|SessionToken|x-authenticationToken|x-sessionToken)\s*[:=]\s*)[^\s,}]+/i',
            '$1[redacted]',
            $message
        );
        $message = preg_replace('/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/', '[redacted-token]', $message);

        foreach ($secretValues as $secretValue) {
            if (is_string($secretValue) && $secretValue !== '') {
                $message = str_replace($secretValue, '[redacted]', $message);
            }
        }

        return $message;
    }
}
