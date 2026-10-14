<?php

namespace app\filters;

use app\components\Environment;
use Yii;
use yii\base\ActionFilter;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;

class MockLoginAccessFilter extends ActionFilter
{
    public function beforeAction($action)
    {
        if ($action->id !== 'mock-login') {
            return parent::beforeAction($action);
        }

        if (!Environment::allowsTestFixtures()) {
            throw new NotFoundHttpException('Page not found.');
        }

        $role = Yii::$app->request->post('role', 'faculty');
        if (!in_array($role, ['faculty', 'staff'], true)) {
            throw new BadRequestHttpException('role must be faculty or staff.');
        }

        return true;
    }
}
