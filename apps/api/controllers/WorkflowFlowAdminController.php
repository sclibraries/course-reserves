<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\services\FlowAdminService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;
use yii\web\MethodNotAllowedHttpException;

/** Admin-only flow definitions and material type mapping. */
class WorkflowFlowAdminController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'flows' => ['admin'],
            'flow' => ['admin'],
            'versions' => ['admin'],
            'mapping' => ['admin'],
            'access-path-mapping' => ['admin'],
            'options' => ['admin'],
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionFlows()
    {
        $service = $this->service();
        if (Yii::$app->request->isGet) {
            return $service->picker();
        }
        if (Yii::$app->request->isPost) {
            return $this->respond($service->createFlow(Yii::$app->request->getBodyParams(), $this->actor()));
        }
        throw new MethodNotAllowedHttpException('Use GET or POST for workflow flows.');
    }

    public function actionFlow($id)
    {
        if (Yii::$app->request->isGet) {
            return $this->respond($this->service()->getFlow($id));
        }
        if (Yii::$app->request->isPut) {
            return $this->respond($this->service()->updateFlow($id, Yii::$app->request->getBodyParams(), $this->actor()));
        }
        if (Yii::$app->request->isDelete) {
            return $this->respond($this->service()->deleteFlow($id, $this->actor()));
        }
        throw new MethodNotAllowedHttpException('Use GET, PUT, or DELETE for a workflow flow.');
    }

    public function actionVersions($id)
    {
        if (!Yii::$app->request->isPost) {
            throw new MethodNotAllowedHttpException('Use POST to create a workflow flow version.');
        }
        return $this->respond($this->service()->createVersion($id, Yii::$app->request->getBodyParams(), $this->actor()));
    }

    public function actionMapping()
    {
        if (Yii::$app->request->isGet) {
            return $this->service()->getMapping();
        }
        if (Yii::$app->request->isPut) {
            return $this->respond($this->service()->putMapping(Yii::$app->request->getBodyParams(), $this->actor()));
        }
        throw new MethodNotAllowedHttpException('Use GET or PUT for the flow mapping.');
    }

    public function actionAccessPathMapping()
    {
        $service = Yii::$container->get(\app\services\AccessPathMappingService::class);
        if (Yii::$app->request->isGet) {
            return $service->getMapping();
        }
        if (Yii::$app->request->isPut) {
            return $this->respond($service->putMapping(Yii::$app->request->getBodyParams(), $this->actor()));
        }
        throw new MethodNotAllowedHttpException('Use GET or PUT for the access path mapping.');
    }

    private function service()
    {
        return Yii::$container->get(FlowAdminService::class);
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
