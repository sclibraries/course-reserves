<?php

namespace app\components;

class Environment
{
    private const REQUIRED_PRODUCTION_SETTINGS = [
        'JWT_SECRET_KEY',
        'JWT_REFRESH_SECRET_KEY',
        'COOKIE_VALIDATION_KEY',
        'DB_HOST',
        'DB_NAME',
        'DB_USER',
        'DB_PASS',
    ];

    public static function resolve($environment)
    {
        return in_array($environment, ['dev', 'test'], true) ? $environment : 'prod';
    }

    public static function debugEnabled($environment)
    {
        return self::resolve($environment) === 'dev';
    }

    public static function isDev()
    {
        return defined('YII_ENV') && self::resolve(YII_ENV) === 'dev';
    }

    public static function allowsTestFixtures()
    {
        return defined('YII_ENV') && self::allowsTestFixturesFor(YII_ENV);
    }

    public static function allowsTestFixturesFor($environment)
    {
        return in_array(self::resolve($environment), ['dev', 'test'], true);
    }

    public static function requiredProductionSettings()
    {
        return self::REQUIRED_PRODUCTION_SETTINGS;
    }

    public static function missingProductionSettings()
    {
        $missing = [];
        foreach (self::REQUIRED_PRODUCTION_SETTINGS as $setting) {
            $value = getenv($setting);
            if ($value === false || trim($value) === '') {
                $missing[] = $setting;
            }
        }

        return $missing;
    }
}
