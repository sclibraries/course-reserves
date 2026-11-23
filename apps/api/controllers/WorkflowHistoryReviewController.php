<?php

namespace app\controllers;

use app\components\ApiAccessBehaviors;
use app\components\Roles;
use app\services\ItemHistoryReviewReadService;
use app\services\ItemHistoryReviewService;
use Yii;
use yii\filters\Cors;
use yii\rest\Controller;

/** Staff-only entry point for reviewing flagged new-item history. */
class WorkflowHistoryReviewController extends Controller
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
            'index' => Roles::STAFF,
            'review-item' => Roles::STAFF,
            'review-submission' => Roles::STAFF,
            'options' => Roles::STAFF,
        ]);
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionIndex()
    {
        $result = Yii::$container->get(ItemHistoryReviewReadService::class)->list(
            Yii::$app->request->get('page'),
            Yii::$app->request->get('submission_id')
        );
        return $this->respond($result);
    }

    public function actionReviewItem($id)
    {
        $input = $this->reviewInput();
        $result = Yii::$container->get(ItemHistoryReviewService::class)->review(
            (int)$id,
            $input['actor'],
            $input['reviewer_id'],
            $input['decision'],
            $input['reason']
        );
        return $this->respond($result);
    }

    public function actionReviewSubmission($submission_id)
    {
        $input = $this->reviewInput();
        $result = Yii::$container->get(ItemHistoryReviewService::class)->reviewSubmission(
            (int)$submission_id,
            $input['actor'],
            $input['reviewer_id'],
            $input['decision'],
            $input['reason']
        );
        return $this->respond($result);
    }

    private function reviewInput()
    {
        $identity = Yii::$app->user->identity;
        $body = Yii::$app->request->getBodyParams();
        return [
            'actor' => ['username' => $identity->username ?? (string)$identity->id, 'role' => $identity->role],
            'reviewer_id' => (string)$identity->id,
            'decision' => is_array($body) ? ($body['decision'] ?? null) : null,
            'reason' => is_array($body) ? ($body['reason'] ?? null) : null,
        ];
    }

    private function respond(array $result)
    {
        Yii::$app->response->statusCode = $result['status'];
        return $result['body'];
    }
}
