<?php
namespace app\commands;

use Yii;
use yii\console\Controller;
use yii\helpers\Console;
use yii\helpers\Json;

class ValidateSpringshareJsonController extends Controller
{
    public $inputFile = '@app/runtime/springshare_data.json';

    public function actionIndex()
    {
        $inputFilePath = Yii::getAlias($this->inputFile);

        if (!file_exists($inputFilePath)) {
            $this->stderr("Error: Input file not found at {$inputFilePath}\n", Console::FG_RED);
            return 1;
        }

        try {
            $jsonString = file_get_contents($inputFilePath);
            $data = Json::decode($jsonString, true);

            $this->stdout("JSON is valid!\n", Console::FG_GREEN);
            return 0; // Success

        } catch (\yii\base\InvalidParamException $e) {
            $this->stderr("Error decoding JSON: " . $e->getMessage() . "\n", Console::FG_RED);

            // NEW: Try to find the error location
            $error = json_last_error();
            $errorMsg = json_last_error_msg();
            if ($error === JSON_ERROR_SYNTAX) {
                $this->findSyntaxError($jsonString); // Call our helper function
            }
            return 1; // Failure
        }
    }
    //Helper function to help find the syntax error
    protected function findSyntaxError($jsonString)
    {
        $length = strlen($jsonString);
        for ($i = 1; $i <= $length; $i++) {
            $partialJson = substr($jsonString, 0, $i);
            json_decode($partialJson); // Don't need to use Yii's helper for this check
            if (json_last_error() !== JSON_ERROR_NONE) {
                $errorPos = $i - 1;
                $line = 1;
                $col = 1;
                for ($j = 0; $j < $errorPos; $j++) {
                    if ($jsonString[$j] === "\n") {
                        $line++;
                        $col = 1;
                    } else {
                        $col++;
                    }
                }

                $contextStart = max(0, $errorPos - 20);
                $contextEnd = min($length, $errorPos + 20);
                $context = substr($jsonString, $contextStart, $contextEnd - $contextStart);

                $this->stderr("Potential syntax error near line {$line}, column {$col}:\n", Console::FG_RED);
                $this->stderr("Context: ...{$context}...\n", Console::FG_RED);
                $this->stderr("Error position (approximate): {$errorPos}\n", Console::FG_RED);
                return; // Stop after finding the first error
            }
        }
    }
}