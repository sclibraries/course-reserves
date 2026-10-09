<?php

namespace app\controllers;

use app\services\SandboxFacultyWorkflowFixture;
use Yii;
use yii\filters\ContentNegotiator;
use yii\filters\Cors;
use yii\web\Controller;
use yii\web\Response;

class SandboxFolioController extends Controller
{
    public $enableCsrfValidation = false;

    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:3001',
                    'http://localhost:5173',
                    'http://localhost:5174',
                    'http://localhost:8080',
                    'http://127.0.0.1:3001',
                    'http://127.0.0.1:5173',
                    'http://127.0.0.1:5174',
                    'http://127.0.0.1:8080',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 86400,
            ],
        ];
        $behaviors['contentNegotiator'] = [
            'class' => ContentNegotiator::class,
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];

        return $behaviors;
    }

    public function actionSearchCourses()
    {
        $fixture = new SandboxFacultyWorkflowFixture();
        $query = Yii::$app->request->get('query');

        return $fixture->getSearchCoursesResponse($query);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
    }
}
