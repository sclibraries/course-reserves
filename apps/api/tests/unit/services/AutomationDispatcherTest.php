<?php

namespace tests\unit\services;

use app\models\WorkflowInstance;
use app\models\WorkflowInstanceSteps;
use app\services\AutomationDispatcher;

class AutomationDispatcherTest extends \Codeception\Test\Unit
{
    public function testEnsureCourseOfferingHandlerFailsAsUnsupportedInsteadOfFatal()
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('UNSUPPORTED_AUTOMATION: ensure_course_and_offering');

        AutomationDispatcher::run(new WorkflowInstance(), new WorkflowInstanceSteps(), 'ensure_course_and_offering', []);
    }
}
