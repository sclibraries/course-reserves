<?php

namespace yii\web {
    function setcookie()
    {
        $GLOBALS['cx037CapturedCookies'][] = func_get_args();
        return true;
    }
}

namespace {

if (getenv('API_TEST_DEPRECATIONS') === '1') {
    require_once __DIR__ . '/../_support/deprecation-handler.php';
}

defined('YII_ENV') or define('YII_ENV', 'test');
require_once __DIR__ . '/../../config/environment.php';
require_once __DIR__ . '/../../vendor/yiisoft/yii2/Yii.php';

class Cx037CapturingResponse extends \yii\web\Response
{
    public function sendCookiesForTest()
    {
        $this->sendCookies();
    }
}

$GLOBALS['cx037CapturedCookies'] = [];

new \yii\web\Application([
    'id' => 'cx037-cookie-compatibility',
    'basePath' => dirname(__DIR__, 2),
    'components' => [
        'request' => [
            'class' => \yii\web\Request::class,
            'cookieValidationKey' => 'synthetic-cx037-cookie-key',
        ],
        'response' => [
            'class' => Cx037CapturingResponse::class,
        ],
    ],
]);

$response = \Yii::$app->response;
$response->cookies->add(new \yii\web\Cookie([
    'name' => 'accessToken',
    'value' => 'synthetic-access-token',
    'expire' => 0,
    'sameSite' => \yii\web\Cookie::SAME_SITE_STRICT,
]));
$response->sendCookiesForTest();

$session = new \yii\web\Session();
$session->setCookieParams([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => false,
    'httponly' => true,
    'sameSite' => \yii\web\Cookie::SAME_SITE_LAX,
]);
$setSessionCookieParams = new \ReflectionMethod(\yii\web\Session::class, 'setCookieParamsInternal');
$setSessionCookieParams->setAccessible(true);
$setSessionCookieParams->invoke($session);

echo json_encode([
    'responseCookies' => $GLOBALS['cx037CapturedCookies'],
    'sessionCookieParams' => session_get_cookie_params(),
]);
}
