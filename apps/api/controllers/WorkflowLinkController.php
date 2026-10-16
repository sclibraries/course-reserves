<?php

namespace app\controllers;

use Yii;
use app\components\Roles;
use app\filters\RoleAccessFilter;
use app\services\SubmissionLinkService;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\ContentNegotiator;
use yii\filters\Cors;
use yii\rest\Controller;
use yii\web\Response;

/** Staff endpoints for linking a faculty submission to its authoritative FOLIO course. */
class WorkflowLinkController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['contentNegotiator'] = [
            'class' => ContentNegotiator::class,
            'formats' => ['application/json' => Response::FORMAT_JSON],
        ];
        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => ['options'],
        ];
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => array_merge(['http://localhost:5173', 'http://localhost:5174'], Yii::$app->params['corsOrigins'] ?? []),
                'Access-Control-Request-Method' => ['GET', 'POST', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 86400,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
            ],
        ];
        $staffActions = [
            'candidates', 'link', 'correct', 'link-override', 'unlink', 'timeline', 'options',
        ];
        $rules = [];
        foreach ($staffActions as $action) {
            $rules[$action] = Roles::STAFF;
        }
        $behaviors['roleAccess'] = [
            'class' => RoleAccessFilter::class,
            'rules' => $rules,
        ];
        return $behaviors;
    }

    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    public function actionCandidates($uuid)
    {
        return $this->service()->candidates($uuid, Yii::$app->request->get('query'));
    }

    public function actionTimeline($uuid)
    {
        return $this->service()->timeline($uuid);
    }

    public function actionLink($uuid)
    {
        $body = Yii::$app->request->getBodyParams();
        return $this->respond($this->service()->link($uuid, $body['folio_course_listing_id'] ?? null, $this->actor()));
    }

    public function actionCorrect($uuid)
    {
        return $this->respond($this->service()->correct($uuid, Yii::$app->request->getBodyParams(), $this->actor()));
    }

    public function actionLinkOverride($uuid)
    {
        $body = Yii::$app->request->getBodyParams();
        return $this->respond($this->service()->override(
            $uuid,
            $body['folio_course_listing_id'] ?? null,
            $body['reason'] ?? null,
            $this->actor()
        ));
    }

    public function actionUnlink($uuid)
    {
        $body = Yii::$app->request->getBodyParams();
        return $this->respond($this->service()->unlink($uuid, $body['reason'] ?? null, $this->actor()));
    }

    private function service()
    {
        return Yii::$container->get(SubmissionLinkService::class);
    }

    private function actor()
    {
        $identity = Yii::$app->user->identity;
        return [
            'username' => $identity->username ?? (string)$identity->id,
            'role' => $identity->role,
        ];
    }

    private function respond(array $result)
    {
        Yii::$app->response->statusCode = $result['status'];
        return $result['body'];
    }
}
