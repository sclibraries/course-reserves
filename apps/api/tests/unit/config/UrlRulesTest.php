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
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/flow' => 'workflow-flow/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/step-result' => 'workflow-flow/options',
            'OPTIONS workflow/item/<kind:(new|reuse)>/<id:\\d+>/switch-flow' => 'workflow-flow/options',
            'GET workflow/admin/flows' => 'workflow-flow-admin/flows',
            'POST workflow/admin/flows' => 'workflow-flow-admin/flows',
            'GET workflow/admin/flows/<id:\\d+>' => 'workflow-flow-admin/flow',
            'PUT workflow/admin/flows/<id:\\d+>' => 'workflow-flow-admin/flow',
            'DELETE workflow/admin/flows/<id:\\d+>' => 'workflow-flow-admin/flow',
            'POST workflow/admin/flows/<id:\\d+>/versions' => 'workflow-flow-admin/versions',
            'GET workflow/admin/flow-mapping' => 'workflow-flow-admin/mapping',
            'PUT workflow/admin/flow-mapping' => 'workflow-flow-admin/mapping',
            'OPTIONS workflow/admin/flows' => 'workflow-flow-admin/options',
            'OPTIONS workflow/admin/flows/<id:\\d+>' => 'workflow-flow-admin/options',
            'OPTIONS workflow/admin/flows/<id:\\d+>/versions' => 'workflow-flow-admin/options',
            'OPTIONS workflow/admin/flow-mapping' => 'workflow-flow-admin/options',
        ];
        $expectedClaimRules = array_intersect_key($mergedRules, $claimRules);
        $expectedGroupRules = array_intersect_key($mergedRules, $groupRules);
        $expectedFlowRules = array_intersect_key($mergedRules, $flowRules);
        $declaredWorkflowRules = array_merge($claimRules, $groupRules, $flowRules);
        $existingRules = array_diff_key($mergedRules, $declaredWorkflowRules);
        $this->assertCount(220, $mergedRules);
        $this->assertSame($claimRules, $expectedClaimRules);
        $this->assertSame($groupRules, $expectedGroupRules);
        $this->assertSame($flowRules, $expectedFlowRules);
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
            ['OPTIONS', 'dev-auth/login', ['dev-auth/login', []]],
            ['GET', 'faculty-submission/' . $uuid, ['faculty-submission/view', ['id' => $uuid]]],
            ['POST', 'faculty-submission/' . $uuid . '/communications', [
                'faculty-submission/create-communication', ['id' => $uuid],
            ]],
            ['OPTIONS', 'faculty-submission/' . $uuid, ['faculty-submission/options', ['id' => $uuid]]],
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
