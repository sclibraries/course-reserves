<?php

namespace tests\unit\controllers;

use app\controllers\ResourceController;
use yii\web\ForbiddenHttpException;

class ResourceControllerTest extends \Codeception\Test\Unit
{
    public function testWriteActionsUseBearerAuthentication()
    {
        $controller = new ResourceController('resource', \Yii::$app);
        $behaviors = $controller->behaviors();

        $this->assertArrayHasKey('authenticator', $behaviors);
        $this->assertSame(
            ['create', 'update', 'delete', 'add-link', 'delete-link'],
            $behaviors['authenticator']['only']
        );
    }

    public function testResourceWriteAccessRejectsFacultyIdentity()
    {
        $controller = new ResourceController('resource', \Yii::$app);

        $this->expectException(ForbiddenHttpException::class);
        $this->invokeMethod($controller, 'assertResourceWriteAccess', [
            (object) ['role' => 'faculty'],
        ]);
    }

    public function testResourceWriteAccessAllowsStaffAndAdminIdentities()
    {
        $controller = new ResourceController('resource', \Yii::$app);

        $this->assertNull($this->invokeMethod($controller, 'assertResourceWriteAccess', [
            (object) ['role' => 'staff'],
        ]));
        $this->assertNull($this->invokeMethod($controller, 'assertResourceWriteAccess', [
            (object) ['role' => 'admin'],
        ]));
    }

    private function invokeMethod($object, $methodName, array $arguments = [])
    {
        $reflection = new \ReflectionMethod($object, $methodName);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($object, $arguments);
    }
}
