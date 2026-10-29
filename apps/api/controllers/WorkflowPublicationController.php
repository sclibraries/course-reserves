<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use app\services\SubmissionPublicationStateService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;

/** Staff-only item publication readiness and policy contract; destination writes remain disabled. */
class WorkflowPublicationController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['GET', 'POST', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'state' => Roles::STAFF,
            'projection' => Roles::STAFF,
            'ready' => Roles::STAFF,
            'options' => Roles::STAFF,
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionState($kind, $id)
    {
        return $this->respond($this->service()->contract($kind, $id, $this->actor()));
    }

    public function actionProjection($kind, $id)
    {
        return $this->respond(Yii::$container->get(\app\services\SubmissionInputProjectionService::class)
            ->project($kind, $id));
    }

    public function actionReady($kind, $id)
    {
        $body = Yii::$app->request->getBodyParams();
        return $this->respond($this->service()->markReady($kind, $id, $this->actor(), $body['reason'] ?? null));
    }

    private function service()
    {
        return Yii::$container->get(SubmissionPublicationStateService::class);
    }

    private function actor()
    {
        $identity = Yii::$app->user->identity;
        return ['username' => $identity->username ?? (string)$identity->id, 'role' => $identity->role];
    }

    private function respond(array $result)
    {
        Yii::$app->response->statusCode = $result['status'];
        return $result['body'];
    }
}
