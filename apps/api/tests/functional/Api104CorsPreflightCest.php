<?php

/**
 * Cross-origin preflights use a side-effect-free route and share one origin allowlist.
 */
class Api104CorsPreflightCest extends BaseFunctionalCest
{
    private $devOrigin = 'http://localhost:5173';
    private $originalUrlManager;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->originalUrlManager = \Yii::$app->get('urlManager');

        // The functional app uses config/test.php, which omits production pretty URL rules.
        $webConfig = require codecept_root_dir('config/web.php');
        $urlManagerConfig = $webConfig['components']['urlManager'];
        $urlManagerConfig['class'] = \yii\web\UrlManager::class;
        \Yii::$app->set('urlManager', $urlManagerConfig);
        \Yii::$app->urlManager->showScriptName = false;
    }

    public function _after(FunctionalTester $I)
    {
        if ($this->originalUrlManager !== null) {
            \Yii::$app->set('urlManager', $this->originalUrlManager);
            $this->originalUrlManager = null;
        }
    }

    public function frontendRoutesAcceptUnauthenticatedPreflights(FunctionalTester $I)
    {
        $routes = [
            ['/course/1620/resources', 'GET'],
            ['/physical-resource/cleanup-references', 'POST'],
            ['/physical-resource/by-external-id/test-api104-reference', 'GET'],
            ['/physical-resource/get-references?offering_id=1620', 'GET'],
            ['/physical-resource/update-resource-order', 'POST'],
            ['/course-assignments/instructor-courses', 'GET'],
            ['/offering-link/link-existing-resources', 'GET'],
        ];

        foreach ($routes as $route) {
            $status = $I->sendCorsRequest(
                'OPTIONS',
                $route[0],
                $this->devOrigin,
                $route[1],
                'Authorization, Content-Type, X-Requested-With'
            );
            $this->assertPreflightResponse($I, $status, $this->devOrigin, $route[0]);
        }
    }

    public function preflightAndRealResponsesUseTheSameOriginAllowlist(FunctionalTester $I)
    {
        $previousOrigins = \Yii::$app->params['corsOrigins'] ?? null;
        $allowedOrigin = 'https://api104.example.test';
        \Yii::$app->params['corsOrigins'] = [$allowedOrigin];

        try {
            $status = $I->sendCorsRequest(
                'OPTIONS',
                '/physical-resource/cleanup-references',
                $allowedOrigin,
                'POST',
                'Authorization, Content-Type, X-Requested-With'
            );
            $this->assertPreflightResponse($I, $status, $allowedOrigin, '/physical-resource/cleanup-references');

            $status = $I->sendCorsRequest(
                'OPTIONS',
                '/physical-resource/cleanup-references',
                'https://not-allowed.example.test',
                'POST',
                'Authorization, Content-Type, X-Requested-With'
            );
            $this->assertPreflightResponse(
                $I,
                $status,
                null,
                '/physical-resource/cleanup-references'
            );

            $status = $I->sendCorsRequest(
                'GET',
                '/physical-resource/by-external-id/test-api104-reference',
                $allowedOrigin
            );
            \PHPUnit\Framework\Assert::assertSame(401, $status, 'The real request must still require authentication.');
            \PHPUnit\Framework\Assert::assertSame(
                $allowedOrigin,
                \Yii::$app->response->headers->get('Access-Control-Allow-Origin')
            );

            $status = $I->sendCorsRequest(
                'GET',
                '/physical-resource/by-external-id/test-api104-reference',
                'https://not-allowed.example.test'
            );
            \PHPUnit\Framework\Assert::assertSame(401, $status, 'A rejected Origin must not bypass authentication.');
            \PHPUnit\Framework\Assert::assertNull(
                \Yii::$app->response->headers->get('Access-Control-Allow-Origin')
            );
        } finally {
            if ($previousOrigins === null) {
                unset(\Yii::$app->params['corsOrigins']);
            } else {
                \Yii::$app->params['corsOrigins'] = $previousOrigins;
            }
        }
    }

    private function assertPreflightResponse(FunctionalTester $I, $status, $allowedOrigin, $path)
    {
        \PHPUnit\Framework\Assert::assertGreaterThanOrEqual(200, $status, 'OPTIONS ' . $path);
        \PHPUnit\Framework\Assert::assertLessThan(300, $status, 'OPTIONS ' . $path);
        \PHPUnit\Framework\Assert::assertSame(
            'cors-preflight/options',
            \Yii::$app->requestedRoute,
            'OPTIONS ' . $path . ' must use the side-effect-free preflight route.'
        );
        \PHPUnit\Framework\Assert::assertSame(
            $allowedOrigin,
            \Yii::$app->response->headers->get('Access-Control-Allow-Origin'),
            'OPTIONS ' . $path . ' should only allow an approved origin.'
        );
        \PHPUnit\Framework\Assert::assertSame(
            'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
            \Yii::$app->response->headers->get('Access-Control-Allow-Methods')
        );
        \PHPUnit\Framework\Assert::assertSame(
            'Authorization, Content-Type, X-Requested-With',
            \Yii::$app->response->headers->get('Access-Control-Allow-Headers')
        );
        \PHPUnit\Framework\Assert::assertSame(
            $allowedOrigin === null ? null : 'true',
            \Yii::$app->response->headers->get('Access-Control-Allow-Credentials')
        );
        \PHPUnit\Framework\Assert::assertSame(
            '86400',
            \Yii::$app->response->headers->get('Access-Control-Max-Age')
        );
        \PHPUnit\Framework\Assert::assertNull(\Yii::$app->response->headers->get('WWW-Authenticate'));
        \PHPUnit\Framework\Assert::assertNull(\Yii::$app->response->data, 'Preflight must not run a business action.');
    }
}
