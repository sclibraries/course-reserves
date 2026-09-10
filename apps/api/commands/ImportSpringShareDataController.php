<?php
namespace app\commands;

use Yii;
use yii\console\Controller;
use yii\helpers\Console;
use yii\helpers\Json; // Import Yii2's JSON helper

/**
 * ImportSpringShareDataController
 *
 * This command reads SpringShare JSON data from a *fixed* JSON file (output of FixSpringshareJsonController),
 * parses it, and echoes the parsed data.  It assumes the data is now a valid JSON array.
 *
 * Usage:
 *   php yii import-spring-share-data
 */
class ImportSpringShareDataController extends Controller
{
    /**
     * @var string Path to the *fixed* JSON file.
     */
    public $file = '@app/runtime/springshare_data_fixed.json';

    /**
     * The main action that parses and echoes the JSON data.
     */
    public function actionIndex()
    {
        $this->stdout("Starting SpringShare data verification...\n", Console::FG_GREEN);

        $filePath = Yii::getAlias($this->file);
        if (!file_exists($filePath)) {
            $this->stderr("Error: JSON file not found at {$filePath}\n", Console::FG_RED);
            return 1; // Return non-zero exit code on error
        }

        try {
            // Read and decode the entire JSON file *using Yii's Json helper*.
            $data = Json::decode(file_get_contents($filePath), true); // Decode as associative array
        } catch (\yii\base\InvalidParamException $e) {
            $this->stderr("Error decoding JSON: " . $e->getMessage() . "\n", Console::FG_RED);
            return 1;
        }

        // No need to check for 'aaData' anymore, as it's now a simple array.

        // Loop through each record (which is now a direct element of the array).
        foreach ($data as $record) {
            // Clean and extract values.
            $resourceId    = isset($record["0"]) ? (int)$record["0"] : null;
            $name          = isset($record["1"]) ? trim($record["1"]) : '';
            $materialType  = isset($record["2"]) ? trim($record["2"]) : '';
            $authorEditor  = isset($record["4"]) ? trim($record["4"]) : '';
            $startVisibility = isset($record["5"]) ? $record["5"] : null;

            // Set a default use_proxy value.
            $useProxy = 0;
            if (isset($record["11"])) {
                // Use Yii's Json::decode for the nested JSON as well.
                try {
                    $nested = Json::decode($record["11"], true);
                    if (isset($nested['enable_proxy'])) {
                        $useProxy = (int)$nested['enable_proxy'];
                    }
                } catch (\yii\base\InvalidParamException $e) {
                    $this->stderr("Warning: Error parsing nested JSON for resource {$resourceId}: " . $e->getMessage() . "\n", Console::FG_YELLOW);
                    //  Log or handle the nested JSON error.  Could continue processing the rest of the data.
                }
            }

            // Map material type string to material_type_id.
            $materialTypeId = $this->getMaterialTypeId($materialType);

            // Echo the parsed values.
            $this->stdout("Resource ID: {$resourceId}\n", Console::FG_BLUE);
            $this->stdout("Name: {$name}\n", Console::FG_BLUE);
            $this->stdout("Material Type: {$materialType}\n", Console::FG_BLUE);
            $this->stdout("Material Type ID: " . ($materialTypeId !== null ? $materialTypeId : 'N/A') . "\n", Console::FG_BLUE);
            $this->stdout("Author/Editor: {$authorEditor}\n", Console::FG_BLUE);
            $this->stdout("Start Visibility: {$startVisibility}\n", Console::FG_BLUE);
            $this->stdout("Use Proxy: {$useProxy}\n", Console::FG_BLUE);
            $this->stdout(str_repeat("-", 40) . "\n", Console::FG_BLUE);
        }

        $this->stdout("SpringShare data verification completed.\n", Console::FG_GREEN);
        return 0; // Return 0 on success
    }

    /**
     * Map material type strings to material_type_id.
     *
     * @param string $materialType
     * @return int|null
     */
    protected function getMaterialTypeId($materialType)
    {
        $mapping = [
            'Media'                   => 1,
            'Article'                 => 2,
            'Book / e-Book / Chapter' => 3,
            'Website'                 => 4,
            // Add additional mappings as needed.
        ];

        return $mapping[$materialType] ?? null; // Use null coalescing operator (PHP 7+) for cleaner default.
    }
}