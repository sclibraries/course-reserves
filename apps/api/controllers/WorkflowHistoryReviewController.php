<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use app\services\ItemHistoryReviewService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;

/** Staff-only entry point for resolving one flagged new-item history row. */
class WorkflowHistoryReviewController extends Controller
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
            'review-item' => Roles::STAFF,
            'options' => Roles::STAFF,
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionReviewItem($id)
    {
        $identity = Yii::$app->user->identity;
        $body = Yii::$app->request->getBodyParams();
        $decision = is_array($body) ? ($body['decision'] ?? null) : null;
        $reason = is_array($body) ? ($body['reason'] ?? null) : null;
        $result = Yii::$container->get(ItemHistoryReviewService::class)->review(
            (int)$id,
            ['username' => $identity->username ?? (string)$identity->id, 'role' => $identity->role],
            (string)$identity->id,
            $decision,
            $reason
        );
        return $this->respond($result);
    }

    private function respond(array $result)
    {
        Yii::$app->response->statusCode = $result['status'];
        return $result['body'];
    }
}
