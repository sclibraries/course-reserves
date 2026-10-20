<?php

namespace tests\unit\controllers;

use app\components\EbscoText;
use app\controllers\EbscoSearchController;
use yii\httpclient\Client;
use yii\caching\ArrayCache;
use yii\filters\auth\HttpBearerAuth;
use yii\web\TooManyRequestsHttpException;

class EbscoSearchControllerTest extends \Codeception\Test\Unit
{
    public function testEbscoTextDecoderHandlesCommonEntities()
    {
        $cases = [
            'Ender&#39;s' => "Ender's",
            '&amp;#39;' => "'",
            '&eacute;' => 'é',
            'Caf&#233;' => 'Café',
            'Tom &amp; Jerry' => 'Tom & Jerry',
            'plain UTF-8 é' => 'plain UTF-8 é',
            'AT&T' => 'AT&T'
        ];

        foreach ($cases as $encoded => $decoded) {
            $this->assertSame($decoded, EbscoText::decode($encoded));
        }
    }

    public function testSearchAndRetrieveDecodeItemAndBibEntityTitles()
    {
        $record = [
            'Items' => [
                ['Label' => 'Title', 'Group' => 'Ti', 'Data' => 'Ender&#39;s Game']
            ],
            'RecordInfo' => [
                'BibRecord' => [
                    'BibEntity' => [
                        'Subjects' => [
                            ['SubjectFull' => 'Ender&#39;s subject', 'Type' => 'topic']
                        ],
                        'Titles' => [
                            ['TitleFull' => 'Ender&#39;s Game', 'Type' => 'main']
                        ]
                    ],
                    'BibRelationships' => [
                        'HasContributorRelationships' => [
                            ['PersonEntity' => ['Name' => ['NameFull' => 'Ender&#39;s author']]]
                        ],
                        'IsPartOfRelationships' => [
                            ['BibEntity' => [
                                'Titles' => [
                                    ['TitleFull' => 'Ender&#39;s journal', 'Type' => 'periodical']
                                ]
                            ]]
                        ]
                    ]
                ]
            ]
        ];
        $controller = new EbscoSearchController('ebsco-search', \Yii::$app);

        $search = $this->invokeMethod($controller, 'processFullSearchResults', [json_encode([
            'SearchResult' => ['Data' => ['Records' => [$record]]]
        ])]);
        $searchRecord = $search['records'][0];

        $retrieve = $this->invokeMethod($controller, 'processRetrieveResults', [json_encode([
            'Record' => $record
        ])]);
        $retrieveRecord = $retrieve['record'];

        foreach ([$searchRecord, $retrieveRecord] as $mappedRecord) {
            $this->assertSame("Ender's Game", $mappedRecord['Items']['Ti'][0]['CleanData']);
            $this->assertSame(
                "Ender's Game",
                $mappedRecord['RecordInfo']['BibEntity']['Titles'][0]['TitleFull']
            );
            $this->assertSame(
                "Ender's subject",
                $mappedRecord['RecordInfo']['BibEntity']['Subjects'][0]['SubjectFull']
            );
            $this->assertSame(
                "Ender's author",
                $mappedRecord['RecordInfo']['BibRelationships']['HasContributorRelationships'][0]['NameFull']
            );
            $this->assertSame(
                "Ender's journal",
                $mappedRecord['RecordInfo']['BibRelationships']['IsPartOfRelationships']['Titles'][0]['TitleFull']
            );
        }
    }

    public function testEbscoProxyRequiresBearerAuthAndRestrictsCorsOrigins()
    {
        $previousOrigins = \Yii::$app->params['corsOrigins'];
        \Yii::$app->params['corsOrigins'] = ['https://app.example.test'];
        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $behaviors = $controller->behaviors();

            $this->assertArrayHasKey('authenticator', $behaviors);
            $this->assertSame(HttpBearerAuth::class, $behaviors['authenticator']['class']);
            $this->assertSame(['options'], $behaviors['authenticator']['except']);

            $origins = $behaviors['corsFilter']['cors']['Origin'];
            $this->assertNotContains('*', $origins);
            $this->assertNotContains('https://libtools2.smith.edu', $origins);
            $this->assertContains('https://app.example.test', $origins);
            $this->assertContains('http://localhost:5174', $origins);
            $this->assertContains('http://127.0.0.1:5174', $origins);
        } finally {
            \Yii::$app->params['corsOrigins'] = $previousOrigins;
        }
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

