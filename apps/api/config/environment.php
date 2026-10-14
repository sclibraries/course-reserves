<?php

require_once dirname(__DIR__) . '/vendor/autoload.php';
\Dotenv\Dotenv::createUnsafeImmutable(dirname(__DIR__))->safeLoad();
require_once dirname(__DIR__) . '/components/Environment.php';

$configuredEnvironment = defined('YII_ENV') ? YII_ENV : getenv('YII_ENV');
$environment = \app\components\Environment::resolve($configuredEnvironment);
defined('YII_ENV') or define('YII_ENV', $environment);
defined('YII_DEBUG') or define('YII_DEBUG', \app\components\Environment::debugEnabled($environment));

if ($environment === 'prod') {
    $missing = \app\components\Environment::missingProductionSettings();
    if ($missing) {
        $message = 'Missing required production settings: ' . implode(', ', $missing);
        if (PHP_SAPI === 'cli') {
            fwrite(STDERR, $message . PHP_EOL);
            exit(1);
        }

        http_response_code(500);
        echo $message;
        exit;
    }
}
