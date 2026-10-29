<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\ContentNegotiator;
use yii\web\Response;
use app\models\JwtIdentity;
use app\components\Roles;
use app\components\CorsOriginPolicy;

/**
 * Base controller for all REST endpoints.
 *
 * Provides:
 * - Centralised CORS configuration
 * - HttpBearerAuth wired to JwtIdentity (no DB lookup; works for both
 *   faculty tokens and staff tokens)
 * - Populates Yii::$app->params['facultyUser'] from the authenticated
 *   identity so child controllers can call $this->getFacultyUser()
 */
class BaseRestController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // CORS must be declared first so preflight OPTIONS requests are
        // handled before the authenticator rejects them.
        $behaviors['corsFilter'] = [
            'class' => \yii\filters\Cors::class,
            'cors' => [
                'Origin' => CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method'  => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 86400,
            ],
        ];

        $behaviors['contentNegotiator'] = [
            'class' => ContentNegotiator::class,
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];

        $behaviors['authenticator'] = [
            'class'  => HttpBearerAuth::class,
            'except' => ['options'],
        ];

        return CorsOriginPolicy::corsFirst($behaviors);
    }

    public function beforeAction($action)
    {
        if (Yii::$app->request->method === 'OPTIONS') {
            $this->sendCorsPreflightResponse();
        }

        if (!parent::beforeAction($action)) {
            return false;
        }

        // After HttpBearerAuth has set the identity, expose its claims as
        // the conventional facultyUser/staffUser params so all child
        // controllers can use $this->getFacultyUser() unchanged.
        $identity = Yii::$app->user->identity;
        if ($identity instanceof JwtIdentity) {
            $userParams = [
                'user_id'      => $identity->username,
                'display_name' => $identity->fullName,
                'email'        => $identity->email,
                'institution'  => $identity->institution,
                'role'         => $identity->role,
            ];
            Yii::$app->params['facultyUser'] = $userParams;
            if (Roles::isStaff($identity->role)) {
                Yii::$app->params['staffUser'] = $userParams;
            }
        }

        return true;
    }

    /**
     * Send a 204 CORS pre-flight response and halt the request lifecycle.
     * Called before the authenticator runs so OPTIONS is never blocked by auth.
     */
    private function sendCorsPreflightResponse()
    {
        CorsOriginPolicy::configurePreflightResponse();
        Yii::$app->end();
    }
}
