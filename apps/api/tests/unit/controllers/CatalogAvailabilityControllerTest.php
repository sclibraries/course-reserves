<?php

namespace tests\unit\controllers;

use app\controllers\CatalogAvailabilityController;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\ContentNegotiator;
use yii\web\Response;

require_once codecept_root_dir('controllers/BaseRestController.php');
require_once codecept_root_dir('controllers/CatalogAvailabilityController.php');

/** Verifies access and response configuration for catalog availability. */
class CatalogAvailabilityControllerTest extends \Codeception\Test\Unit
{
    public function testControllerUsesBaseAuthAndAddsLoopbackNginxOrigin()
    {
        $controller = new CatalogAvailabilityController('catalog-availability', \Yii::$app);
        $behaviors = $controller->behaviors();

        $this->assertSame(HttpBearerAuth::class, $behaviors['authenticator']['class']);
        $this->assertSame(['options'], $behaviors['authenticator']['except']);
        $this->assertSame(ContentNegotiator::class, $behaviors['contentNegotiator']['class']);
        $this->assertSame(
            ['application/json' => Response::FORMAT_JSON],
            $behaviors['contentNegotiator']['formats']
        );
        $this->assertContains(
            'http://127.0.0.1:8080',
            $behaviors['corsFilter']['cors']['Origin']
        );
    }
}
