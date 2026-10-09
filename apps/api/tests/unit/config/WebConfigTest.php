<?php

namespace tests\unit\config;

class WebConfigTest extends \Codeception\Test\Unit
{
    public function testFacultySubmissionUuidCommunicationsRoutesAreDeclaredOnce()
    {
        $source = file_get_contents(codecept_root_dir('config/web.php'));

        $this->assertSame(1, substr_count(
            $source,
            "'GET faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications' => 'faculty-submission/communications'"
        ));
    }

    public function testFacultyFormDockerOriginIsAllowedForCors()
    {
        $webConfig = file_get_contents(codecept_root_dir('config/web.php'));
        $baseRestController = file_get_contents(codecept_root_dir('controllers/BaseRestController.php'));
        $courseAssignmentsController = file_get_contents(codecept_root_dir('controllers/CourseAssignmentsController.php'));

        $this->assertStringContainsString("'http://localhost:5174'", $webConfig);
        $this->assertStringContainsString("'http://127.0.0.1:5174'", $webConfig);
        $this->assertStringContainsString("'http://localhost:5174'", $baseRestController);
        $this->assertStringContainsString("'http://127.0.0.1:5174'", $baseRestController);
        $this->assertStringContainsString("'http://localhost:5174'", $courseAssignmentsController);
        $this->assertStringContainsString("'http://127.0.0.1:5174'", $courseAssignmentsController);
    }

    public function testSubmissionWorkflowCompleteProcessingRouteIsDeclared()
    {
        $source = file_get_contents(codecept_root_dir('config/web.php'));

        $this->assertStringContainsString(
            "'POST submission-workflow/item/<itemId:\\d+>/complete-processing' => 'submission-workflow/complete-processing'",
            $source
        );
        $this->assertStringContainsString(
            "'OPTIONS submission-workflow/item/<itemId:\\d+>/complete-processing' => 'submission-workflow/options'",
            $source
        );
    }
}
