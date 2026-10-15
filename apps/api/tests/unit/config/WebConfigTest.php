<?php

namespace tests\unit\config;

class WebConfigTest extends \Codeception\Test\Unit
{
    /**
     * Both faculty token issuers delegate to the shared claims helper.
     *
     * @return void
     */
    public function testFacultyTokenEntryPointsStructurallyDelegatePayloadConstructionToHelper()
    {
        $authorizationSource = file_get_contents(codecept_root_dir('admin/faculty-authorize.php'));
        $refreshSource = file_get_contents(codecept_root_dir('admin/faculty-refresh-token.php'));

        $this->assertStringContainsString('use app\services\FacultyTokenClaims;', $authorizationSource);
        $this->assertSame(2, substr_count($authorizationSource, 'FacultyTokenClaims::forAuthorization('));
        $this->assertStringContainsString('use app\services\FacultyTokenClaims;', $refreshSource);
        $this->assertSame(2, substr_count($refreshSource, 'FacultyTokenClaims::forRefresh('));
    }

    public function testLocalRolePreservingRefreshRevalidatesRoles()
    {
        $refreshSource = file_get_contents(codecept_root_dir('admin/refresh-token-local.php'));
        $shibbolethDevRefreshSource = file_get_contents(codecept_root_dir('admin/refresh-token-dev.php'));

        $this->assertStringContainsString('use app\\services\\FacultyRoleResolver;', $refreshSource);
        $this->assertStringContainsString('FacultyRoleResolver())->forRefresh(', $refreshSource);
        $this->assertStringNotContainsString("'role' => " . '$decoded->role', $refreshSource);
        $this->assertStringNotContainsString("'role'", $shibbolethDevRefreshSource);
    }

    public function testFacultySubmissionUuidCommunicationsRoutesAreDeclaredOnce()
    {
        $config = require codecept_root_dir('config/web.php');
        $pattern = 'GET faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/communications';
        $rules = $config['components']['urlManager']['rules'];

        $this->assertArrayHasKey($pattern, $rules);
        $this->assertSame('faculty-submission/communications', $rules[$pattern]);
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
        $config = require codecept_root_dir('config/web.php');
        $rules = $config['components']['urlManager']['rules'];
        $post = 'POST submission-workflow/item/<itemId:\\d+>/complete-processing';
        $options = 'OPTIONS submission-workflow/item/<itemId:\\d+>/complete-processing';

        $this->assertSame('submission-workflow/complete-processing', $rules[$post]);
        $this->assertSame('submission-workflow/options', $rules[$options]);
    }
}
