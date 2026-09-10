<?php
namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\web\Response;
use yii\web\BadRequestHttpException;
use yii\httpclient\Client;

/**
 * HitchcockController
 *
 * This REST controller provides an endpoint for searching Hitchcock uploads.
 * It uses credentials stored in the configuration to authenticate with Hitchcock
 * and returns the search results as JSON.
 */
class HitchcockController extends Controller
{
    // Disable CSRF for API endpoints if needed.
    public $enableCsrfValidation = false;

    /**
     * Define behaviors (e.g., CORS) as needed.
     */
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // Example CORS configuration. Adjust as necessary.
        $behaviors['corsFilter'] = [
            'class' => \yii\filters\Cors::class,
            'cors' => [
                'Origin' => ['http://localhost:5173', 'https://libtools2.smith.edu'], 
                'Access-Control-Request-Method' => ['GET', 'POST', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization'],
            ],
        ];

        return $behaviors;
    }

    /**
     * Searches Hitchcock uploads based on a title.
     *
     * Example endpoint: GET /hitchcock/search-resources?title=test
     *
     * @param string $title The search term.
     * @return array JSON search results from Hitchcock.
     * @throws BadRequestHttpException if required parameters are missing or if an error occurs.
     */
    public function actionSearchResources($title)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;

        if (empty($title)) {
            throw new BadRequestHttpException("The 'title' parameter is required.");
        }

        // Retrieve Hitchcock credentials from config
        $username = Yii::$app->params['hitchcock']['username'] ?? null;
        $password = Yii::$app->params['hitchcock']['password'] ?? null;
        if (!$username || !$password) {
            throw new BadRequestHttpException("Hitchcock credentials are not configured.");
        }

        $client = new Client();

        try {
            // Step 1: Authenticate and obtain a token.
            $authResponse = $client->createRequest()
                ->setMethod('POST')
                ->setUrl('https://ereserves.smith.edu/hitchcock/auth/')
                ->setData([
                    'username' => $username,
                    'password' => $password,
                ])
                ->send();

            if (!$authResponse->isOk) {
                Yii::error("Hitchcock auth failed: " . $authResponse->content);
                throw new \Exception("Authentication failed with status " . $authResponse->statusCode);
            }

            $authData = $authResponse->data;
            if (!isset($authData['token'])) {
                throw new \Exception("Authentication response did not return a token.");
            }
            $token = $authData['token'];

            // Step 2: Use the token to perform the search.
            $searchResponse = $client->createRequest()
                ->setMethod('GET')
                ->setUrl('https://ereserves.smith.edu/hitchcock/uploads')
                ->setData(['title' => $title])
                ->setHeaders([
                    'Authorization' => "Token {$token}",
                ])
                ->send();

            if (!$searchResponse->isOk) {
                Yii::error("Hitchcock search failed: " . $searchResponse->content);
                throw new \Exception("Search failed with status " . $searchResponse->statusCode);
            }

            return $searchResponse->data;
        } catch (\Exception $e) {
            Yii::error("Hitchcock search exception: " . $e->getMessage());
            throw new BadRequestHttpException("Search error: " . $e->getMessage());
        }
    }
}
