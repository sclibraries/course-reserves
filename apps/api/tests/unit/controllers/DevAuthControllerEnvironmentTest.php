<?php

namespace tests\unit\controllers;

use app\controllers\DevAuthController;
use yii\web\ForbiddenHttpException;

class DevAuthControllerEnvironmentTest extends \Codeception\Test\Unit
{
    public function testDevLoginIsUnavailableInTestEnvironment()
    {
        $controller = new DevAuthController('dev-auth', \Yii::$app);

        $this->expectException(ForbiddenHttpException::class);
        $controller->actionLogin();
    }
}