    public function testMissingProfileReturnsUnavailableBeforeAnyHttpRequest()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        $client = $this->createStubEbscoClient();
        \Yii::$container->setSingleton(Client::class, $client);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => '',
        ];

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $response = $controller->actionSearch('climate change');

            $this->assertSame(0, $client->sendCount);
            $this->assertSame(503, \Yii::$app->response->statusCode);
            $this->assertSame('search_unavailable', $response['error_code']);
            $this->assertSame('Library search is temporarily unavailable.', $response['message']);
            $this->assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/D', $response['reference']);
            $log = $this->lastEbscoLog($logger);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=search', $log);
            $this->assertStringContainsString('step=config', $log);
            $this->assertStringContainsString('EBSCO_PROFILE', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
            \Yii::$container->clear(Client::class);
        }
    }

    public function testSessionFailureReturnsUnavailableWithoutProviderText()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        $client = $this->createStubEbscoClient();
        \Yii::$container->setSingleton(Client::class, $client);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => 'synthetic-profile',
        ];

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $response = $controller->actionSearch('climate change');

            $this->assertSame(2, $client->sendCount);
            $this->assertSame(503, \Yii::$app->response->statusCode);
            $this->assertSame('search_unavailable', $response['error_code']);
            $this->assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/D', $response['reference']);
            $this->assertStringNotContainsString('Profile id missing', json_encode($response));
            $this->assertStringNotContainsString('synthetic-provider-body', json_encode($response));
            $log = $this->lastEbscoLog($logger);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=search', $log);
            $this->assertStringContainsString('step=create session', $log);
            $this->assertStringContainsString('upstream_status=500', $log);
            $this->assertStringContainsString('query="climate change"', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
            \Yii::$container->clear(Client::class);
        }
    }

    public function testAuthenticationFailureLogsTheAuthenticateStep()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        $client = $this->createStubEbscoClient('uidauth');
        \Yii::$container->setSingleton(Client::class, $client);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => 'synthetic-profile',
        ];

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $response = $controller->actionSearch('climate change');

            $this->assertSame(1, $client->sendCount);
            $this->assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/D', $response['reference']);
            $log = $this->lastEbscoLog($logger);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=search', $log);
            $this->assertStringContainsString('step=authenticate', $log);
            $this->assertStringContainsString('upstream_status=500', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
            \Yii::$container->clear(Client::class);
        }
    }

    public function testInvalidQueryRemainsBadRequestBeforeAnyHttpRequest()
    {
        $client = $this->createStubEbscoClient();
        \Yii::$container->setSingleton(Client::class, $client);

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $controller->actionSearch('   ');
            $this->fail('An empty query should be rejected.');
        } catch (\yii\web\BadRequestHttpException $exception) {
            $this->assertSame(400, $exception->statusCode);
            $this->assertSame(0, $client->sendCount);
        } finally {
            \Yii::$container->clear(Client::class);
        }
    }

    public function testRetrieveRejectsMissingIdentifiersBeforeAnyHttpRequest()
    {
        $client = $this->createStubEbscoClient();
        \Yii::$container->setSingleton(Client::class, $client);

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $controller->actionRetrieve('synthetic-db', '');
            $this->fail('A missing accession number should be rejected.');
        } catch (\yii\web\BadRequestHttpException $exception) {
            $this->assertSame(400, $exception->statusCode);
            $this->assertSame(0, $client->sendCount);
        } finally {
            \Yii::$container->clear(Client::class);
        }
    }

    public function testInfoActionUsesSharedConfigurationGuard()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        $client = $this->createStubEbscoClient();
        \Yii::$container->setSingleton(Client::class, $client);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => '',
        ];

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $response = $controller->actionInfo();

            $this->assertSame(0, $client->sendCount);
            $this->assertSame(503, \Yii::$app->response->statusCode);
            $this->assertSame('search_unavailable', $response['error_code']);
            $log = $this->lastEbscoLog($logger);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=info', $log);
            $this->assertStringContainsString('step=config', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
            \Yii::$container->clear(Client::class);
        }
    }

    public function testSearchFailureLogsTheSearchStep()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        $client = $this->createStubEbscoClient('Search');
        \Yii::$container->setSingleton(Client::class, $client);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => 'synthetic-profile',
        ];

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $response = $controller->actionSearch('climate change');

            $log = $this->lastEbscoLog($logger);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=search', $log);
            $this->assertStringContainsString('step=search', $log);
            $this->assertStringContainsString('upstream_status=500', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
            \Yii::$container->clear(Client::class);
        }
    }

    public function testRetrieveFailureLogsTheRetrieveActionAndStep()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        $client = $this->createStubEbscoClient('Retrieve');
        \Yii::$container->setSingleton(Client::class, $client);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => 'synthetic-profile',
        ];

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $response = $controller->actionRetrieve('synthetic-db', 'synthetic-an');

            $log = $this->lastEbscoLog($logger);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=retrieve', $log);
            $this->assertStringContainsString('step=retrieve', $log);
            $this->assertStringContainsString('upstream_status=500', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
            \Yii::$container->clear(Client::class);
        }
    }

    public function testInfoFailureLogsTheInfoStep()
    {
        $previousParams = \Yii::$app->params;
        $previousStatus = \Yii::$app->response->statusCode;
        $previousLogger = \Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        \Yii::setLogger($logger);
        $client = $this->createStubEbscoClient('Info');
        \Yii::$container->setSingleton(Client::class, $client);
        \Yii::$app->params['ebsco'] = [
            'userId' => 'synthetic-user',
            'password' => 'synthetic-password',
            'edsProfile' => 'synthetic-profile',
        ];

        try {
            $controller = new EbscoSearchController('ebsco-search', \Yii::$app);
            $response = $controller->actionInfo();

            $log = $this->lastEbscoLog($logger);
            $this->assertStringStartsWith($response['reference'], $log);
            $this->assertStringContainsString('action=info', $log);
            $this->assertStringContainsString('step=info', $log);
            $this->assertStringContainsString('upstream_status=500', $log);
        } finally {
            \Yii::$app->params = $previousParams;
            \Yii::$app->response->statusCode = $previousStatus;
            \Yii::setLogger($previousLogger);
            \Yii::$container->clear(Client::class);
        }
    }

    private function invokeMethod($object, $methodName, array $arguments = [])
    {
        $reflection = new \ReflectionMethod($object, $methodName);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($object, $arguments);
    }

    private function createStubEbscoClient($failurePath = 'createsession')
    {
        $client = new class extends Client {
            public $sendCount = 0;
            public $failurePath;

            public function send($request)
            {
                $this->sendCount++;
                $url = $request->getUrl();

                if (stripos($url, $this->failurePath) !== false) {
                    return $this->createResponse('synthetic-provider-body: Profile id missing.', ['http-code' => '500']);
                }

                if (strpos($url, 'uidauth') !== false) {
                    return $this->createResponse('', ['http-code' => '200'])
                        ->setData(['AuthToken' => 'synthetic-auth-token']);
                }

                if (strpos($url, 'createsession') !== false) {
                    return $this->createResponse('', ['http-code' => '200'])
                        ->setData(['SessionToken' => 'synthetic-session-token']);
                }

                return $this->createResponse('', ['http-code' => '200']);
            }
        };
        $client->failurePath = $failurePath;

        return $client;
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
