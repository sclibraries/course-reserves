<?php

namespace tests\unit\config;

use yii\web\Request;
use yii\web\UrlManager;

class UrlRulesTest extends \Codeception\Test\Unit
{
    private $routeFiles = [
        'config/routes/misc.php',
        'config/routes/faculty-submission.php',
        'config/routes/submission-workflow.php',
        'config/routes/workflow-admin.php',
        'config/routes/checklist.php',
        'config/routes/rest.php',
    ];

    public function testRouteFilesMergeToTheBaselineRulesInWebConfig()
    {
        $mergedRules = [];
        foreach ($this->routeFiles as $routeFile) {
            $routePath = codecept_root_dir($routeFile);
            $this->assertFileExists($routePath, 'Missing route rules file: ' . $routeFile);
            $mergedRules = array_merge($mergedRules, require $routePath);
        }

        $baseline = json_decode(
            file_get_contents(codecept_root_dir('tests/fixtures/api072-main-url-rules.json')),
            true
        );
        $this->assertSame(JSON_ERROR_NONE, json_last_error());
        $this->assertTrue(is_array($baseline));
        $this->assertCount(161, $mergedRules);
        $this->assertSame($baseline, $mergedRules);

        $config = require codecept_root_dir('config/web.php');
        $this->assertSame($baseline, $config['components']['urlManager']['rules']);
    }

    public function testRepresentativeUrlsKeepTheirRoutesAndParameters()
    {
        $config = require codecept_root_dir('config/web.php');
        $manager = new UrlManager($config['components']['urlManager']);
        $uuid = '123e4567-e89b-12d3-a456-426614174000';
        $cases = [
            ['POST', 'dev-auth/login', ['dev-auth/login', []]],
            ['OPTIONS', 'dev-auth/login', ['dev-auth/login', []]],
            ['GET', 'faculty-submission/' . $uuid, ['faculty-submission/view', ['id' => $uuid]]],
            ['POST', 'faculty-submission/' . $uuid . '/communications', [
                'faculty-submission/create-communication', ['id' => $uuid],
            ]],
            ['OPTIONS', 'faculty-submission/' . $uuid, ['faculty-submission/options', ['id' => $uuid]]],
            ['GET', 'workflow/submission/' . $uuid . '/candidates', [
                'workflow-link/candidates', ['uuid' => $uuid],
            ]],
            ['POST', 'workflow/submission/' . $uuid . '/link', [
                'workflow-link/link', ['uuid' => $uuid],
            ]],
            ['OPTIONS', 'workflow/submission/' . $uuid . '/timeline', [
                'workflow-link/options', ['uuid' => $uuid],
            ]],
            ['GET', 'submission-workflow/submission/999007201/communications', [
                'submission-workflow/communications', ['id' => '999007201'],
            ]],
            ['OPTIONS', 'submission-workflow/item/999007202/claim', [
                'submission-workflow/options', ['itemId' => '999007202'],
            ]],
            ['GET', 'workflow-admin/templates', ['workflow-admin/list-templates', []]],
            ['OPTIONS', 'workflow-admin/template/999007203/duplicate', [
                'workflow-admin/options', ['id' => '999007203'],
            ]],
            ['GET', 'tracking/top-courses', ['tracking/top-courses', []]],
            ['OPTIONS', 'tracking/analytics', ['tracking/options', []]],
            ['GET', 'tracking/course-detail', ['tracking/course-detail', []]],
            ['OPTIONS', 'material-type/all', ['material-type/options', []]],
            ['GET', 'material-type/fields', ['material-type/fields', []]],
            ['GET', 'checklist/get-template/999007204', [
                'checklist/get-template', ['id' => '999007204'],
            ]],
            ['GET', 'course/999007205/resources', ['course/resources', ['offeringId' => '999007205']]],
            ['GET', 'course/get-merged-resources', ['course/get-merged-resources', []]],
            ['GET', 'course/course-reserves/public/courses/' . $uuid, [
                'course/course/public-view', ['uuid' => $uuid],
            ]],
            ['GET', 'resource/999007206', ['resource/view', ['id' => '999007206']]],
            ['GET', 'faculty-proxy/staff/grants', ['faculty-proxy/staff-grants', []]],
            ['OPTIONS', 'faculty-proxy/staff/grants', ['faculty-proxy/options', []]],
            ['GET', 'course-assignments/instructor-courses', ['course-assignments/instructor-courses', []]],
        ];

        $hadRequestMethod = isset($_SERVER['REQUEST_METHOD']);
        $previousRequestMethod = $hadRequestMethod ? $_SERVER['REQUEST_METHOD'] : null;
        try {
            foreach ($cases as $case) {
                $_SERVER['REQUEST_METHOD'] = $case[0];
                $request = new Request();
                $request->setBaseUrl('');
                $request->setScriptUrl('');
                $request->setPathInfo($case[1]);

                $this->assertSame($case[2], $manager->parseRequest($request), $case[0] . ' ' . $case[1]);
            }
        } finally {
            if ($hadRequestMethod) {
                $_SERVER['REQUEST_METHOD'] = $previousRequestMethod;
            } else {
                unset($_SERVER['REQUEST_METHOD']);
            }
        }
    }
}
