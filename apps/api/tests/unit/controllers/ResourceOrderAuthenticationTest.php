<?php

namespace tests\unit\controllers;

use app\controllers\CourseController;
use app\controllers\OfferingLinkController;
use app\controllers\PhysicalResourceController;

class ResourceOrderAuthenticationTest extends \Codeception\Test\Unit
{
    public function testResourceOrderUpdatesRequireBearerAuthentication()
    {
        $controllers = [
            new CourseController('course', \Yii::$app),
            new OfferingLinkController('offering-link', \Yii::$app),
            new PhysicalResourceController('physical-resource', \Yii::$app),
        ];

        foreach ($controllers as $controller) {
            $behaviors = $controller->behaviors();
            $except = $behaviors['authenticator']['except'] ?? [];

            $this->assertNotContains(
                'update-resource-order',
                $except,
                get_class($controller) . ' must not allow anonymous resource order updates.'
            );
        }
    }
}
