<?php
namespace app\commands;

use Yii;
use yii\console\Controller;
use yii\helpers\Console;
use yii\helpers\Json;
use yii\httpclient\Client; 

/**
 * FetchSpringshareDataController
 *
 * Fetches data from a SpringShare API endpoint that uses DataTables
 * request parameters, parses the URL-encoded parameters, makes the
 * request, and then outputs the resulting JSON data.
 *
 * Usage:
 *   php yii fetch-springshare-data
 *
 *  Optionally specify a different URL
 *   php yii fetch-springshare-data --url="https://example.com/api/data"
 */
class FetchSpringshareDataController extends Controller
{
    /**
     * @var string|null The URL of the SpringShare API endpoint.
     */
    public $url;

    public function init()
    {
        parent::init();
        $this->url = getenv('SPRINGSHARE_EXPORT_URL') ?: null;
    }

    /**
     * Defines the command line options.
     * @return array
     */
    public function options($actionID)
    {
        return ['url']; // Allow the 'url' option
    }


    /**
     * Fetches and processes the SpringShare data.
     */
    public function actionIndex()
    {
        if (!$this->url) {
            $this->stderr("Configure SPRINGSHARE_EXPORT_URL or pass --url.\n", Console::FG_RED);
            return 1;
        }

        $this->stdout("Fetching data from SpringShare...\n", Console::FG_GREEN);

        // Parse the query string from the URL into an associative array.
        $urlComponents = parse_url($this->url);

        // Check if a query string exists.
        if (!isset($urlComponents['query'])) {
            $this->stderr("Error: No query string found in the URL.\n", Console::FG_RED);
            return 1;
        }

        parse_str($urlComponents['query'], $queryParams);

        // Create an HTTP client instance.
        $client = new Client();

        try {
            // Make the GET request with the parsed parameters.
            $response = $client->createRequest()
                ->setMethod('GET')
                ->setUrl($urlComponents['scheme'] . '://' . $urlComponents['host'] . $urlComponents['path']) // Reconstruct base URL
                ->setData($queryParams) // Send parameters as data
                ->send();

            // Check if the request was successful.
            if ($response->isOk) {
                // Output the *raw* JSON response (for verification).
                $this->stdout("Raw JSON Response:\n", Console::FG_YELLOW);
                $this->stdout($response->content . "\n", Console::FG_CYAN);

                // Decode the JSON response.
                try {
                    $data = Json::decode($response->content, true); // Decode as associative array
                    $this->stdout("\nDecoded JSON Data (Pretty Printed):\n", Console::FG_YELLOW);
                    $this->stdout(Json::encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n", Console::FG_CYAN);

                    // You can now process the $data array as needed.  For example:
                     if (isset($data['aaData']) && is_array($data['aaData'])) {
                         $this->stdout("\nFirst 5 Records from aaData:\n", Console::FG_YELLOW);
                         $count = 0;
                         foreach ($data['aaData'] as $record) {
                            $this->stdout(Json::encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n", Console::FG_CYAN);
                             $count++;
                             if ($count >= 5) {
                                 break;  // Stop after 5 records
                             }
                         }
                     } else {
                         $this->stderr("Error: 'aaData' key not found or is not an array in the response.\n", Console::FG_RED);
                     }

                } catch (\yii\base\InvalidParamException $e) {
                    $this->stderr("Error decoding JSON response: " . $e->getMessage() . "\n", Console::FG_RED);
                    return 1;
                }
            } else {
                $this->stderr("Error: HTTP request failed. Status Code: " . $response->statusCode . "\n", Console::FG_RED);
                $this->stderr("Response Content:\n" . $response->content . "\n", Console::FG_RED); // Output error response
                return 1;
            }

        } catch (\yii\httpclient\Exception $e) {
            $this->stderr("Error during HTTP request: " . $e->getMessage() . "\n", Console::FG_RED);
            return 1;
        }

        $this->stdout("Data fetching completed.\n", Console::FG_GREEN);
        return 0;
    }
}
