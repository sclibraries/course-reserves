<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\ContentNegotiator;
use yii\web\Response;
use app\models\JwtIdentity;

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
                'Origin' => [
                    'https://libtools2.smith.edu',
                    'http://localhost:3001',
                    'http://localhost:5173',
                    'http://localhost:5174',
                    'http://127.0.0.1:3001',
                    'http://127.0.0.1:5173',
                    'http://127.0.0.1:5174',
                    'http://localhost:8080',
                ],
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

        return $behaviors;
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
            if (in_array($identity->role, ['staff', 'admin'])) {
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
        $response = Yii::$app->response;
        $origin   = Yii::$app->request->headers->get('Origin') ?? '*';

        $response->statusCode = 204;
        $response->headers->set('Access-Control-Allow-Origin',      $origin);
        $response->headers->set('Access-Control-Allow-Methods',     'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers',     'Authorization, Content-Type, X-Requested-With');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');
        $response->headers->set('Access-Control-Max-Age',           '86400');
        Yii::$app->end();
    }
}
