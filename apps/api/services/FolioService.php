<?php
namespace app\services;

use app\components\FolioAvailabilityMapper;
use Yii;
use yii\httpclient\Client;

/**
 * Lightweight client for querying the middleware FOLIO search endpoint.
 */
class FolioService
{
    /** @var string */
    private $baseUrl;
    /** @var string */
    private $searchBaseUrl;
    /** @var int */
    private $timeoutSeconds;

    public function __construct($baseUrl = null)
    {
        $folioParams = Yii::$app->params['folio'];
        $this->searchBaseUrl = rtrim($folioParams['searchBaseUrl'], '/');
        $this->baseUrl = rtrim($baseUrl ?: $this->searchBaseUrl . '/search-courses', '/');
        $this->timeoutSeconds = (int)$folioParams['timeoutSeconds'];
    }

    /**
     * Retrieve a course payload by its FOLIO identifier.
     *
     * @param string $courseId
     * @return array
     * @throws \RuntimeException when the middleware reports an error or missing record
     */
    public function fetchCourseById($courseId)
    {
        if (!$courseId) {
            throw new \RuntimeException('FOLIO_MISSING_COURSE_ID');
        }

        $url    = $this->baseUrl . '?query=(id==' . rawurlencode($courseId) . ')';

        $response = $this->sendGet($url);

        if (!$response->isOk) {
            throw new \RuntimeException('FOLIO_HTTP_' . $response->statusCode);
        }

        $data = $response->getData();
        if (!$data) {
            throw new \RuntimeException('FOLIO_EMPTY_RESPONSE');
        }

        // Expected shape:
        // [
        //   'message' => 'success',
        //   'code'    => 200,
        //   'data'    => [
        //       'courses'      => [ ... ],
        //       'totalRecords' => 1
        //   ]
        // ]
        if (!isset($data['data']['courses']) || !is_array($data['data']['courses'])) {
            throw new \RuntimeException('FOLIO_MALFORMED_RESPONSE');
        }

        $courses = $data['data']['courses'];
        if (empty($courses)) {
            throw new \RuntimeException('FOLIO_COURSE_NOT_FOUND');
        }

        $course = $courses[0];

        if (empty($course['id'])) {
            throw new \RuntimeException('FOLIO_COURSE_NOT_FOUND');
        }

        return $course;
    }

