<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use app\services\FlowRunner;
use app\services\FlowAdminService;
use Yii;
use yii\filters\Cors;

/** Staff item-flow actions and the flow picker. */
class WorkflowFlowController extends \yii\rest\Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge(['http://localhost:5173', 'http://localhost:5174'], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'item-flow' => Roles::STAFF,
            'step-result' => Roles::STAFF,
            'switch-flow' => Roles::STAFF,
            'access-path' => Roles::STAFF,
            'flows' => Roles::STAFF,
            'options' => Roles::STAFF,
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionItemFlow($kind, $id)
    {
        return $this->respond($this->runner()->getItemFlow($kind, $id, $this->actor()));
    }

    public function actionStepResult($kind, $id)
    {
        return $this->respond($this->runner()->stepResult($kind, $id, $this->actor(), Yii::$app->request->getBodyParams()));
    }

    public function actionSwitchFlow($kind, $id)
    {
        return $this->respond($this->runner()->switchFlow($kind, $id, $this->actor(), Yii::$app->request->getBodyParams()));
    }

    public function actionAccessPath($kind, $id)
    {
        return $this->respond($this->runner()->setAccessPath($kind, $id, $this->actor(), Yii::$app->request->getBodyParams()));
    }

    public function actionFlows()
    {
        return Yii::$container->get(FlowAdminService::class)->picker();
    }

    private function runner()
    {
        return Yii::$container->get(FlowRunner::class);
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
