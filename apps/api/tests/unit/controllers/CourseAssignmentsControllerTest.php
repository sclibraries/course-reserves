<?php

/**
 * Unit tests for the CourseAssignmentsController access and identity behavior.
 */
namespace tests\unit\controllers;

use app\controllers\CourseAssignmentsController;
use Yii;
use yii\filters\auth\HttpBearerAuth;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;
use yii\web\UnauthorizedHttpException;

require_once codecept_root_dir('controllers/CourseAssignmentsController.php');

/**
 * Verifies the controller's access configuration and lookup seams.
 */
class CourseAssignmentsControllerTest extends \Codeception\Test\Unit
{
    /**
     * Clear request parameters between tests.
     *
     * @return void
     */
    protected function _after()
    {
        Yii::$app->request->setQueryParams([]);
    }

    /**
     * Bearer auth is required for every lookup action except OPTIONS.
     *
     * @return void
     */
    public function testEveryLookupActionRequiresBearerExceptOptions()
    {
        $controller = new TestCourseAssignmentsController('course-assignments', Yii::$app);
        $authenticator = $controller->behaviors()['authenticator'];

        $this->assertSame(HttpBearerAuth::class, $authenticator['class']);
        $this->assertSame(['options'], $authenticator['except']);
        $this->assertArrayNotHasKey('only', $authenticator);
    }

    /**
     * The query-identity action is disabled outside development.
     *
     * @return void
     */
    public function testProductionSemanticsDisableQueryIdentityEndpoint()
    {
        $controller = new TestCourseAssignmentsController('course-assignments', Yii::$app);
        $controller->developmentEnvironment = false;

        $this->expectException(NotFoundHttpException::class);
        $controller->assertTestEndpointEnabledForTest();
    }

    /**
     * The development query-identity action preserves its sandbox response.
     *
     * @return void
     */
    public function testDevelopmentQueryIdentityEndpointPreservesSandboxLookup()
    {
        Yii::$app->request->setQueryParams(
            [
            'full_name' => 'Synthetic Faculty',
            'internal_id' => '999000003',
            ]
        );
        $controller = new TestCourseAssignmentsController('course-assignments', Yii::$app);
        $controller->developmentEnvironment = true;

        $result = $controller->actionTestInstructorCourses();

        $this->assertSame(
            [
            'success' => true,
            'instructor' => [
                'full_name' => 'Synthetic Faculty',
                'internal_id' => '999000003',
            ],
            'courses' => [],
            'count' => 0,
            ], $result
        );
        $this->assertSame(['Synthetic Faculty', '999000003', true], $controller->lookupArguments);
    }

    /**
     * Authenticated course lookup uses normalized token identity fields.
     *
     * @return void
     */
    public function testAuthenticatedLookupUsesNormalizedIdentityAndPreservesResponseShape()
    {
        $controller = new TestCourseAssignmentsController('course-assignments', Yii::$app);
        $controller->identity = (object) [
            'fullName' => 'Synthetic Faculty',
            'internalId' => '999000004',
        ];

        $result = $controller->actionInstructorCourses();

        $this->assertSame(
            [
            'success' => true,
            'instructor' => [
                'full_name' => 'Synthetic Faculty',
                'internal_id' => '999000004',
            ],
            'courses' => [],
            'count' => 0,
            ], $result
        );
        $this->assertSame(['Synthetic Faculty', '999000004', false], $controller->lookupArguments);
    }

    /**
     * Lookup rejects a missing authenticated identity.
     *
     * @return void
     */
    public function testLookupRejectsMissingAuthenticatedIdentity()
    {
        $controller = new TestCourseAssignmentsController('course-assignments', Yii::$app);

        $this->expectException(UnauthorizedHttpException::class);
        $controller->actionInstructorCourses();
    }

    /**
     * Lookup rejects identity claims that lack required fields.
     *
     * @return void
     */
    public function testLookupRejectsMissingNormalizedClaims()
    {
        $controller = new TestCourseAssignmentsController('course-assignments', Yii::$app);
        $controller->identity = (object) [
            'fullName' => 'Synthetic Faculty',
            'internalId' => null,
        ];

        $this->expectException(BadRequestHttpException::class);
        $controller->actionInstructorCourses();
    }
}

/**
 * Exposes the controller's protected behavior for isolated unit assertions.
 */
class TestCourseAssignmentsController extends CourseAssignmentsController
{
    /**
     * Whether to enable the query-identity test action.
     *
     * @var bool
     */
    public $developmentEnvironment = false;
    /**
     * Identity returned by the authentication seam.
     *
     * @var object|null
     */
    public $identity;
    /**
     * Arguments captured by the lookup seam.
     *
     * @var array|null
     */
    public $lookupArguments;

    /**
     * Expose the development guard to tests.
     *
     * @return void
     */
    public function assertTestEndpointEnabledForTest()
    {
        $this->assertTestEndpointEnabled();
    }

    /**
     * Override the environment check for isolated tests.
     *
     * @return bool
     */
    protected function isDevelopmentEnvironment()
    {
        return $this->developmentEnvironment;
    }

    /**
     * Override the authenticated identity for isolated tests.
     *
     * @return object|null
     */
    protected function getAuthenticatedIdentity()
    {
        return $this->identity;
    }

    /**
     * Capture the instructor lookup arguments without reading the database.
     *
     * @param  string $fullName   Faculty name.
     * @param  string $internalId Faculty internal identifier.
     * @param  bool   $debug      Whether debug output is requested.
     * @return array
     */
    protected function getInstructorCourses($fullName, $internalId, $debug = false)
    {
        $this->lookupArguments = [$fullName, $internalId, $debug];

        return [
            'success' => true,
            'instructor' => [
                'full_name' => $fullName,
                'internal_id' => $internalId,
            ],
            'courses' => [],
            'count' => 0,
        ];
    }
}
