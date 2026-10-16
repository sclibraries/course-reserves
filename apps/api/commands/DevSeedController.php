<?php

namespace app\commands;

use app\services\ApprovedUserLookup;
use app\services\DevSeedService;
use yii\console\Controller;
use yii\console\ExitCode;
use yii\helpers\Console;

/**
 * Seeds synthetic test roster and people for the fake-FOLIO scenarios.
 *
 * Usage: php yii dev-seed/test-courses [--current-period=AP_YYYYMM] [--upcoming-period=AP_YYYYMM] [--reset]
 */
class DevSeedController extends Controller
{
    public $reset = false;
    public $currentPeriod;
    public $upcomingPeriod;

    public function options($actionID)
    {
        return array_merge(parent::options($actionID), ['reset', 'currentPeriod', 'upcomingPeriod']);
    }

    public function actionTestCourses()
    {
        $service = new DevSeedService();
        try {
            if ($this->reset) {
                $service->reset();
                $this->stdout("Reset API-078 test roster and people.\n", Console::FG_GREEN);
                return ExitCode::OK;
            }

            $summary = $service->seed($this->currentPeriod, $this->upcomingPeriod);
            $staff = (new ApprovedUserLookup())->find($summary['people']['staff']['username']);
            if (!$staff || $staff['role'] !== 'staff') {
                throw new \RuntimeException('Seeded staff account was not found as an approved staff user.');
            }

            $this->stdout("Seeded {$summary['assignmentCount']} API-078 course assignments.\n", Console::FG_GREEN);
            $this->stdout('Current AP period: ' . $summary['currentPeriod'] . "\n");
            $this->stdout('Upcoming AP period: ' . $summary['upcomingPeriod'] . "\n");
            $this->printPerson($summary['people']['facultyA'], 'Faculty A');
            $this->printPerson($summary['people']['facultyB'], 'Faculty B');
            $this->printPerson($summary['people']['employee'], 'Employee');
            $this->printPerson($summary['people']['staff'], 'Staff');
            $this->stdout("\nSign-in steps:\n");
            $this->stdout(sprintf(
                'Faculty A: POST http://localhost:8080/course-reserves/backend/web/faculty-submission/mock-login with {"full_name":"Test Faculty A","internal_id":"%s"}.%s',
                $summary['people']['facultyA']['smith_id'],
                "\n"
            ));
            $this->stdout(sprintf(
                'Faculty B: POST http://localhost:8080/course-reserves/backend/web/faculty-submission/mock-login with {"full_name":"Test Faculty B","internal_id":"%s"}.%s',
                $summary['people']['facultyB']['smith_id'],
                "\n"
            ));
            $this->stdout('Employee: set DEV_USERNAME=' . $summary['people']['employee']['username'] . " in apps/api/.env, restart the API, then open http://localhost:8080/course-reserves/backend/admin/authorize-local.php?origin=http://localhost:5173\n");
            $this->stdout('Staff: ApprovedUserLookup found ' . $staff['username'] . ' with role ' . $staff['role'] . ".\n");
            $this->stdout('Admin dev login: set DEV_USERNAME=' . $staff['username'] . " in apps/api/.env, restart the API, then open http://localhost:8080/course-reserves/backend/admin/authorize-local.php?origin=http://localhost:5173\n");

            return ExitCode::OK;
        } catch (\Throwable $exception) {
            $this->stderr($exception->getMessage() . "\n", Console::FG_RED);
            return ExitCode::UNSPECIFIED_ERROR;
        }
    }

    private function printPerson(array $person, $label)
    {
        $smithId = isset($person['smith_id']) ? ', Smith ID ' . $person['smith_id'] : '';
        $this->stdout($label . ': ' . $person['full_name'] . ' (' . $person['username'] . '), ' . $person['email'] . $smithId . "\n");
    }
}
