<?php

/**
 * Cross-origin preflights use a side-effect-free route and share one origin allowlist.
 */
class Api104CorsPreflightCest extends BaseFunctionalCest
{
    private $devOrigin = 'http://localhost:5173';

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
            $status = $I->sendCorsRequest('OPTIONS', $route[0], $this->devOrigin, $route[1], 'authorization,content-type');
            \PHPUnit\Framework\Assert::assertSame(204, $status, 'OPTIONS ' . $route[0]);
            \PHPUnit\Framework\Assert::assertSame(
                $this->devOrigin,
                \Yii::$app->response->headers->get('Access-Control-Allow-Origin'),
                'OPTIONS ' . $route[0] . ' should allow the configured dev origin.'
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
                'true',
                \Yii::$app->response->headers->get('Access-Control-Allow-Credentials')
            );
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
                'authorization,content-type'
            );
            \PHPUnit\Framework\Assert::assertSame(204, $status);
            \PHPUnit\Framework\Assert::assertSame(
                $allowedOrigin,
                \Yii::$app->response->headers->get('Access-Control-Allow-Origin')
            );

            $status = $I->sendCorsRequest(
                'OPTIONS',
                '/physical-resource/cleanup-references',
                'https://not-allowed.example.test',
                'POST',
                'authorization,content-type'
            );
            \PHPUnit\Framework\Assert::assertSame(204, $status);
            \PHPUnit\Framework\Assert::assertNull(
                \Yii::$app->response->headers->get('Access-Control-Allow-Origin')
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
}
