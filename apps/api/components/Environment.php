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

    public static function missingProductionSettings($environment = null)
    {
        $missing = [];
        foreach (self::REQUIRED_PRODUCTION_SETTINGS as $setting) {
            $value = getenv($setting);
            if ($value === false || trim($value) === '') {
                $missing[] = $setting;
            }
        }

        if ($environment === null) {
            $environment = defined('YII_ENV') ? YII_ENV : getenv('YII_ENV');
        }
        if (self::resolve($environment) === 'prod' && self::usesNonProductionFolioHost(getenv('FOLIO_SEARCH_BASE_URL'))) {
            $missing[] = 'FOLIO_SEARCH_BASE_URL';
        }

        return $missing;
    }

    private static function usesNonProductionFolioHost($url)
    {
        if ($url === false || trim($url) === '') {
            return false;
        }

        $parts = parse_url(trim($url));
        if ($parts === false || empty($parts['host'])) {
            return true;
        }

        $host = strtolower(rtrim($parts['host'], '.'));
        $host = trim($host, '[]');
        if (in_array($host, ['fake-folio', 'localhost', '127.0.0.1', '::1', '0.0.0.0'], true)) {
            return true;
        }

        return substr($host, -5) === '.test' || substr($host, -10) === '.localhost';
    }
}
