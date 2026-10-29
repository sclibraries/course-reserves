<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use app\services\StaffEnteredSubmissionService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;

/** Staff-only endpoint for creating a submitted request from a syllabus. */
class StaffEnteredSubmissionController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['POST', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'create' => Roles::STAFF,
            'options' => Roles::STAFF,
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionCreate()
    {
        $result = Yii::$container->get(StaffEnteredSubmissionService::class)->create(
            $this->actor(),
            Yii::$app->request->getBodyParams()
        );
        Yii::$app->response->statusCode = $result['status_code'];
        return $result['body'];
    }

    private function actor()
    {
        $identity = Yii::$app->user->identity;
        $userId = (string)($identity->id ?? $identity->username);
        return [
            'user_id' => $userId,
            'username' => $identity->username ?? $userId,
            'role' => $identity->role,
            'display_name' => $identity->fullName ?? null,
            'email' => $identity->email ?? null,
            'institution' => $identity->institution ?? null,
        ];
    }
}