    /**
     * Retrieve the available FOLIO terms.
     *
     * @return array
     */
    public function searchTerms()
    {
        try {
            return $this->searchTermsStrict();
        } catch (\Exception $e) {
            Yii::error('Error fetching FOLIO terms: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Retrieve terms and preserve upstream failures for workflows that must distinguish errors.
     *
     * @return array
     * @throws \RuntimeException when FOLIO returns an error or malformed payload
     */
    public function searchTermsStrict()
    {
        $response = $this->sendGet($this->searchBaseUrl . '/search-terms');
        if (!$response->isOk) {
            throw new \RuntimeException('FOLIO_HTTP_' . $response->statusCode);
        }

        $data = $response->getData();
        if (!isset($data['data']['terms']) || !is_array($data['data']['terms'])) {
            throw new \RuntimeException('FOLIO_MALFORMED_TERMS_RESPONSE');
        }

        return $data['data']['terms'];
    }

    /**
     * Search FOLIO courses with the supplied query.
     *
     * @param string $query FOLIO search expression.
     * @return array|null
     */
    public function searchCourses($query)
    {
        try {
            return $this->searchCoursesStrict($query);
        } catch (\Exception $e) {
            Yii::error('Error fetching FOLIO course: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Search courses and throw on upstream or response errors.
     *
     * @param string $query FOLIO search expression.
     * @return array|null
     * @throws \RuntimeException when FOLIO returns an error or malformed payload
     */
    public function searchCoursesStrict($query)
    {
        $response = $this->sendGet($this->baseUrl, ['query' => $query]);
        if (!$response->isOk) {
            throw new \RuntimeException('FOLIO_HTTP_' . $response->statusCode);
        }

        $data = $response->getData();
        if (!isset($data['data']['courses']) || !is_array($data['data']['courses'])) {
            throw new \RuntimeException('FOLIO_MALFORMED_COURSES_RESPONSE');
        }

        $courses = $data['data']['courses'];
        if (empty($courses)) {
            return null;
        }
        return count($courses) === 1 ? $courses[0] : $courses;
    }

    /**
     * Fetch holdings for instance ids in parallel and return only public copy fields.
     *
     * @param array $instanceIds
     * @return array Instance id to copies or a generic per-id failure.
     */
    public function fetchAvailability(array $instanceIds)
    {
        $instanceIds = array_values(array_unique(array_filter($instanceIds, 'is_string')));
        if (empty($instanceIds)) {
            return [];
        }

        $client = $this->createClient();
        $requests = [];
        foreach ($instanceIds as $instanceId) {
            $requests[$instanceId] = $this->createGetRequest(
                $client,
                $this->searchBaseUrl . '/search-rtac',
                ['id' => $instanceId]
            );
        }

        try {
            $responses = $client->batchSend($requests);
        } catch (\Throwable $exception) {
            $results = [];
            foreach ($instanceIds as $instanceId) {
                $results[$instanceId] = $this->availabilityFailure($instanceId, 0);
            }
            return $results;
        }

        $results = [];
        foreach ($instanceIds as $instanceId) {
            $response = isset($responses[$instanceId]) ? $responses[$instanceId] : null;
            $status = $response ? (int)$response->statusCode : 0;
            if ($status === 404) {
                $results[$instanceId] = [];
                continue;
            }
            if (!$response || !$response->isOk) {
                $results[$instanceId] = $this->availabilityFailure($instanceId, $status);
                continue;
            }

            $data = $response->getData();
            if (!isset($data['data']['holding']) || !is_array($data['data']['holding'])) {
                $results[$instanceId] = $this->availabilityFailure($instanceId, $status);
                continue;
            }

            $results[$instanceId] = FolioAvailabilityMapper::copiesFromHoldings($data['data']['holding']);
        }

        return $results;
    }

    /**
     * @param string $instanceId
     * @param int $status
     * @return array
     */
    private function availabilityFailure($instanceId, $status)
    {
        $reference = Yii::$app->security->generateRandomString(12);
        Yii::error('FOLIO availability failed: status=' . $status . ' id=' . $instanceId
            . ' reference=' . $reference);
        return ['error' => true, 'reference' => $reference];
    }

    /**
     * Create the HTTP client used for FOLIO requests.
     *
     * @return Client
     */
    protected function createClient()
    {
        return new Client(['transport' => 'yii\\httpclient\\CurlTransport']);
    }

    /**
     * Send a timed JSON GET request to FOLIO.
     *
     * @param string $url Request URL.
     * @param array|null $data GET query parameters.
     * @return \yii\httpclient\Response
     */
    private function sendGet($url, $data = null)
    {
        $client = $this->createClient();
        return $this->createGetRequest($client, $url, $data)->send();
    }

    /**
     * Build a timed JSON GET request shared by single and batched FOLIO calls.
     *
     * @param Client $client
     * @param string $url
     * @param array|null $data
     * @return \yii\httpclient\Request
     */
    private function createGetRequest(Client $client, $url, $data = null)
    {
        $request = $client->createRequest()
            ->setMethod('GET')
            ->setUrl($url)
            ->setOptions(['timeout' => $this->timeoutSeconds])
            ->addHeaders(['Accept' => 'application/json']);

        if ($data !== null) {
            $request->setData($data);
        }

        return $request;
    }

    /**
     * Extract commonly used identifiers from the course payload.
     *
     * @param array $course
     * @return array
     */
    public function extractIds($course)
    {
        return [
            'course_id'         => isset($course['id']) ? $course['id'] : null,
            'course_listing_id' => isset($course['courseListingId']) ? $course['courseListingId'] : null,
            'term_id'           => isset($course['courseListingObject']['termId']) ? $course['courseListingObject']['termId'] : null,
            'department_id'     => isset($course['departmentId']) ? $course['departmentId'] : null,
            'course_number'     => isset($course['courseNumber']) ? $course['courseNumber'] : null,
            'name'              => isset($course['name']) ? trim($course['name']) : '',
        ];
    }
}
