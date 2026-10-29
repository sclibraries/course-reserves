<?php

namespace Helper;

/**
 * Functional-suite helper for JSON request bodies.
 *
 * The Yii2 module's actor methods only send form-encoded parameters. The
 * React clients post raw JSON, and several controllers read the raw body
 * directly, so functional tests need a way to send the same shape.
 *
 * PHP 7.2 compatible — no typed properties, no arrow functions, no ??=.
 */
class Functional extends \Codeception\Module
{
    /**
     * POST a JSON document to a Yii route and let the application handle it.
     *
     * @param string $route   Yii route, e.g. 'course/create-resource'
     * @param array  $payload Decoded JSON document to send as the request body
     */
    public function sendJsonPost($route, array $payload)
    {
        $url = \Yii::$app->urlManager->createUrl([$route]);
        $this->getModule('Yii2')->_request(
            'POST',
            $url,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );
    }

    /**
     * Send a JSON request using an explicit HTTP method and URI.
     *
     * @param string $method HTTP method.
     * @param string $route  Yii route, such as "course/create".
     * @param array  $payload Decoded JSON document to send as the request body.
     * @param array  $routeParams Parameters passed to the Yii route.
     * @return int HTTP response status code.
     */
    public function sendJsonRequest($method, $route, array $payload = [], array $routeParams = [])
    {
        $module = $this->getModule('Yii2');
        $url = \Yii::$app->urlManager->createUrl(array_merge([$route], $routeParams));
        $module->_request(
            strtoupper($method),
            $url,
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );

        return $module->_getResponseStatusCode();
    }

    /**
     * Send a literal browser request with CORS headers.
     *
     * @param string      $method        HTTP method.
     * @param string      $path          Literal request path.
     * @param string      $origin        Origin header.
     * @param string|null $requestMethod Requested method for OPTIONS.
     * @param string|null $requestHeaders Requested headers for OPTIONS.
     * @return int HTTP response status code.
     */
    public function sendCorsRequest($method, $path, $origin, $requestMethod = null, $requestHeaders = null)
    {
        $server = ['HTTP_ORIGIN' => $origin];
        if ($requestMethod !== null) {
            $server['HTTP_ACCESS_CONTROL_REQUEST_METHOD'] = $requestMethod;
        }
        if ($requestHeaders !== null) {
            $server['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] = $requestHeaders;
        }

        $module = $this->getModule('Yii2');
        $module->_request(strtoupper($method), $path, [], [], $server);

        return $module->_getResponseStatusCode();
    }

    /**
     * Decode the last response body as JSON.
     *
     * @return array|null
     */
    public function grabJsonResponse()
    {
        return json_decode($this->getModule('Yii2')->_getResponseContent(), true);
    }
}
