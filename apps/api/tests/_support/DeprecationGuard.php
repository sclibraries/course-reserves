<?php

class Cx037DeprecationGuard
{
    public static function enabled()
    {
        return getenv('API_TEST_DEPRECATIONS') === '1';
    }

    public static function codeceptionParams()
    {
        if (self::enabled()) {
            return [
                'CX037_ERROR_LEVEL' => 'E_ALL & ~E_STRICT',
                'CX037_CONVERT_DEPRECATIONS_TO_EXCEPTIONS' => 'true',
            ];
        }

        return [
            'CX037_ERROR_LEVEL' => 'E_ALL & ~E_STRICT & ~E_DEPRECATED',
            'CX037_CONVERT_DEPRECATIONS_TO_EXCEPTIONS' => '',
        ];
    }

    public static function install()
    {
        if (!self::enabled() || defined('CX037_DEPRECATION_GUARD_ACTIVE')) {
            return;
        }

        define('CX037_DEPRECATION_GUARD_ACTIVE', true);
        error_reporting(E_ALL);

        set_error_handler(function ($severity, $message, $file, $line) {
            if (($severity & (E_DEPRECATED | E_USER_DEPRECATED)) !== 0) {
                throw new ErrorException($message, 0, $severity, $file, $line);
            }

            return false;
        });
    }
}
