<?php

namespace tests\unit\filters;

use app\filters\MockLoginAccessFilter;
use yii\base\Action;
use yii\base\Controller;
use yii\web\BadRequestHttpException;

class MockLoginAccessFilterTest extends \Codeception\Test\Unit
{
    public function testMockLoginRejectsAdminRoleBeforeTokenIssuance()
    {
        $request = \Yii::$app->request;
        $originalParams = $request->getBodyParams();
        $request->setBodyParams(['role' => 'admin']);
        $controller = new class('faculty-submission', \Yii::$app) extends Controller {};
        $action = new Action('mock-login', $controller);

        try {
            $this->expectException(BadRequestHttpException::class);
            (new MockLoginAccessFilter())->beforeAction($action);
        } finally {
            $request->setBodyParams($originalParams);
        }
    }

    public function testMockLoginAllowsFacultyAndStaffRoles()
    {
        $request = \Yii::$app->request;
        $originalParams = $request->getBodyParams();
        $controller = new class('faculty-submission', \Yii::$app) extends Controller {};
        $filter = new MockLoginAccessFilter();

        try {
            foreach (['faculty', 'staff'] as $role) {
                $request->setBodyParams(['role' => $role]);
                $this->assertTrue($filter->beforeAction(new Action('mock-login', $controller)));
            }
        } finally {
            $request->setBodyParams($originalParams);
        }
    }
}
