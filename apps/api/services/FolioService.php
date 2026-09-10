<?php
namespace app\services;

use yii\httpclient\Client;

/**
 * Lightweight client for querying the middleware FOLIO search endpoint.
 */
class FolioService
{
    /** @var string */
    private $baseUrl;

    public function __construct($baseUrl = null)
    {
        $this->baseUrl = $baseUrl ?: 'https://libtools2.smith.edu/folio/web/search/search-courses';
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

        $client = new Client(['transport' => 'yii\\httpclient\\CurlTransport']);
        $url    = $this->baseUrl . '?query=(id==' . rawurlencode($courseId) . ')';

        $response = $client->get($url)
            ->addHeaders(['Accept' => 'application/json'])
            ->send();

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
