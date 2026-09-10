<?php

namespace tests\unit\controllers;

use app\controllers\EbscoSearchController;
use yii\caching\ArrayCache;
use yii\filters\auth\HttpBearerAuth;
use yii\web\TooManyRequestsHttpException;

class EbscoSearchControllerTest extends \Codeception\Test\Unit
{
    public function testEbscoProxyRequiresBearerAuthAndRestrictsCorsOrigins()
    {
        $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
        $behaviors = $controller->behaviors();

        $this->assertArrayHasKey('authenticator', $behaviors);
        $this->assertSame(HttpBearerAuth::class, $behaviors['authenticator']['class']);
        $this->assertSame(['options'], $behaviors['authenticator']['except']);

        $origins = $behaviors['corsFilter']['cors']['Origin'];
        $this->assertNotContains('*', $origins);
        $this->assertContains('https://libtools2.smith.edu', $origins);
        $this->assertContains('http://localhost:5174', $origins);
        $this->assertContains('http://127.0.0.1:5174', $origins);
    }

    public function testEbscoProxyShortCircuitsCorsPreflightBeforeAuth()
    {
        $source = file_get_contents(codecept_root_dir('controllers/EbscoSearchController.php'));

        $preflightPosition = strpos($source, "Yii::\$app->request->method === 'OPTIONS'");
        $parentBeforeActionPosition = strpos($source, 'parent::beforeAction($action)');

        $this->assertNotFalse($preflightPosition);
        $this->assertNotFalse($parentBeforeActionPosition);
        $this->assertLessThan($parentBeforeActionPosition, $preflightPosition);
        $this->assertStringContainsString("Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With'", $source);
    }

    public function testEbscoProxyDefinesRequestThrottle()
    {
        $controller = new EbscoSearchController('ebsco-search', \Yii::$app);

        $this->assertSame(60, $this->invokeMethod($controller, 'getProxyRateLimit'));
        $this->assertSame(60, $this->invokeMethod($controller, 'getProxyRateWindowSeconds'));
    }

    public function testEbscoProxyRejectsRequestsPastThrottleLimit()
    {
        \Yii::$app->set('cache', [
            'class' => ArrayCache::class,
        ]);

        $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
        $cacheKey = $this->invokeMethod($controller, 'getProxyRateLimitKey');
        \Yii::$app->cache->delete($cacheKey);

        for ($requestNumber = 0; $requestNumber < 60; $requestNumber++) {
            $this->invokeMethod($controller, 'enforceProxyRateLimit');
        }

        $this->expectException(TooManyRequestsHttpException::class);

        try {
            $this->invokeMethod($controller, 'enforceProxyRateLimit');
        } finally {
            \Yii::$app->cache->delete($cacheKey);
        }
    }

    public function testSessionUsesTheConfiguredProviderProfile()
    {
        $previous = \Yii::$app->params;
        \Yii::$app->params['ebsco']['edsProfile'] = 'synthetic-profile';
        $client = new class extends \yii\httpclient\Client {
            public $sentData;
            public function send($request)
            {
                $this->sentData = $request->getData();
                return $this->createResponse('', ['http-code' => '200'])->setData(['SessionToken' => 'synthetic-session']);
            }
        };
        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $this->invokeMethod($controller, 'createSession', [$client]);
            $this->assertSame('synthetic-profile', $client->sentData['Profile']);
        } finally {
            \Yii::$app->params = $previous;
        }
    }

    private function invokeMethod($object, $methodName, array $arguments = [])
    {
        $reflection = new \ReflectionMethod($object, $methodName);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($object, $arguments);
    }
}
