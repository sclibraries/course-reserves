<?php

namespace tests\unit\services;

use app\services\FolioService;
use Yii;
use yii\httpclient\Client;
use yii\httpclient\Transport;

require_once codecept_root_dir('services/FolioService.php');

class FolioServiceTest extends \Codeception\Test\Unit
{
    private $previousParams;

    protected function _before()
    {
        $this->previousParams = Yii::$app->params;
    }

    protected function _after()
    {
        Yii::$app->params = $this->previousParams;
    }

    public function testSearchUsesConfiguredBaseAndTimeout()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 3,
        ];

        $transport = new RecordingFolioTransport();
        $transport->responses = [
            [
                'status' => 200,
                'data' => ['data' => ['terms' => [['id' => 'test-term']]]],
            ],
            [
                'status' => 200,
                'data' => ['data' => ['courses' => [['id' => 'test-course']]]],
            ],
        ];
        $service = new TestableFolioService($transport);

        $terms = $service->searchTerms();
        $courses = $service->searchCourses('(courseNumber=="TST 101") sortby name');

        $this->assertSame([['id' => 'test-term']], $terms);
        $this->assertSame(['id' => 'test-course'], $courses);
        $this->assertSame(
            [
                'https://folio.example.test/api/search/search-terms',
                'https://folio.example.test/api/search/search-courses?query=%28courseNumber%3D%3D%22TST+101%22%29+sortby+name',
            ],
            array_column($transport->requests, 'url')
        );
        $this->assertSame([3, 3], array_column(array_column($transport->requests, 'options'), 'timeout'));
    }

    public function testCourseLookupKeepsConstructorUrlAndAppliesConfiguredTimeout()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 4,
        ];

        $transport = new RecordingFolioTransport();
        $transport->responses = [
            [
                'status' => 200,
                'data' => ['data' => ['courses' => [['id' => 'test-course']]]],
            ],
        ];
        $service = new TestableFolioService($transport, 'https://legacy.example.test/custom/search-courses');

        $course = $service->fetchCourseById('test-course');

        $this->assertSame(['id' => 'test-course'], $course);
        $this->assertSame(
            'https://legacy.example.test/custom/search-courses?query=(id==test-course)',
            $transport->requests[0]['url']
        );
        $this->assertSame(4, $transport->requests[0]['options']['timeout']);
    }

    public function testNonOkSearchResponsesReturnEmptyTermsAndNullCourses()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 5,
        ];

        $transport = new RecordingFolioTransport();
        $transport->responses = [
            ['status' => 503, 'data' => ['message' => 'unavailable']],
            ['status' => 503, 'data' => ['message' => 'unavailable']],
        ];
        $service = new TestableFolioService($transport);

        $this->assertSame([], $service->searchTerms());
        $this->assertNull($service->searchCourses('(courseNumber=="TST 101")'));
    }

    public function testStrictCourseSearchPreservesFolioFailures()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 5,
        ];
        $transport = new RecordingFolioTransport();
        $transport->responses = [
            ['status' => 503, 'data' => ['message' => 'unavailable']],
        ];
        $service = new TestableFolioService($transport);

        $this->expectException(\RuntimeException::class);
        $service->searchCoursesStrict('(courseNumber=="TST 101")');
    }

    public function testStrictTermSearchPreservesMalformedResponses()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 5,
        ];
        $transport = new RecordingFolioTransport();
        $transport->responses = [
            ['status' => 200, 'data' => ['data' => ['unexpected' => []]]],
        ];
        $service = new TestableFolioService($transport);

        $this->expectException(\RuntimeException::class);
        $service->searchTermsStrict();
    }

    public function testFetchAvailabilityUsesBatchedTimedRtacRequests()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 8,
        ];
        $ids = [
            '00000000-0000-4000-8000-000000000881',
            '00000000-0000-4000-8000-000000000882',
        ];
        $transport = new RecordingFolioTransport();
        $transport->responses = [
            ['status' => 200, 'data' => ['data' => ['instanceId' => $ids[0], 'holding' => []]]],
            ['status' => 200, 'data' => ['data' => ['instanceId' => $ids[1], 'holding' => []]]],
        ];
        $service = new TestableFolioService($transport);

        $this->assertSame([$ids[0] => [], $ids[1] => []], $service->fetchAvailability($ids));
        $this->assertSame(1, $transport->batchCalls);
        $this->assertSame([
            'https://folio.example.test/api/search/search-rtac?id=' . $ids[0],
            'https://folio.example.test/api/search/search-rtac?id=' . $ids[1],
        ], array_column($transport->requests, 'url'));
        $this->assertSame([8, 8], array_column(array_column($transport->requests, 'options'), 'timeout'));
    }

    public function testFetchAvailabilityDropsSuppressedCopiesAndMapsOnlyPublicFields()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 5,
        ];
        $id = '00000000-0000-4000-8000-000000000881';
        $transport = new RecordingFolioTransport();
        $transport->responses = [[
            'status' => 200,
            'data' => ['data' => [
                'instanceId' => $id,
                'holding' => [
                    [
                        'id' => 'synthetic-item-1',
                        'barcode' => 'SYNTHETIC-BARCODE-1',
                        'location' => 'Smith College Neilson Stacks',
                        'locationId' => 'synthetic-location-id',
                        'status' => 'Available',
                        'permanentLoanType' => 'Standard Loan',
                        'suppressFromDiscovery' => 'false',
                        'library' => ['name' => 'SC Neilson Library'],
                        'callNumber' => 'QA 100 .T47',
                        'totalHoldRequests' => '0',
                    ],
                    [
                        'id' => 'synthetic-hidden-item',
                        'barcode' => 'SYNTHETIC-HIDDEN-BARCODE',
                        'location' => 'Hidden synthetic location',
                        'status' => 'Available',
                        'permanentLoanType' => 'Standard Loan',
                        'suppressFromDiscovery' => 'true',
                        'library' => ['name' => 'SC Neilson Library'],
                        'callNumber' => 'QA 101 .T47',
                    ],
                    [
                        'id' => 'synthetic-item-2',
                        'barcode' => 'SYNTHETIC-BARCODE-2',
                        'location' => 'Mount Holyoke College Main Stacks',
                        'status' => 'Checked out',
                        'permanentLoanType' => 'Library Use Only',
                        'suppressFromDiscovery' => 'false',
                        'library' => ['name' => 'Mount Holyoke College Library'],
                        'callNumber' => 'QA 102 .T47',
                    ],
                ],
            ]],
        ]];
        $service = new TestableFolioService($transport);

        $this->assertSame([
            [
                'library' => 'SC Neilson Library',
                'location' => 'Smith College Neilson Stacks',
                'callNumber' => 'QA 100 .T47',
                'status' => 'Available',
                'loanType' => 'Standard Loan',
            ],
            [
                'library' => 'Mount Holyoke College Library',
                'location' => 'Mount Holyoke College Main Stacks',
                'callNumber' => 'QA 102 .T47',
                'status' => 'Checked out',
                'loanType' => 'Library Use Only',
            ],
        ], $service->fetchAvailability([$id])[$id]);
    }

    public function testFetchAvailabilityTreatsNotFoundAsEmptyCopies()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 5,
        ];
        $id = '00000000-0000-4000-8000-000000000884';
        $transport = new RecordingFolioTransport();
        $transport->responses = [[
            'status' => 404,
            'data' => ['message' => 'not found', 'code' => 404, 'data' => null],
        ]];
        $service = new TestableFolioService($transport);

        $this->assertSame([$id => []], $service->fetchAvailability([$id]));
    }

    public function testFetchAvailabilityIsolatesFailuresAndLogsAReferenceWithoutReturningBody()
    {
        Yii::$app->params['folio'] = [
            'searchBaseUrl' => 'https://folio.example.test/api/search',
            'timeoutSeconds' => 5,
        ];
        $goodId = '00000000-0000-4000-8000-000000000881';
        $failedId = '00000000-0000-4000-8000-000000000882';
        $transport = new RecordingFolioTransport();
        $transport->responses = [
            ['status' => 200, 'data' => ['data' => ['instanceId' => $goodId, 'holding' => []]]],
            ['status' => 503, 'data' => ['message' => 'synthetic upstream response body']],
        ];
        $service = new TestableFolioService($transport);
        $originalLogger = Yii::getLogger();
        $logger = new \yii\log\Logger();
        $logger->flushInterval = 0;
        Yii::setLogger($logger);
        try {
            $results = $service->fetchAvailability([$goodId, $failedId]);
            $messages = $logger->messages;
        } finally {
            Yii::setLogger($originalLogger);
        }

        $this->assertSame([], $results[$goodId]);
        $this->assertTrue($results[$failedId]['error']);
        $this->assertNotEmpty($results[$failedId]['reference']);
        $this->assertStringNotContainsString('synthetic upstream response body', json_encode($results[$failedId]));
        $errors = array_values(array_filter($messages, function ($message) {
            return $message[1] === \yii\log\Logger::LEVEL_ERROR;
        }));
        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('503', $errors[0][0]);
        $this->assertStringContainsString($failedId, $errors[0][0]);
        $this->assertStringContainsString($results[$failedId]['reference'], $errors[0][0]);
    }
}

class TestableFolioService extends FolioService
{
    private $transport;

    public function __construct($transport, $baseUrl = null)
    {
        $this->transport = $transport;
        parent::__construct($baseUrl);
    }

    protected function createClient()
    {
        return new Client(['transport' => $this->transport]);
    }
}

class RecordingFolioTransport extends Transport
{
    public $batchCalls = 0;
    public $requests = [];
    public $responses = [];

    public function batchSend(array $requests)
    {
        $this->batchCalls++;
        return parent::batchSend($requests);
    }

    public function send($request)
    {
        $request->prepare();
        $this->requests[] = [
            'url' => $request->getFullUrl(),
            'options' => $request->getOptions(),
        ];

        $response = array_shift($this->responses);
        $httpResponse = $request->client->createResponse('', ['http-code' => $response['status']]);
        $httpResponse->setData($response['data']);

        return $httpResponse;
    }
}
