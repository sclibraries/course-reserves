<?php

namespace app\controllers;

use yii\rest\ActiveController;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\Cors;

class FolderController extends ActiveController
{
    public $modelClass = 'app\models\Folder';

    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // JWT/Bearer authentication
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            // Allow OPTIONS requests for CORS pre-flight
            'except' => ['options'],
        ];

        // CORS filter
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge([
                    'http://localhost:5173',
                ], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
                'Access-Control-Expose-Headers' => [],
            ],
        ];

        return $behaviors;
    }

    public function actions()
    {
        $actions = parent::actions();
        
        // Disable pagination to return all folders
        $actions['index']['prepareDataProvider'] = function () {
            return new \yii\data\ActiveDataProvider([
                'query' => $this->modelClass::find(),
                'pagination' => false,
            ]);
        };
        
        return $actions;
    }
    
    public function actionOptions() {
        // Provide OPTIONS response for CORS preflight
        \Yii::$app->response->headers->set('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
}
