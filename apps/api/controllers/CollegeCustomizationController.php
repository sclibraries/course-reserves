<?php

namespace app\controllers;

use yii\rest\ActiveController;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\Cors;
use yii\web\NotFoundHttpException;
use yii\web\ServerErrorHttpException;
use Yii;
use app\models\CollegeCustomization;

class CollegeCustomizationController extends ActiveController
{
    public $modelClass = CollegeCustomization::class;

    public function behaviors()
    {
        $behaviors = parent::behaviors();

        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options', 'index', 'view'],
        ];

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
            ],
        ];

        return $behaviors;
    }

    public function actionOptions($id = null) 
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        if ($id !== null) {
            Yii::$app->response->headers->set('Allow', 'GET, PUT, PATCH, DELETE, OPTIONS');
        } else {
            Yii::$app->response->headers->set('Allow', 'GET, POST, OPTIONS');
        }
        return;
    }

    /**
     * Lists all college customizations.
     */
    public function actionIndex()
    {
        Yii::$app->response->format = \yii\web\Response::FORMAT_JSON;
        return CollegeCustomization::find()->all();
    }

    /**
     * View a single customization.
     */
    public function actionView($id)
    {
        return $this->findModel($id);
    }

    /**
     * Create a new customization.
     */
    public function actionCreate()
    {
        $model = new CollegeCustomization();
        $model->load(Yii::$app->request->post(), '');

        if ($model->validate() && $model->save()) {
            Yii::$app->response->statusCode = 201;
            return $model;
        }

        Yii::$app->response->statusCode = 422;
        return ['errors' => $model->errors];
    }

    /**
     * Update existing customization.
     */
    public function actionUpdate($id)
    {
        $model = $this->findModel($id);
        $model->load(Yii::$app->request->post(), '');

        if ($model->validate() && $model->save()) {
            return $model;
        }

        Yii::$app->response->statusCode = 422;
        return ['errors' => $model->errors];
    }

    /**
     * Delete a customization.
     */
    public function actionDelete($id)
    {
        $model = $this->findModel($id);

        if ($model->delete() === false) {
            throw new ServerErrorHttpException('Failed to delete the customization.');
        }

        Yii::$app->response->statusCode = 204;
    }

    /**
     * Finds the CollegeCustomization model based on its primary key value.
     * @param integer $id
     * @return CollegeCustomization
     * @throws NotFoundHttpException if the model cannot be found
     */
    protected function findModel($id)
    {
        $model = CollegeCustomization::findOne($id);
        if ($model !== null) {
            return $model;
        }

        throw new NotFoundHttpException("Customization with ID: $id not found.");
    }
}
