<?php

namespace app\controllers;

use app\components\CorsOriginPolicy;
use yii\web\Controller;
use yii\web\MethodNotAllowedHttpException;

/** Side-effect-free target for preflights without an endpoint-specific OPTIONS route. */
class CorsPreflightController extends Controller
{
    public function actionOptions($path = null)
    {
        if (\Yii::$app->request->method !== 'OPTIONS') {
            throw new MethodNotAllowedHttpException();
        }

        CorsOriginPolicy::configurePreflightResponse();
        return null;
    }
}
