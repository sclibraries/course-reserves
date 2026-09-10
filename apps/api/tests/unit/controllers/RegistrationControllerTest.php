<?php

namespace tests\unit\controllers;

use app\controllers\RegistrationController;

class RegistrationControllerTest extends \Codeception\Test\Unit
{
    public function testRegistrationDefaultsForceNormalUserRole()
    {
        $controller = new RegistrationController('registration', \Yii::$app);
        $user = (object) [
            'role' => 'admin',
            'approved' => 1,
            'created_at' => null,
        ];

        $this->invokeMethod($controller, 'applyRegistrationDefaults', [$user]);

        $this->assertSame('user', $user->role);
        $this->assertSame(0, $user->approved);
        $this->assertNotEmpty($user->created_at);
    }

    private function invokeMethod($object, $methodName, array $arguments = [])
    {
        $reflection = new \ReflectionMethod($object, $methodName);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($object, $arguments);
    }
}
