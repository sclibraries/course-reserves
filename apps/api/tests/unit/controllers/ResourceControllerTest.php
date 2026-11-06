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
            ['index', 'view', 'search', 'create', 'update', 'delete', 'add-link', 'delete-link', 'usage'],
            $behaviors['authenticator']['only']
        );
        $this->assertSame(['index', 'view', 'search'], $behaviors['authenticator']['optional']);
    }

    public function testResourceStaffAccessRejectsFacultyIdentity()
    {
        $controller = new ResourceController('resource', \Yii::$app);

        $this->expectException(ForbiddenHttpException::class);
        $this->invokeMethod($controller, 'assertResourceStaffAccess', [
            (object) ['role' => 'faculty'],
        ]);
    }

    public function testResourceStaffAccessAllowsStaffAndAdminIdentities()
    {
        $controller = new ResourceController('resource', \Yii::$app);

        $this->assertNull($this->invokeMethod($controller, 'assertResourceStaffAccess', [
            (object) ['role' => 'staff'],
        ]));
        $this->assertNull($this->invokeMethod($controller, 'assertResourceStaffAccess', [
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
