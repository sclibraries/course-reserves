<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use app\services\ItemClaimService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;

/** Staff-only routes for unified new and reused item claims. */
class WorkflowClaimController extends Controller
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
            'queue' => Roles::STAFF,
            'my-items' => Roles::STAFF,
            'staff' => Roles::STAFF,
            'claim' => Roles::STAFF,
            'release' => Roles::STAFF,
            'handoff' => Roles::STAFF,
            'takeover' => Roles::STAFF,
            'timeline' => Roles::STAFF,
            'claim-all' => Roles::STAFF,
            'options' => Roles::STAFF,
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionQueue()
    {
        return $this->service()->queue(Yii::$app->request->get('term'), Yii::$app->request->get('type'), Yii::$app->request->get('page', 1));
    }

    public function actionMyItems()
    {
        return $this->service()->myItems($this->actor()['username']);
    }

    public function actionStaff()
    {
        return $this->service()->staff(Yii::$app->request->get('q'));
    }

    public function actionClaim($kind, $id)
    {
        return $this->respond($this->service()->claim($kind, $id, $this->actor()));
    }

    public function actionRelease($kind, $id)
    {
        $body = Yii::$app->request->getBodyParams();
        return $this->respond($this->service()->release($kind, $id, $this->actor(), $body['reason'] ?? null));
    }

    public function actionHandoff($kind, $id)
    {
        $body = Yii::$app->request->getBodyParams();
        return $this->respond($this->service()->handoff($kind, $id, $body['to_username'] ?? '', $this->actor(), $body['reason'] ?? null));
    }

    public function actionTakeover($kind, $id)
    {
        $body = Yii::$app->request->getBodyParams();
        return $this->respond($this->service()->takeover($kind, $id, $this->actor(), $body['reason'] ?? null));
    }

    public function actionTimeline($kind, $id)
    {
        return $this->respond($this->service()->timeline($kind, $id));
    }

    public function actionClaimAll($uuid)
    {
        return $this->respond($this->service()->claimAll($uuid, $this->actor()));
    }

    private function service()
    {
        return Yii::$container->get(ItemClaimService::class);
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
