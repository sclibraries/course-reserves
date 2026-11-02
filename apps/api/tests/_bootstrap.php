<?php
if (getenv('API_TEST_DEPRECATIONS') === '1') {
    require_once __DIR__ . '/_support/deprecation-handler.php';
}

define('YII_ENV', 'test');
require_once __DIR__ . '/../config/environment.php';

require_once __DIR__ . '/../vendor/yiisoft/yii2/Yii.php';
require __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/_support/MigrationRollback.php';
