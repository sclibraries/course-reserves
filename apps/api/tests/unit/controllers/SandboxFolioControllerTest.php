<?php

namespace tests\unit\controllers;

use app\controllers\SandboxFolioController;
use yii\filters\Cors;

class SandboxFolioControllerTest extends \Codeception\Test\Unit
{
    public function testSandboxFolioSearchAllowsLocalAdminOrigins()
    {
        $controller = new SandboxFolioController('sandbox-folio', \Yii::$app);
        $behaviors = $controller->behaviors();

        $this->assertArrayHasKey('corsFilter', $behaviors);
        $this->assertSame(Cors::class, $behaviors['corsFilter']['class']);
        $this->assertContains('http://localhost:5173', $behaviors['corsFilter']['cors']['Origin']);
        $this->assertContains('http://127.0.0.1:5173', $behaviors['corsFilter']['cors']['Origin']);
        $this->assertContains('GET', $behaviors['corsFilter']['cors']['Access-Control-Request-Method']);
        $this->assertContains('OPTIONS', $behaviors['corsFilter']['cors']['Access-Control-Request-Method']);
    }
}
