<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\services\StaffGroupService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;
use yii\web\MethodNotAllowedHttpException;

/** Staff group queues and admin-only group membership endpoints. */
class WorkflowGroupController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge(['http://localhost:5173', 'http://localhost:5174'], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        return ApiAccessBehaviors::withRoleRules($behaviors, [
            'my-groups' => ['staff', 'admin'],
            'group-queue' => ['staff', 'admin'],
            'groups' => ['staff', 'admin'],
            'admin-groups' => ['admin'],
            'admin-group' => ['admin'],
            'admin-group-members' => ['admin'],
            'admin-group-member' => ['admin'],
            'options' => ['staff', 'admin'],
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionMyGroups()
    {
        return $this->respond($this->service()->myGroups($this->actor()['username']));
    }

    public function actionGroupQueue($id)
    {
        return $this->respond($this->service()->groupQueue($id, $this->actor()['username']));
    }

    public function actionGroups()
    {
        return $this->respond($this->service()->groupOptions());
    }

    public function actionAdminGroups()
    {
        if (Yii::$app->request->isGet) {
            return $this->respond($this->service()->adminGroups());
        }
        if (Yii::$app->request->isPost) {
            return $this->respond($this->service()->createGroup(Yii::$app->request->getBodyParams(), $this->actor()));
        }
        throw new MethodNotAllowedHttpException('Use GET or POST for workflow/admin/groups.');
    }

    public function actionAdminGroup($id)
    {
        if (Yii::$app->request->isPut) {
            return $this->respond($this->service()->updateGroup($id, Yii::$app->request->getBodyParams(), $this->actor()));
        }
        if (Yii::$app->request->isDelete) {
            return $this->respond($this->service()->deleteGroup($id, $this->actor()));
        }
        throw new MethodNotAllowedHttpException('Use PUT or DELETE for a workflow group.');
    }

    public function actionAdminGroupMembers($id)
    {
        if (Yii::$app->request->isGet) {
            return $this->respond($this->service()->members($id));
        }
        if (Yii::$app->request->isPost) {
            $body = Yii::$app->request->getBodyParams();
            return $this->respond($this->service()->addMember($id, $body['username'] ?? '', $this->actor()));
        }
        throw new MethodNotAllowedHttpException('Use GET or POST for workflow group members.');
    }

    public function actionAdminGroupMember($id, $username)
    {
        if (!Yii::$app->request->isDelete) {
            throw new MethodNotAllowedHttpException('Use DELETE to remove a workflow group member.');
        }
        return $this->respond($this->service()->removeMember($id, $username, $this->actor()));
    }

    private function service()
    {
        return Yii::$container->get(StaffGroupService::class);
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
