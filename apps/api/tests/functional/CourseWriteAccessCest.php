<?php

/**
 * Course, offering, resource, and folder writes require staff authorization.
 */
class CourseWriteAccessCest extends BaseFunctionalCest
{
    private $facultyToken;
    private $staffToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);

        $this->facultyToken = $this->requestToken(
            'http://localhost/faculty-submission/mock-login',
            ['full_name' => 'Synthetic Faculty', 'role' => 'faculty'],
            'token'
        );
        $this->staffToken = $this->requestToken(
            'http://localhost/faculty-submission/mock-login',
            ['full_name' => 'Synthetic Staff', 'role' => 'staff'],
            'token'
        );
    }

    /**
     * Every live write rejects anonymous and faculty callers while allowing staff through.
     *
     * @param FunctionalTester $I Functional test actor.
     * @return void
     */
    public function courseAndResourceWritesRequireStaffAuthorization(FunctionalTester $I)
    {
        $requests = [
            ['course create', 'POST', 'course/create', [], []],
            ['course update', 'PUT', 'course/update', [], ['id' => 2147483647]],
            ['course delete', 'DELETE', 'course/delete', [], ['id' => 2147483647]],
            ['course check-course-exists', 'POST', 'course/check-course-exists', [], []],
            ['course create-from-folio', 'POST', 'course/create-from-folio', [], []],
            ['course reactivate-course', 'POST', 'course/reactivate-course', [], []],
            ['course link-course-offering', 'POST', 'course/link-course-offering', [], []],
            ['course update-resource-order', 'POST', 'course/update-resource-order', [], []],
            ['course create-resource', 'POST', 'course/create-resource', [], []],
            ['course link-resource', 'POST', 'course/link-resource', [], []],
            ['course unlink-resource', 'POST', 'course/unlink-resource', [], []],
            ['resource create', 'POST', 'resource/create', [], []],
            ['resource update', 'PUT', 'resource/update', [], ['id' => 2147483647]],
            ['resource delete', 'DELETE', 'resource/delete', [], ['id' => 2147483647]],
            ['resource add-link', 'POST', 'resource/add-link', [], ['resourceId' => 2147483647]],
            ['resource delete-link', 'DELETE', 'resource/delete-link', [], ['id' => 2147483647]],
            ['offering-link create', 'POST', 'offering-link/create', [], []],
            ['offering-link update', 'PUT', 'offering-link/update', [], ['id' => 2147483647]],
            ['offering-link delete', 'DELETE', 'offering-link/delete', [], ['id' => 2147483647]],
            [
                'offering-link link-existing-resources',
                'GET',
                'offering-link/link-existing-resources',
                [],
                ['offering_id' => 2147483647, 'resource_id' => 2147483647],
            ],
            ['offering-link update-resource-order', 'POST', 'offering-link/update-resource-order', [], []],
            [
                'physical-resource create-or-update-reference',
                'POST',
                'physical-resource/create-or-update-reference',
                [
                    'external_resource_id' => 'test-api055-missing-reference',
                    'offering_id' => 2147483647,
                ],
                [],
            ],
            ['physical-resource update-resource-order', 'POST', 'physical-resource/update-resource-order', [], []],
            ['physical-resource cleanup-references', 'POST', 'physical-resource/cleanup-references', [], []],
            ['folder create', 'POST', 'folder/create', [], []],
            ['folder update', 'PUT', 'folder/update', [], ['id' => 2147483647]],
            ['folder delete', 'DELETE', 'folder/delete', [], ['id' => 2147483647]],
        ];

        $results = [];
        foreach ($requests as $request) {
            list($name, $method, $route, $payload, $routeParams) = $request;

            $I->deleteHeader('Authorization');
            $anonymousStatus = $I->sendJsonRequest($method, $route, $payload, $routeParams);

            $I->haveHttpHeader('Authorization', 'Bearer ' . $this->facultyToken);
            $facultyStatus = $I->sendJsonRequest($method, $route, $payload, $routeParams);

            $I->haveHttpHeader('Authorization', 'Bearer ' . $this->staffToken);
            $staffStatus = $I->sendJsonRequest($method, $route, $payload, $routeParams);

            $results[$name] = [
                'anonymous' => $anonymousStatus,
                'faculty' => $facultyStatus,
                'staff' => $staffStatus,
            ];
        }

        foreach ($results as $name => $statuses) {
            \PHPUnit\Framework\Assert::assertSame(
                403,
                $statuses['faculty'],
                $name . ' must reject a faculty JWT before handling the request.'
            );
        }

        foreach ($results as $name => $statuses) {
            \PHPUnit\Framework\Assert::assertSame(
                401,
                $statuses['anonymous'],
                $name . ' must require an authenticated token.'
            );
            \PHPUnit\Framework\Assert::assertNotContains(
                $statuses['staff'],
                [401, 403],
                $name . ' must allow staff through to request handling.'
            );
        }
    }

    /**
     * Get an application-issued test token.
     *
     * @param string $url      Token issuer URL.
     * @param array  $postData Form fields for the issuer.
     * @param string $tokenKey Response field containing the token.
     * @return string
     */
    private function requestToken($url, array $postData, $tokenKey)
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => http_build_query($postData),
                'ignore_errors' => true,
            ],
        ]);
        $body = file_get_contents($url, false, $context);
        $data = json_decode($body, true);

        if (!is_array($data) || empty($data[$tokenKey])) {
            throw new \RuntimeException(
                "Expected '{$tokenKey}' in response from {$url}. Got: {$body}"
            );
        }

        return $data[$tokenKey];
    }
}
