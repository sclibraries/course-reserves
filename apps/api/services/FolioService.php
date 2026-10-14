<?php
namespace app\services;

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

        if ($courseId === SandboxFacultyWorkflowFixture::FOLIO_COURSE_ID ||
            $courseId === SandboxFacultyWorkflowFixture::FOLIO_COURSE_LISTING_ID
        ) {
            return (new SandboxFacultyWorkflowFixture())->getFolioCourse();
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
            $response = $this->sendGet($this->searchBaseUrl . '/search-terms');
            if ($response->isOk && isset($response->data['data']['terms'])) {
                return $response->data['data']['terms'];
            }

            Yii::warning('Failed to fetch FOLIO terms: ' . $response->content);
            return [];
        } catch (\Exception $e) {
            Yii::error('Error fetching FOLIO terms: ' . $e->getMessage());
            return [];
        }
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
            $response = $this->sendGet($this->baseUrl, ['query' => $query]);
            if ($response->isOk && isset($response->data['data']['courses'])) {
                $courses = $response->data['data']['courses'];
                if (empty($courses)) {
                    return null;
                }
                return count($courses) === 1 ? $courses[0] : $courses;
            }

            Yii::warning('Failed to fetch FOLIO course: ' . $response->content);
            return null;
        } catch (\Exception $e) {
            Yii::error('Error fetching FOLIO course: ' . $e->getMessage());
            return null;
        }
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
        $request = $this->createClient()->createRequest()
            ->setMethod('GET')
            ->setUrl($url)
            ->setOptions(['timeout' => $this->timeoutSeconds])
            ->addHeaders(['Accept' => 'application/json']);

        if ($data !== null) {
            $request->setData($data);
        }

        return $request->send();
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
