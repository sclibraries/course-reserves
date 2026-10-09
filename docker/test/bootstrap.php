<?php

define('YII_ENV', 'test');
defined('YII_DEBUG') or define('YII_DEBUG', true);
require_once '/app/vendor/yiisoft/yii2/Yii.php';
require '/app/vendor/autoload.php';
// Load before Codeception discovers the Cest subclasses.
require_once '/app/tests/functional/BaseFunctionalCest.php';
