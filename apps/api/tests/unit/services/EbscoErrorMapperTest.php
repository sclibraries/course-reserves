<?php

namespace tests\unit\services;

use app\services\EbscoErrorMapper;
use yii\httpclient\Client;
use yii\web\BadRequestHttpException;

class EbscoErrorMapperTest extends \Codeception\Test\Unit
{
    public function testMissingConfigurationMapsToUnavailableWithoutSendingRequest()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $client = new class extends Client {
            public $sendCount = 0;

            public function send($request)
            {
                $this->sendCount++;

                return $this->createResponse('', ['http-code' => '200']);
            }
        };
        \Yii::$container->setSingleton(Client::class, $client);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => '',
        ];

        try {
            try {
                EbscoErrorMapper::assertConfigured();
                $client->createRequest()->send();
                $this->fail('Missing EBSCO_PROFILE should stop the request.');
            } catch (\RuntimeException $exception) {
                $response = EbscoErrorMapper::mapFailure($exception);
            }

            $this->assertSame(0, $client->sendCount);
            $this->assertSame(503, \Yii::$app->response->statusCode);
            $this->assertSame([
                'error_code' => 'search_unavailable',
                'message' => 'Library search is temporarily unavailable.',
            ], $response);
            $this->assertSame('Missing EBSCO setting: EBSCO_PROFILE', $exception->getMessage());
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::$container->clear(Client::class);
        }
    }

    public function testUpstreamFailureMapsToSafeUnavailableResponse()
    {
        $previousStatus = \Yii::$app->response->statusCode;

        try {
            $response = EbscoErrorMapper::mapFailure(new \Exception(
                'Session creation failed: Profile id missing. synthetic-token=do-not-return'
            ));

            $this->assertSame(503, \Yii::$app->response->statusCode);
            $this->assertSame([
                'error_code' => 'search_unavailable',
                'message' => 'Library search is temporarily unavailable.',
            ], $response);
            $this->assertStringNotContainsString('Profile id missing', json_encode($response));
            $this->assertStringNotContainsString('synthetic-token', json_encode($response));
        } finally {
            \Yii::$app->response->statusCode = $previousStatus;
        }
    }

    public function testEveryRequiredCredentialIsCheckedBeforeARequest()
    {
        $previousParams = \Yii::$app->params;
        $settings = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => 'synthetic-profile',
        ];
        $missingSettings = [
            'userId' => 'EBSCO_USER_ID',
            'password' => 'EBSCO_PASSWORD',
            'edsProfile' => 'EBSCO_PROFILE',
        ];

        try {
            foreach ($missingSettings as $key => $settingName) {
                $settings[$key] = '';
                \Yii::$app->params['ebsco'] = $settings;
                try {
                    EbscoErrorMapper::assertConfigured();
                    $this->fail($settingName . ' should be required.');
                } catch (\RuntimeException $exception) {
                    $this->assertSame('Missing EBSCO setting: ' . $settingName, $exception->getMessage());
                }
                $settings[$key] = 'synthetic-value';
            }
        } finally {
            \Yii::$app->params = $previousParams;
        }
    }

    public function testSensitiveDetailsAreRedactedBeforeFailureIsLogged()
    {
        $reflection = new \ReflectionMethod(EbscoErrorMapper::class, 'redact');
        $reflection->setAccessible(true);
        $message = $reflection->invoke(null,
            'Session failed: Profile id missing. {"AuthToken":"synthetic-token","Password":"synthetic-password","UserId":"synthetic-user"}',
            ['synthetic-user', 'synthetic-password', 'synthetic-token']
        );

        $this->assertStringContainsString('Profile id missing', $message);
        $this->assertStringNotContainsString('synthetic-token', $message);
        $this->assertStringNotContainsString('synthetic-password', $message);
        $this->assertStringNotContainsString('synthetic-user', $message);
    }

    public function testEmptySearchQueryRemainsBadRequest()
    {
        $this->expectException(BadRequestHttpException::class);

        EbscoErrorMapper::createSearchClient('   ');
    }

    public function testMissingRetrieveIdentifiersRemainBadRequest()
    {
        $this->expectException(BadRequestHttpException::class);

        EbscoErrorMapper::createRetrieveClient('dbid', '');
    }
}
