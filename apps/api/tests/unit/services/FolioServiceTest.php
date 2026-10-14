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
    public $requests = [];
    public $responses = [];

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
