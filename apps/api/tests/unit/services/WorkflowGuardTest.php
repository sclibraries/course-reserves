<?php

namespace tests\unit\services;

use app\services\WorkflowGuard;

class WorkflowGuardTest extends \Codeception\Test\Unit
{
    public function testNormalizeDependsOnKeepsAlreadyDecodedArrays()
    {
        $this->assertSame(
            ['verify_course', 'claim_items'],
            $this->invokeMethod('normalizeDependsOn', [['verify_course', 'claim_items']])
        );
    }

    public function testNormalizeDependsOnDecodesJsonArrays()
    {
        $this->assertSame(
            ['verify_course', 'claim_items'],
            $this->invokeMethod('normalizeDependsOn', ['["verify_course","claim_items"]'])
        );
    }

    private function invokeMethod($methodName, array $arguments = [])
    {
        $reflection = new \ReflectionMethod(WorkflowGuard::class, $methodName);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs(null, $arguments);
    }
}
