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
     * Decode the last response body as JSON.
     *
     * @return array|null
     */
    public function grabJsonResponse()
    {
        return json_decode($this->getModule('Yii2')->_getResponseContent(), true);
    }
}
