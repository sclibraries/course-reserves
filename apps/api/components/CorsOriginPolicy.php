<?php

namespace app\components;

use Yii;

/** Shared CORS origin policy for preflight and normal responses. */
class CorsOriginPolicy
{
    /**
     * Run CORS before authentication so permitted origins can read error responses too.
     *
     * @param array $behaviors Controller behaviors.
     * @return array
     */
    public static function corsFirst(array $behaviors)
    {
        if (!isset($behaviors['corsFilter'])) {
            return $behaviors;
        }

        $corsFilter = $behaviors['corsFilter'];
        unset($behaviors['corsFilter']);

        return ['corsFilter' => $corsFilter] + $behaviors;
    }

    /**
     * Return local Vite origins plus the configured deployment allowlist.
     *
     * @param array|null $configuredOrigins Configured origins or application parameters when omitted.
     * @return array
     */
    public static function allowedOrigins($configuredOrigins = null)
    {
        if ($configuredOrigins === null) {
            $configuredOrigins = Yii::$app->params['corsOrigins'] ?? [];
        }

        return array_values(array_unique(array_merge([
            'http://localhost:5173',
            'http://localhost:5174',
        ], $configuredOrigins)));
    }

    /**
     * Add the common preflight response headers without reflecting arbitrary origins.
     *
     * @return void
     */
    public static function configurePreflightResponse()
    {
        $response = Yii::$app->response;
        $origin = Yii::$app->request->headers->get('Origin');
        $response->statusCode = 204;

        if (is_string($origin) && in_array($origin, self::allowedOrigins(), true)) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
            $response->headers->set('Access-Control-Allow-Credentials', 'true');
        } else {
            $response->headers->remove('Access-Control-Allow-Origin');
            $response->headers->remove('Access-Control-Allow-Credentials');
        }

        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
        $response->headers->set('Access-Control-Max-Age', '86400');
    }
}
