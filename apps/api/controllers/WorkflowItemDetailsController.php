<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use app\services\SubmissionItemDetailsService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;

/** Staff-only updates to submission item details that may later be published. */
class WorkflowItemDetailsController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge(['http://localhost:5173', 'http://localhost:5174'], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['PUT', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'update' => Roles::STAFF,
            'options' => Roles::STAFF,
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionUpdate($kind, $id)
    {
        $identity = Yii::$app->user->identity;
        $result = Yii::$container->get(SubmissionItemDetailsService::class)->update(
            $kind,
            $id,
            ['username' => $identity->username ?? (string)$identity->id, 'role' => $identity->role],
            Yii::$app->request->getBodyParams()
        );
        Yii::$app->response->statusCode = $result['status'];
        return $result['body'];
    }
}
