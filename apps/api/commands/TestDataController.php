<?php

namespace app\commands;

use app\services\SandboxFacultyWorkflowFixture;
use Yii;
use yii\console\Controller;
use yii\console\ExitCode;
use yii\helpers\Console;

class TestDataController extends Controller
{
    public function actionSeedFacultyWorkflow()
    {
        if (!$this->assertNonProduction()) {
            return ExitCode::UNSPECIFIED_ERROR;
        }

        try {
            $summary = (new SandboxFacultyWorkflowFixture())->seed();
            $this->stdout("Seeded sandbox faculty workflow fixture.\n", Console::FG_GREEN);
            $this->stdout("Faculty login: {$summary['facultyUserId']}\n");
            $this->stdout("Faculty internal ID: {$summary['facultyInternalId']}\n");
            $this->stdout("Submission UUID: {$summary['submissionUuid']}\n");
            $this->stdout("Course: {$summary['courseNumber']} - {$summary['courseTitle']}\n");
            $this->stdout("FOLIO course listing ID: {$summary['folioCourseListingId']}\n");
            $this->stdout("Resources: {$summary['resourceCount']}\n");
            $this->stdout("Folders: " . implode(', ', $summary['folders']) . "\n");

            return ExitCode::OK;
        } catch (\Throwable $exception) {
            $this->stderr($exception->getMessage() . "\n", Console::FG_RED);
            return ExitCode::UNSPECIFIED_ERROR;
        }
    }

    public function actionResetFacultyWorkflow()
    {
        if (!$this->assertNonProduction()) {
            return ExitCode::UNSPECIFIED_ERROR;
        }

        try {
            (new SandboxFacultyWorkflowFixture())->reset();
            $this->stdout("Reset sandbox faculty workflow fixture.\n", Console::FG_GREEN);

            return ExitCode::OK;
        } catch (\Throwable $exception) {
            $this->stderr($exception->getMessage() . "\n", Console::FG_RED);
            return ExitCode::UNSPECIFIED_ERROR;
        }
    }

    private function assertNonProduction()
    {
        if (YII_ENV_PROD) {
            $this->stderr("Refusing to modify test data in production.\n", Console::FG_RED);
            return false;
        }

        return true;
    }
}
