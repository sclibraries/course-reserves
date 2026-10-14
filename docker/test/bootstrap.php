<?php

define('YII_ENV', 'test');
require_once '/app/config/environment.php';
require_once '/app/vendor/yiisoft/yii2/Yii.php';
require '/app/vendor/autoload.php';
// Load before Codeception discovers the Cest subclasses.
require_once '/app/tests/functional/BaseFunctionalCest.php';
