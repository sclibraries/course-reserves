<?php

/**
 * Unit tests for the CourseAssignmentsController access and identity behavior.
 */
namespace tests\unit\controllers;

use app\controllers\CourseAssignmentsController;
use app\components\Roles;
use app\filters\RoleAccessFilter;
use Yii;
use yii\filters\auth\HttpBearerAuth;
use yii\web\IdentityInterface;
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
        Yii::$app->user->setIdentity(null);
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

        $roleFilter = $controller->behaviors()['roleAccessFilter'];
        $this->assertSame(RoleAccessFilter::class, $roleFilter['class']);
        $this->assertSame(Roles::STAFF, $roleFilter['rules']['index']);
        $this->assertSame(Roles::SIGNED_IN, $roleFilter['rules']['instructor-courses']);
    }

    /**
     * The query-identity action is disabled outside development.
     *
     * @return void
     */
    public function testProductionSemanticsDisableQueryIdentityEndpoint()
    {
        $controller = new TestCourseAssignmentsController('course-assignments', Yii::$app);
        $filter = Yii::createObject($controller->behaviors()['roleAccessFilter']);
        $action = new \yii\base\Action('test-instructor-courses', $controller);

        $this->expectException(NotFoundHttpException::class);
        $filter->beforeAction($action);
    }

    /**
     * The query-identity action preserves its sandbox response.
     *
     * @return void
     */
    public function testQueryIdentityActionPreservesSandboxLookup()
    {
        Yii::$app->request->setQueryParams(
            [
            'full_name' => 'Synthetic Faculty',
            'internal_id' => '999000003',
            ]
        );
        $controller = new TestCourseAssignmentsController('course-assignments', Yii::$app);

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
        Yii::$app->user->setIdentity(new TestCourseAssignmentsIdentity('Synthetic Faculty', '999000004'));

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
        Yii::$app->user->setIdentity(new TestCourseAssignmentsIdentity('Synthetic Faculty', null));

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
     * Arguments captured by the lookup seam.
     *
     * @var array|null
     */
    public $lookupArguments;

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

/**
 * Test identity with normalized instructor claims.
 */
class TestCourseAssignmentsIdentity implements IdentityInterface
{
    public $fullName;
    public $internalId;

    public function __construct($fullName, $internalId)
    {
        $this->fullName = $fullName;
        $this->internalId = $internalId;
    }

    public static function findIdentity($id)
    {
        return null;
    }

    public static function findIdentityByAccessToken($token, $type = null)
    {
        return null;
    }

    public function getId()
    {
        return null;
    }

    public function getAuthKey()
    {
        return null;
    }

    public function validateAuthKey($authKey)
    {
        return false;
    }
}
