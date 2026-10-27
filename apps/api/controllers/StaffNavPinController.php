<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\services\NavPinService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;
use yii\web\MethodNotAllowedHttpException;

/** Staff-owned navigation pin endpoints and admin defaults. */
class StaffNavPinController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge(['http://localhost:5173', 'http://localhost:5174'], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'PUT', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'index' => ['staff', 'admin'],
            'defaults' => ['admin'],
            'options' => ['staff', 'admin'],
        ]);
    }

    public function actionIndex()
    {
        $service = $this->service();
        $username = $this->username();
        if (Yii::$app->request->isGet) {
            return $this->respond($service->getUserPins($username));
        }
        if (Yii::$app->request->isPut) {
            return $this->respond($service->saveUserPins($username, $this->requestPins()));
        }
        if (Yii::$app->request->isDelete) {
            return $this->respond($service->resetUserPins($username));
        }
        throw new MethodNotAllowedHttpException('Use GET, PUT, or DELETE for staff navigation pins.');
    }

    public function actionDefaults()
    {
        $service = $this->service();
        if (Yii::$app->request->isGet) {
            return $this->respond($service->getDefaults());
        }
        if (Yii::$app->request->isPut) {
            return $this->respond($service->saveDefaults($this->username(), $this->requestPins()));
        }
        throw new MethodNotAllowedHttpException('Use GET or PUT for default navigation pins.');
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    private function requestPins()
    {
        $body = json_decode(Yii::$app->request->getRawBody());
        return $body instanceof \stdClass && property_exists($body, 'pins') ? $body->pins : null;
    }

    private function service()
    {
        return Yii::$container->get(NavPinService::class);
    }

    private function username()
    {
        $identity = Yii::$app->user->identity;
        return (string)($identity->username ?? '');
    }

    private function respond(array $result)
    {
        Yii::$app->response->statusCode = $result['status'];
        return $result['body'];
    }
}
