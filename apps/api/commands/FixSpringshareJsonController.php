<?php
namespace app\commands;

use Yii;
use yii\console\Controller;
use yii\helpers\Console;
use yii\helpers\Json;

/**
 * FixSpringshareJsonController
 *
 * Preprocesses a SpringShare JSON file to:
 * 1. Remove any leading/trailing whitespace from *all* string values.
 * 2. Fix invalid JSON within the "11" field (nested JSON).
 */
class FixSpringshareJsonController extends Controller
{
    public $inputFile = '@app/runtime/springshare_data.json';
    public $outputFile = '@app/runtime/springshare_data_fixed.json';

    public function actionIndex()
    {
        $this->stdout("Starting JSON fix process...\n", Console::FG_GREEN);

        $inputFilePath = Yii::getAlias($this->inputFile);
        $outputFilePath = Yii::getAlias($this->outputFile);

        if (!file_exists($inputFilePath)) {
            $this->stderr("Error: Input file not found at {$inputFilePath}\n", Console::FG_RED);
            return 1;
        }

        try {
            // Read the entire file content.
            $jsonString = file_get_contents($inputFilePath);

            // Preprocess repairs
            // Fix unterminated strings (simple example; adjust as needed)
            $jsonString = preg_replace('/:\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*?)(\s*[,}])/m', ':"$1"$2', $jsonString);
            
            // Fix unescaped quotes inside strings
            $jsonString = preg_replace('/(")([^"\\\\]*(?:\\\\.[^"\\\\]*)*?)(")(\s*[:,\]}])/m', '$1$2\\"$3$4', $jsonString);
    
            // Decode the repaired JSON
            $data = Json::decode($jsonString, true);

            // Check for 'aaData' and ensure it's an array.
            if (!isset($data['aaData']) || !is_array($data['aaData'])) {
                $this->stderr("Error: 'aaData' key not found or is not an array.\n", Console::FG_RED);
                return 1;
            }

            // Iterate through all elements of aaData.
            foreach ($data['aaData'] as &$record) {
                // Trim whitespace from ALL string values within each record.
                foreach ($record as $key => &$value) {
                    if (is_string($value)) {
                        $value = trim($value);
                    }
                }
                unset($value); // Break reference

                // Fix the nested JSON in field "11" (if it exists).
                if (isset($record['11'])) {
                    $pattern = '/\{"desc_pos"\s*:\s*(\d+)\s*,\s*"target"\s*:\s*(\d+)\s*,\s*"enable_proxy"\s*:\s*(\d+)\s*\}/';
                    $replacement = '{"desc_pos":$1,"target":$2,"enable_proxy":$3}';
                    $record['11'] = preg_replace($pattern, $replacement, trim($record['11'])); //also trim
                }
            }
            unset($record); // Break reference

            // Encode the *modified* data back into JSON.
            $fixedJson = Json::encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);


            // Write the fixed JSON to the output file.
            if (file_put_contents($outputFilePath, $fixedJson) === false) {
                $this->stderr("Error: Unable to write fixed JSON to {$outputFilePath}\n", Console::FG_RED);
                return 1;
            }

            $this->stdout("Fixed JSON written to {$outputFilePath}\n", Console::FG_GREEN);
            return 0; // Success

        } catch (\yii\base\InvalidParamException $e) {
            $this->stderr("Error decoding or encoding JSON: " . $e->getMessage() . "\n", Console::FG_RED);
            return 1;
        } catch (\Exception $e) {
            $this->stderr("An unexpected error occurred: " . $e->getMessage() . "\n", Console::FG_RED);
            return 1;
        }
    }
}