<?php
/**
 * DevAuthController.php
 *
 * Development-only auth endpoint that issues JWTs exactly as
 * authorize-local.php does, but runs inside the Yii2 framework so it
 * participates in CORS filters, logging, and error handling.
 *
 * The very first thing actionLogin() does is throw a ForbiddenHttpException
 * when YII_ENV !== 'dev', so this controller is completely inert in staging
 * or production even if deployed by mistake.
 *
 * URL (routed via web.php):  POST /dev-auth/login
 *
 * PHP 7.2 compatible — no typed properties, no arrow functions, no ??=.
 */

namespace app\controllers;

use app\components\Environment;
use Yii;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use Firebase\JWT\JWT;

class DevAuthController extends Controller
{
    /** Disable CSRF validation — this is a JSON API endpoint. */
    public $enableCsrfValidation = false;

    const SECONDS_PER_HOUR = 3600;
    const SECONDS_PER_DAY  = 86400;

    /**
     * Allow CORS pre-flight and the login action without a session.
     *
     * {@inheritdoc}
     */
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        $behaviors['corsFilter'] = [
            'class' => \yii\filters\Cors::class,
            'cors' => [
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method'  => ['POST', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => self::SECONDS_PER_DAY,
            ],
        ];

        return \app\components\CorsOriginPolicy::corsFirst($behaviors);
    }

    /**
     * Issues a dev JWT for the requested username.
     * Immediately throws ForbiddenHttpException in any non-dev environment.
     *
     * @return array|string
     */
    public function actionLogin()
    {
        if (!Environment::isDev()) {
            throw new ForbiddenHttpException('This endpoint is only available in the development environment.');
        }

        $request  = Yii::$app->request;
        $response = Yii::$app->response;
        $response->format = \yii\web\Response::FORMAT_JSON;

        if ($request->isOptions) {
            $response->statusCode = 200;
            return '';
        }

        $devUsername = $this->resolveDevUsername($request);

        try {
            $userInfo = $this->findApprovedUser($devUsername);
        } catch (\Exception $e) {
            $response->statusCode = 500;
            return ['error' => 'Database error: ' . $e->getMessage()];
        }

        if (!$userInfo) {
            $response->statusCode = 404;
            return [
                'error' => "Dev user '{$devUsername}' not found or not approved.",
                'hint'  => 'Run the DB seed or set DEV_USERNAME to an existing approved username.',
            ];
        }

        $issuedAt          = time();
        $accessExpiration  = $issuedAt + self::SECONDS_PER_HOUR;
        $refreshExpiration = $issuedAt + self::SECONDS_PER_DAY;

        $basePayload  = $this->buildBasePayload($issuedAt, $userInfo);
        $accessToken  = JWT::encode(array_merge($basePayload, ['exp' => $accessExpiration]),  getenv('JWT_SECRET_KEY'),         'HS256');
        $refreshToken = JWT::encode(array_merge($basePayload, ['exp' => $refreshExpiration]), getenv('JWT_REFRESH_SECRET_KEY'), 'HS256');

        $this->setRefreshCookie($refreshToken, $refreshExpiration);

        return [
            'access_token'  => $accessToken,
            'refresh_token' => $refreshToken,
            'expires_in'    => self::SECONDS_PER_HOUR,
        ];
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Prefer the POST 'username' field; fall back to DEV_USERNAME env var or 'devadmin'.
     */
    private function resolveDevUsername($request)
    {
        $posted = $request->post('username', '');
        return $posted !== '' ? $posted : (getenv('DEV_USERNAME') ?: 'devadmin');
    }

    /**
     * Return the approved users row for $username, or false if not found.
     *
     * @throws \Exception on DB error
     */
    private function findApprovedUser($username)
    {
        return Yii::$app->db->createCommand("
            SELECT id, username, full_name, email, role, department, institution, approved
            FROM   users
            WHERE  username = :u AND approved = 1
            LIMIT  1
        ")->bindValue(':u', $username)->queryOne();
    }

    /**
     * Build the common JWT claims shared by both the access and refresh tokens.
     */
    private function buildBasePayload($issuedAt, array $userInfo)
    {
        return [
            'iat'         => $issuedAt,
            'username'    => $userInfo['username'],
            'role'        => $userInfo['role'],
            'id'          => $userInfo['id'],
            'full_name'   => $userInfo['full_name'],
            'email'       => $userInfo['email'],
            'institution' => $userInfo['institution'],
        ];
    }

    /**
     * Set the refresh-token cookie for localhost (HTTP, not Secure, not HttpOnly).
     */
    private function setRefreshCookie($token, $expiry)
    {
        setcookie(
            'refreshToken',
            $token,
            $expiry,
            '/',
            '',     // empty domain = current host
            false,  // not Secure — HTTP on localhost
            false   // not HttpOnly — React reads it to send the Authorization header
        );
    }
}
