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

    public function testWebAndControllersUseTheSharedCorsOriginPolicy()
    {
        $config = require codecept_root_dir('config/web.php');
        $origins = \app\components\CorsOriginPolicy::allowedOrigins($config['params']['corsOrigins'] ?? []);

        $this->assertSame($origins, $config['components']['cors']['cors']['Origin']);
        $this->assertContains('http://localhost:5173', $origins);
        $this->assertContains('http://localhost:5174', $origins);
        $this->assertNotContains('http://127.0.0.1:8080', $origins);
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
