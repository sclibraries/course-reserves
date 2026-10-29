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
        $claimRules = [
            'GET workflow/queue' => 'workflow-claim/queue',
            'GET workflow/my-items' => 'workflow-claim/my-items',
            'GET workflow/staff' => 'workflow-claim/staff',
            'POST workflow/item/<kind:(new|reuse)>/<id:\\d+>/claim' => 'workflow-claim/claim',
            'POST workflow/item/<kind:(new|reuse)>/<id:\\d+>/release' => 'workflow-claim/release',
            'POST workflow/item/<kind:(new|reuse)>/<id:\\d+>/handoff' => 'workflow-claim/handoff',
            'POST workflow/item/<kind:(new|reuse)>/<id:\\d+>/takeover' => 'workflow-claim/takeover',
            'GET workflow/item/<kind:(new|reuse)>/<id:\\d+>/timeline' => 'workflow-claim/timeline',
            'POST workflow/submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/claim-all' => 'workflow-claim/claim-all',
            'OPTIONS workflow/queue' => 'workflow-claim/options',
            'OPTIONS workflow/my-items' => 'workflow-claim/options',
            'OPTIONS workflow/staff' => 'workflow-claim/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/claim' => 'workflow-claim/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/release' => 'workflow-claim/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/handoff' => 'workflow-claim/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/takeover' => 'workflow-claim/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/timeline' => 'workflow-claim/options',
            'OPTIONS workflow/submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/claim-all' => 'workflow-claim/options',
        ];
        $groupRules = [
            'GET workflow/my-groups' => 'workflow-group/my-groups',
            'GET workflow/group/<id:\\d+>/queue' => 'workflow-group/group-queue',
            'GET workflow/groups' => 'workflow-group/groups',
            'GET workflow/admin/groups' => 'workflow-group/admin-groups',
            'POST workflow/admin/groups' => 'workflow-group/admin-groups',
            'PUT workflow/admin/groups/<id:\\d+>' => 'workflow-group/admin-group',
            'DELETE workflow/admin/groups/<id:\\d+>' => 'workflow-group/admin-group',
            'GET workflow/admin/groups/<id:\\d+>/members' => 'workflow-group/admin-group-members',
            'POST workflow/admin/groups/<id:\\d+>/members' => 'workflow-group/admin-group-members',
            'DELETE workflow/admin/groups/<id:\\d+>/members/<username:[^/]+>' => 'workflow-group/admin-group-member',
            'OPTIONS workflow/my-groups' => 'workflow-group/options',
            'OPTIONS workflow/group/<id:\\d+>/queue' => 'workflow-group/options',
            'OPTIONS workflow/groups' => 'workflow-group/options',
            'OPTIONS workflow/admin/groups' => 'workflow-group/options',
            'OPTIONS workflow/admin/groups/<id:\\d+>' => 'workflow-group/options',
            'OPTIONS workflow/admin/groups/<id:\\d+>/members' => 'workflow-group/options',
            'OPTIONS workflow/admin/groups/<id:\\d+>/members/<username:[^/]+>' => 'workflow-group/options',
        ];
        $flowRules = [
            'GET workflow/flows' => 'workflow-flow/flows',
            'OPTIONS workflow/flows' => 'workflow-flow/options',
            'GET workflow/item/<kind:(new|reuse)>/<id:\\d+>/flow' => 'workflow-flow/item-flow',
            'POST workflow/item/<kind:(new|reuse)>/<id:\\d+>/step-result' => 'workflow-flow/step-result',
            'POST workflow/item/<kind:(new|reuse)>/<id:\\d+>/switch-flow' => 'workflow-flow/switch-flow',
            'POST workflow/item/<kind:(new|reuse)>/<id:\\d+>/access-path' => 'workflow-flow/access-path',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/flow' => 'workflow-flow/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/step-result' => 'workflow-flow/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/switch-flow' => 'workflow-flow/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/access-path' => 'workflow-flow/options',
            'GET workflow/admin/flows' => 'workflow-flow-admin/flows',
            'POST workflow/admin/flows' => 'workflow-flow-admin/flows',
            'GET workflow/admin/flows/<id:\\d+>' => 'workflow-flow-admin/flow',
            'PUT workflow/admin/flows/<id:\\d+>' => 'workflow-flow-admin/flow',
            'DELETE workflow/admin/flows/<id:\\d+>' => 'workflow-flow-admin/flow',
            'POST workflow/admin/flows/<id:\\d+>/versions' => 'workflow-flow-admin/versions',
            'GET workflow/admin/flow-mapping' => 'workflow-flow-admin/mapping',
            'PUT workflow/admin/flow-mapping' => 'workflow-flow-admin/mapping',
            'GET workflow/admin/access-path-mapping' => 'workflow-flow-admin/access-path-mapping',
            'PUT workflow/admin/access-path-mapping' => 'workflow-flow-admin/access-path-mapping',
            'OPTIONS workflow/admin/flows' => 'workflow-flow-admin/options',
            'OPTIONS workflow/admin/flows/<id:\\d+>' => 'workflow-flow-admin/options',
            'OPTIONS workflow/admin/flows/<id:\\d+>/versions' => 'workflow-flow-admin/options',
            'OPTIONS workflow/admin/flow-mapping' => 'workflow-flow-admin/options',
            'OPTIONS workflow/admin/access-path-mapping' => 'workflow-flow-admin/options',
        ];
        $draftRules = [
            'POST faculty-submission/draft' => 'faculty-draft/create',
            'OPTIONS faculty-submission/draft' => 'faculty-draft/options',
            'DELETE faculty-submission/<id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>' => 'faculty-draft/delete',
        ];
        $availabilityRules = [
            'GET catalog-availability' => 'catalog-availability/index',
            'OPTIONS catalog-availability' => 'catalog-availability/options',
        ];
        $navPinRules = [
            'GET staff-nav-pins' => 'staff-nav-pin/index',
            'PUT staff-nav-pins' => 'staff-nav-pin/index',
            'DELETE staff-nav-pins' => 'staff-nav-pin/index',
            'OPTIONS staff-nav-pins' => 'staff-nav-pin/options',
            'GET staff-nav-pins/defaults' => 'staff-nav-pin/defaults',
            'PUT staff-nav-pins/defaults' => 'staff-nav-pin/defaults',
            'OPTIONS staff-nav-pins/defaults' => 'staff-nav-pin/options',
        ];
        $syllabusRules = [
            'GET faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi' => 'syllabus/faculty-list',
            'POST faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi' => 'syllabus/faculty-create',
            'GET faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi/<sid:\\d+>/file' => 'syllabus/faculty-file',
            'OPTIONS faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi' => 'syllabus/options',
            'OPTIONS faculty-submission/<uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>/syllabi/<sid:\\d+>/file' => 'syllabus/options',
            'POST workflow/syllabus/google-doc-text' => 'syllabus/google-doc-text',
            'OPTIONS workflow/syllabus/google-doc-text' => 'syllabus/options',
            'GET workflow/submission/<id:\\d+>/syllabi' => 'syllabus/staff-list',
            'POST workflow/submission/<id:\\d+>/syllabi' => 'syllabus/staff-create',
            'GET workflow/submission/<id:\\d+>/syllabi/<sid:\\d+>/file' => 'syllabus/staff-file',
            'OPTIONS workflow/submission/<id:\\d+>/syllabi' => 'syllabus/options',
            'OPTIONS workflow/submission/<id:\\d+>/syllabi/<sid:\\d+>/file' => 'syllabus/options',
        ];
        $staffEnteredRules = [
            'POST workflow/submission/staff-entered' => 'staff-entered-submission/create',
            'OPTIONS workflow/submission/staff-entered' => 'staff-entered-submission/options',
        ];
        $corsRules = [
            'GET physical-resource/by-external-id/<external_id>' => 'physical-resource/get-by-external-id',
            'OPTIONS physical-resource/update-resource-order' => 'cors-preflight/options',
            'OPTIONS <path:.*>' => 'cors-preflight/options',
        ];
        $expectedClaimRules = array_intersect_key($mergedRules, $claimRules);
        $expectedGroupRules = array_intersect_key($mergedRules, $groupRules);
        $expectedFlowRules = array_intersect_key($mergedRules, $flowRules);
        $expectedDraftRules = array_intersect_key($mergedRules, $draftRules);
        $expectedAvailabilityRules = array_intersect_key($mergedRules, $availabilityRules);
        $expectedNavPinRules = array_intersect_key($mergedRules, $navPinRules);
        $expectedSyllabusRules = array_intersect_key($mergedRules, $syllabusRules);
        $expectedStaffEnteredRules = array_intersect_key($mergedRules, $staffEnteredRules);
        $expectedCorsRules = array_intersect_key($mergedRules, $corsRules);
        $declaredRules = array_merge(
            $claimRules,
            $groupRules,
            $flowRules,
            $draftRules,
            $availabilityRules,
            $syllabusRules,
            $staffEnteredRules,
            $navPinRules,
            $corsRules
        );
        $existingRules = array_diff_key($mergedRules, $declaredRules);
        $this->assertCount(254, $mergedRules);
        $this->assertSame($claimRules, $expectedClaimRules);
        $this->assertSame($groupRules, $expectedGroupRules);
        $this->assertSame($flowRules, $expectedFlowRules);
        $this->assertSame($draftRules, $expectedDraftRules);
        $this->assertSame($availabilityRules, $expectedAvailabilityRules);
        $this->assertSame($navPinRules, $expectedNavPinRules);
        $this->assertSame($syllabusRules, $expectedSyllabusRules);
        $this->assertSame($staffEnteredRules, $expectedStaffEnteredRules);
        $this->assertSame($corsRules, $expectedCorsRules);
        $this->assertSame($baseline, $existingRules);

        $config = require codecept_root_dir('config/web.php');
        $this->assertSame($mergedRules, $config['components']['urlManager']['rules']);
    }

    public function testRepresentativeUrlsKeepTheirRoutesAndParameters()
    {
        $config = require codecept_root_dir('config/web.php');
        $manager = new UrlManager($config['components']['urlManager']);
        $uuid = '123e4567-e89b-12d3-a456-426614174000';
        $cases = [
            ['POST', 'dev-auth/login', ['dev-auth/login', []]],
            ['OPTIONS', 'dev-auth/login', ['cors-preflight/options', []]],
            ['POST', 'workflow/submission/staff-entered', ['staff-entered-submission/create', []]],
            ['OPTIONS', 'workflow/submission/staff-entered', ['staff-entered-submission/options', []]],
            ['GET', 'faculty-submission/' . $uuid, ['faculty-submission/view', ['id' => $uuid]]],
            ['POST', 'faculty-submission/draft', ['faculty-draft/create', []]],
            ['OPTIONS', 'faculty-submission/draft', ['faculty-draft/options', []]],
            ['DELETE', 'faculty-submission/' . $uuid, ['faculty-draft/delete', ['id' => $uuid]]],
            ['POST', 'faculty-submission/' . $uuid . '/communications', [
                'faculty-submission/create-communication', ['id' => $uuid],
            ]],
            ['OPTIONS', 'faculty-submission/' . $uuid, ['faculty-submission/options', ['id' => $uuid]]],
            ['GET', 'faculty-submission/' . $uuid . '/syllabi', ['syllabus/faculty-list', ['uuid' => $uuid]]],
            ['POST', 'faculty-submission/' . $uuid . '/syllabi', ['syllabus/faculty-create', ['uuid' => $uuid]]],
            ['GET', 'faculty-submission/' . $uuid . '/syllabi/999009401/file', [
                'syllabus/faculty-file', ['uuid' => $uuid, 'sid' => '999009401'],
            ]],
            ['OPTIONS', 'faculty-submission/' . $uuid . '/syllabi', ['syllabus/options', ['uuid' => $uuid]]],
            ['OPTIONS', 'faculty-submission/' . $uuid . '/syllabi/999009401/file', [
                'syllabus/options', ['uuid' => $uuid, 'sid' => '999009401'],
            ]],
            ['POST', 'workflow/syllabus/google-doc-text', ['syllabus/google-doc-text', []]],
            ['OPTIONS', 'workflow/syllabus/google-doc-text', ['syllabus/options', []]],
            ['GET', 'workflow/submission/999009401/syllabi', ['syllabus/staff-list', ['id' => '999009401']]],
            ['POST', 'workflow/submission/999009401/syllabi', ['syllabus/staff-create', ['id' => '999009401']]],
            ['GET', 'workflow/submission/999009401/syllabi/999009402/file', [
                'syllabus/staff-file', ['id' => '999009401', 'sid' => '999009402'],
            ]],
            ['OPTIONS', 'workflow/submission/999009401/syllabi', ['syllabus/options', ['id' => '999009401']]],
            ['OPTIONS', 'workflow/submission/999009401/syllabi/999009402/file', [
                'syllabus/options', ['id' => '999009401', 'sid' => '999009402'],
            ]],
            ['GET', 'workflow/needs-linking', ['workflow-link/needs-linking', []]],
            ['OPTIONS', 'workflow/needs-linking', ['workflow-link/options', []]],
            ['GET', 'workflow/queue', ['workflow-claim/queue', []]],
            ['GET', 'workflow/my-groups', ['workflow-group/my-groups', []]],
            ['GET', 'workflow/groups', ['workflow-group/groups', []]],
            ['OPTIONS', 'workflow/groups', ['workflow-group/options', []]],
            ['OPTIONS', 'workflow/group/999007209/queue', [
                'workflow-group/options', ['id' => '999007209'],
            ]],
            ['POST', 'workflow/admin/groups', ['workflow-group/admin-groups', []]],
            ['PUT', 'workflow/admin/groups/999007210', [
                'workflow-group/admin-group', ['id' => '999007210'],
            ]],
            ['DELETE', 'workflow/admin/groups/999007210/members/test-api083-staff', [
                'workflow-group/admin-group-member', ['id' => '999007210', 'username' => 'test-api083-staff'],
            ]],
            ['GET', 'workflow/flows', ['workflow-flow/flows', []]],
            ['GET', 'workflow/item/new/999007211/flow', [
                'workflow-flow/item-flow', ['kind' => 'new', 'id' => '999007211'],
            ]],
            ['POST', 'workflow/item/reuse/999007212/step-result', [
                'workflow-flow/step-result', ['kind' => 'reuse', 'id' => '999007212'],
            ]],
            ['POST', 'workflow/item/new/999007213/switch-flow', [
                'workflow-flow/switch-flow', ['kind' => 'new', 'id' => '999007213'],
            ]],
            ['POST', 'workflow/item/reuse/999007215/access-path', [
                'workflow-flow/access-path', ['kind' => 'reuse', 'id' => '999007215'],
            ]],
            ['GET', 'workflow/admin/access-path-mapping', ['workflow-flow-admin/access-path-mapping', []]],
            ['POST', 'workflow/admin/flows', ['workflow-flow-admin/flows', []]],
            ['GET', 'workflow/admin/flows/999007214', [
                'workflow-flow-admin/flow', ['id' => '999007214'],
            ]],
            ['POST', 'workflow/admin/flows/999007214/versions', [
                'workflow-flow-admin/versions', ['id' => '999007214'],
            ]],
            ['PUT', 'workflow/admin/flow-mapping', ['workflow-flow-admin/mapping', []]],
            ['POST', 'workflow/item/new/999007207/claim', [
                'workflow-claim/claim', ['kind' => 'new', 'id' => '999007207'],
            ]],
            ['OPTIONS', 'workflow/item/reuse/999007208/handoff', [
                'workflow-claim/options', ['kind' => 'reuse', 'id' => '999007208'],
            ]],
            ['POST', 'workflow/submission/' . $uuid . '/claim-all', [
                'workflow-claim/claim-all', ['uuid' => $uuid],
            ]],
            ['POST', 'workflow/submission/' . $uuid . '/recheck', [
                'workflow-link/recheck', ['uuid' => $uuid],
            ]],
            ['OPTIONS', 'workflow/submission/' . $uuid . '/recheck', [
                'workflow-link/options', ['uuid' => $uuid],
            ]],
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
            ['GET', 'catalog-availability', ['catalog-availability/index', []]],
            ['OPTIONS', 'catalog-availability', ['catalog-availability/options', []]],
            ['GET', 'staff-nav-pins', ['staff-nav-pin/index', []]],
            ['PUT', 'staff-nav-pins', ['staff-nav-pin/index', []]],
            ['DELETE', 'staff-nav-pins', ['staff-nav-pin/index', []]],
            ['OPTIONS', 'staff-nav-pins', ['staff-nav-pin/options', []]],
            ['GET', 'staff-nav-pins/defaults', ['staff-nav-pin/defaults', []]],
            ['PUT', 'staff-nav-pins/defaults', ['staff-nav-pin/defaults', []]],
            ['OPTIONS', 'staff-nav-pins/defaults', ['staff-nav-pin/options', []]],
            ['OPTIONS', 'material-type/all', ['material-type/options', []]],
            ['GET', 'material-type/fields', ['material-type/fields', []]],
            ['GET', 'checklist/get-template/999007204', [
                'checklist/get-template', ['id' => '999007204'],
            ]],
            ['GET', 'course/999007205/resources', ['course/resources', ['offeringId' => '999007205']]],
            ['OPTIONS', 'course/999007205/resources', [
                'cors-preflight/options', ['path' => 'course/999007205/resources'],
            ]],
            ['GET', 'course/get-merged-resources', ['course/get-merged-resources', []]],
            ['GET', 'physical-resource/by-external-id/test-api104-id', [
                'physical-resource/get-by-external-id', ['external_id' => 'test-api104-id'],
            ]],
            ['OPTIONS', 'physical-resource/by-external-id/test-api104-id', [
                'cors-preflight/options', ['path' => 'physical-resource/by-external-id/test-api104-id'],
            ]],
            ['OPTIONS', 'physical-resource/cleanup-references', [
                'cors-preflight/options', ['path' => 'physical-resource/cleanup-references'],
            ]],
            ['OPTIONS', 'physical-resource/update-resource-order', ['cors-preflight/options', []]],
            ['GET', 'course/course-reserves/public/courses/' . $uuid, [
                'course/course/public-view', ['uuid' => $uuid],
            ]],
            ['GET', 'resource/999007206', ['resource/view', ['id' => '999007206']]],
            ['GET', 'faculty-proxy/staff/grants', ['faculty-proxy/staff-grants', []]],
            ['OPTIONS', 'faculty-proxy/staff/grants', ['faculty-proxy/options', []]],
            ['GET', 'course-assignments/instructor-courses', ['course-assignments/instructor-courses', []]],
            ['OPTIONS', 'course-assignments/instructor-courses', [
                'cors-preflight/options', ['path' => 'course-assignments/instructor-courses'],
            ]],
            ['OPTIONS', 'offering-link/link-existing-resources', [
                'cors-preflight/options', ['path' => 'offering-link/link-existing-resources'],
            ]],
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

    public function testEveryConfiguredRoutePatternHasAnOptionsRoute()
    {
        $config = require codecept_root_dir('config/web.php');
        $manager = new UrlManager($config['components']['urlManager']);
        $paths = [];

        foreach ($config['components']['urlManager']['rules'] as $pattern => $route) {
            if (is_string($pattern) && preg_match('/^(GET|POST|PUT|PATCH|DELETE|HEAD) (.+)$/', $pattern, $matches)) {
                $paths[] = $this->sampleRoutePath($matches[2]);
                continue;
            }

            if (!is_array($route) || ($route['class'] ?? null) !== 'yii\\rest\\UrlRule') {
                continue;
            }

            foreach ($route['controller'] as $controller) {
                foreach (array_keys($route['extraPatterns']) as $extraPattern) {
                    if (!preg_match('/^(GET|POST|PUT|PATCH|DELETE|HEAD) (.*)$/', $extraPattern, $matches)) {
                        continue;
                    }
                    $paths[] = $this->sampleRoutePath($controller . '/' . $matches[2]);
                }
            }
        }

        $hadRequestMethod = isset($_SERVER['REQUEST_METHOD']);
        $previousRequestMethod = $hadRequestMethod ? $_SERVER['REQUEST_METHOD'] : null;
        try {
            $_SERVER['REQUEST_METHOD'] = 'OPTIONS';
            foreach (array_unique($paths) as $path) {
                $request = new Request();
                $request->setBaseUrl('');
                $request->setScriptUrl('');
                $request->setPathInfo($path);
                $parsed = $manager->parseRequest($request);

                $this->assertNotFalse($parsed, 'No OPTIONS route for ' . $path);
                $this->assertTrue(
                    $parsed[0] === 'cors-preflight/options' || substr($parsed[0], -8) === '/options',
                    'OPTIONS must target a preflight action for ' . $path . ', got ' . $parsed[0]
                );
            }
        } finally {
            if ($hadRequestMethod) {
                $_SERVER['REQUEST_METHOD'] = $previousRequestMethod;
            } else {
                unset($_SERVER['REQUEST_METHOD']);
            }
        }
    }

    private function sampleRoutePath($path)
    {
        return preg_replace('/<[^>]+>/', '1', $path);
    }
}
