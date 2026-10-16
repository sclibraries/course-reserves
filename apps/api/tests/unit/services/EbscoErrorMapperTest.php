<?php

namespace tests\unit\services;

use app\services\EbscoConfig;
use app\services\EbscoErrorMapper;

class EbscoErrorMapperTest extends \Codeception\Test\Unit
{
    public function testFailureReturnsReferenceAndLogsProviderDetailsWithTruncatedQuery()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => 'synthetic-profile',
        ];
        $query = str_repeat('climate ', 40);
        $body = json_encode([
            'ErrorNumber' => '114',
            'ErrorDescription' => 'Required Data missing.',
            'DetailedErrorDescription' => 'Profile id missing. eds-api.ebscohost.com UserId=synthetic-user Password=synthetic-password AuthToken=synthetic-auth-token SessionToken=synthetic-session x-authenticationToken=synthetic-auth-token x-sessionToken=synthetic-session eyJhbGciOiJub25lIn0.c2lnbmF0dXJl.c2lnbmF0dXJl',
        ]);

        try {
            $response = EbscoErrorMapper::mapFailure(
                new \Exception($body, 503),
                ['synthetic-auth-token', 'synthetic-session'],
                ['action' => 'search', 'step' => 'create session', 'query' => $query]
            );

            $this->assertSame(503, \Yii::$app->response->statusCode);
            $this->assertSame('search_unavailable', $response['error_code']);
            $this->assertSame('Library search is temporarily unavailable.', $response['message']);
            $this->assertStringNotContainsString('Profile id missing', json_encode($response));
            $this->assertStringNotContainsString('synthetic-auth-token', json_encode($response));
            $this->assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/D', $response['reference']);

            $log = $this->lastEbscoLog($logger);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=search', $log);
            $this->assertStringContainsString('step=create session', $log);
            $this->assertStringContainsString('upstream_status=503', $log);
            $this->assertStringContainsString('ErrorNumber', $log);
            $this->assertStringContainsString('114', $log);
            $this->assertStringContainsString('ErrorDescription', $log);
            $this->assertStringContainsString('Required Data missing.', $log);
            $this->assertStringContainsString('eds-api.ebscohost.com', $log);
            $this->assertStringContainsString('query="' . rtrim(substr($query, 0, 200)) . '"', $log);
            $this->assertStringNotContainsString('synthetic-user', $log);
            $this->assertStringNotContainsString('synthetic-password', $log);
            $this->assertStringNotContainsString('synthetic-auth-token', $log);
            $this->assertStringNotContainsString('synthetic-session', $log);
            $this->assertStringNotContainsString('eyJhbGciOiJub25lIn0.c2lnbmF0dXJl.c2lnbmF0dXJl', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
        }
    }

    public function testMissingConfigurationLogsTheSettingNameWithoutSecretValues()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => '',
        ];

        try {
            try {
                EbscoConfig::assertConfigured();
                $this->fail('Missing EBSCO_PROFILE should stop the request.');
            } catch (\RuntimeException $exception) {
                $response = EbscoErrorMapper::mapFailure(
                    $exception,
                    [],
                    ['action' => 'info', 'step' => 'config']
                );
            }

            $log = $this->lastEbscoLog($logger);
            $this->assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/D', $response['reference']);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=info', $log);
            $this->assertStringContainsString('step=config', $log);
            $this->assertStringContainsString('EBSCO_PROFILE', $log);
            $this->assertStringNotContainsString('synthetic-user', $log);
            $this->assertStringNotContainsString('synthetic-password', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
        }
    }

    public function testConfigurationGuardRequiresEveryCredential()
    {
        $previousParams = \Yii::$app->params;
        $settings = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => 'synthetic-profile',
        ];
        $settingNames = [
            'userId' => 'EBSCO_USER_ID',
            'password' => 'EBSCO_PASSWORD',
            'edsProfile' => 'EBSCO_PROFILE',
        ];

        try {
            foreach ($settingNames as $key => $settingName) {
                $missingSettings = $settings;
                $missingSettings[$key] = '';
                \Yii::$app->params['ebsco'] = $missingSettings;

                try {
                    EbscoConfig::assertConfigured();
                    $this->fail($settingName . ' should be required.');
                } catch (\RuntimeException $exception) {
                    $this->assertSame('Missing EBSCO setting: ' . $settingName, $exception->getMessage());
                }
            }
        } finally {
            \Yii::$app->params = $previousParams;
        }
    }

    private function lastEbscoLog($logger)
    {
        $messages = $logger->messages;
        for ($index = count($messages) - 1; $index >= 0; $index--) {
            if ($messages[$index][2] === 'ebsco') {
                return $messages[$index][0];
            }
        }

        $this->fail('Expected an EBSCO failure log entry.');
    }
}
