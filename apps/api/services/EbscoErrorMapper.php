<?php

namespace app\services;

use Yii;
use yii\web\BadRequestHttpException;
use yii\web\HttpException;

class EbscoErrorMapper
{
    const UNAVAILABLE_MESSAGE = 'Library search is temporarily unavailable.';

    public static function mapFailure(\Exception $exception, array $requestSecrets = [], array $context = [])
    {
        if ($exception instanceof BadRequestHttpException) {
            throw $exception;
        }
        if ($exception instanceof HttpException && $exception->statusCode >= 400 && $exception->statusCode < 500) {
            throw $exception;
        }

        $reference = EbscoFailureReference::generate();
        $settings = isset(Yii::$app->params['ebsco']) ? Yii::$app->params['ebsco'] : [];
        $secretValues = array_merge($requestSecrets, [
            isset($settings['userId']) ? $settings['userId'] : null,
            isset($settings['password']) ? $settings['password'] : null,
            isset($settings['edsProfile']) ? $settings['edsProfile'] : null,
        ]);
        $action = isset($context['action']) ? $context['action'] : 'unknown';
        $step = isset($context['step']) ? $context['step'] : 'unknown';
        $status = self::upstreamStatus($exception, $context);
        $logMessage = $reference . ' action=' . self::singleLine($action)
            . ' step=' . self::singleLine($step)
            . ' upstream_status=' . $status;

        if ($action === 'search') {
            $query = isset($context['query']) && is_scalar($context['query']) ? (string)$context['query'] : '';
            $query = self::truncate($query, 200);
            $logMessage .= ' query="' . self::singleLine(self::redact($query, $secretValues)) . '"';
        }

        $logMessage .= ' ' . self::failureDetails($exception->getMessage(), $step, $secretValues);
        Yii::error(self::singleLine($logMessage), 'ebsco');
        Yii::$app->response->statusCode = 503;

        return [
            'error_code' => 'search_unavailable',
            'message' => self::UNAVAILABLE_MESSAGE,
            'reference' => $reference,
        ];
    }

    private static function upstreamStatus(\Exception $exception, array $context)
    {
        if (array_key_exists('upstream_status', $context)) {
            $status = $context['upstream_status'];
        } else {
            $status = $exception->getCode();
        }

        return is_numeric($status) && (int)$status >= 100 && (int)$status <= 599
            ? (string)(int)$status
            : 'none';
    }

    private static function failureDetails($message, $step, array $secretValues)
    {
        if ($step === 'config') {
            if (preg_match('/Missing EBSCO setting: (EBSCO_[A-Z0-9_]+)/', $message, $matches)) {
                return 'setting=' . $matches[1];
            }

            return 'setting=unknown';
        }

        $providerError = json_decode($message, true);
        if (is_array($providerError)) {
            $fields = [];
            foreach (['ErrorNumber', 'ErrorDescription', 'DetailedErrorDescription'] as $field) {
                if (isset($providerError[$field]) && is_scalar($providerError[$field])) {
                    $fields[] = $field . '=' . $providerError[$field];
                }
            }
            if (!empty($fields)) {
                return self::singleLine(self::redact(implode(' ', $fields), $secretValues));
            }
        }

        return 'error=' . self::singleLine(self::redact($message, $secretValues));
    }

    private static function truncate($value, $length)
    {
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $length, 'UTF-8');
        }

        return substr($value, 0, $length);
    }

    private static function singleLine($value)
    {
        return trim(str_replace(["\r", "\n"], ' ', (string)$value));
    }

    private static function redact($message, array $secretValues)
    {
        $keys = 'UserId|Password|AuthToken|SessionToken|x-authenticationToken|x-sessionToken';
        $message = preg_replace(
            '/("(?:' . $keys . ')"\s*:\s*)"[^"]*"/i',
            '$1"[redacted]"',
            $message
        );
        $message = preg_replace(
            '/((?:' . $keys . ')\s*[:=]\s*)[^\s,;}]+/i',
            '$1[redacted]',
            $message
        );
        $message = preg_replace('/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/', '[redacted-token]', $message);

        foreach ($secretValues as $secretValue) {
            if (is_scalar($secretValue) && (string)$secretValue !== '') {
                $message = str_replace((string)$secretValue, '[redacted]', $message);
            }
        }

        return $message;
    }
}
