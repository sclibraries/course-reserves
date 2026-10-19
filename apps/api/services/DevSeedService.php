<?php

namespace app\services;

use app\components\Environment;
use Yii;

/**
 * Creates the synthetic API-078 roster and people plus the CX-029 previous-course demo.
 */
class DevSeedService
{
    const USERNAME_PREFIX = 'test-api078-';
    const SMITH_ID_PREFIX = '999078';

    private $db;
    private $fixturePermission;

    /**
     * @param mixed $db Optional database connection for tests.
     * @param callable|null $fixturePermission Optional permission rule for tests.
     */
    public function __construct($db = null, $fixturePermission = null)
    {
        $this->db = $db ?: Yii::$app->db;
        $this->fixturePermission = $fixturePermission;
    }

    public function seed($currentPeriod = null, $upcomingPeriod = null)
    {
        $this->assertFixturesAllowed();
        $defaults = $this->defaultAcademicPeriods();
        $currentPeriod = $currentPeriod ?: $defaults['current'];
        $upcomingPeriod = $upcomingPeriod ?: $defaults['upcoming'];
        $this->validatePeriod($currentPeriod);
        $this->validatePeriod($upcomingPeriod);

        $transaction = $this->db->beginTransaction();
        try {
            $previousCourse = (new DevSeedPreviousCourseService())->seed();
            $people = $this->people();
            foreach ($people as $person) {
                $this->db->createCommand()->upsert('users', [
                    'username' => $person['username'],
                    'full_name' => $person['full_name'],
                    'email' => $person['email'],
                    'department' => $person['department'],
                    'institution' => 'Smith College',
                    'role' => $person['role'],
                    'approved' => $person['approved'],
                ], true)->execute();
            }
            (new DevSeedGroupService($this->db))->seed($people['staff']['username']);

            $assignments = $this->assignments($currentPeriod, $upcomingPeriod, $people);
            foreach ($assignments as $assignment) {
                $this->db->createCommand()->upsert('course_assignments', $assignment, true)->execute();
            }

            $transaction->commit();
        } catch (\Throwable $exception) {
            $transaction->rollBack();
            throw $exception;
        }

        return [
            'currentPeriod' => $currentPeriod,
            'upcomingPeriod' => $upcomingPeriod,
            'people' => $people,
            'assignmentCount' => count($assignments),
            'previousCourse' => $previousCourse,
        ];
    }

    public function reset()
    {
        $this->assertFixturesAllowed();
        $transaction = $this->db->beginTransaction();
        try {
            (new DevSeedPreviousCourseService())->reset();
            (new DevSeedGroupService($this->db))->reset(self::USERNAME_PREFIX . 'staff');
            $this->db->createCommand(
                'DELETE FROM course_assignments WHERE smith_id LIKE :prefix'
            )->bindValue(':prefix', self::SMITH_ID_PREFIX . '%')->execute();
            $this->db->createCommand(
                'DELETE FROM users WHERE username LIKE :prefix'
            )->bindValue(':prefix', self::USERNAME_PREFIX . '%')->execute();
            $transaction->commit();
        } catch (\Throwable $exception) {
            $transaction->rollBack();
            throw $exception;
        }
    }

    private function people()
    {
        return [
            'facultyA' => [
                'username' => self::USERNAME_PREFIX . 'faculty-a',
                'full_name' => 'Test Faculty A',
                'email' => self::USERNAME_PREFIX . 'faculty-a@example.test',
                'smith_id' => self::SMITH_ID_PREFIX . '001',
                'role' => 'faculty',
                'approved' => 0,
                'department' => 'Test Department',
            ],
            'facultyB' => [
                'username' => self::USERNAME_PREFIX . 'faculty-b',
                'full_name' => 'Test Faculty B',
                'email' => self::USERNAME_PREFIX . 'faculty-b@example.test',
                'smith_id' => self::SMITH_ID_PREFIX . '002',
                'role' => 'faculty',
                'approved' => 0,
                'department' => 'Test Department',
            ],
            'employee' => [
                'username' => self::USERNAME_PREFIX . 'employee',
                'full_name' => 'Test Employee',
                'email' => self::USERNAME_PREFIX . 'employee@example.test',
                'smith_id' => self::SMITH_ID_PREFIX . '003',
                'role' => 'employee',
                'approved' => 1,
                'department' => 'Test Department',
            ],
            'staff' => [
                'username' => self::USERNAME_PREFIX . 'staff',
                'full_name' => 'Test Staff',
                'email' => self::USERNAME_PREFIX . 'staff@example.test',
                'role' => 'staff',
                'approved' => 1,
                'department' => 'Library',
            ],
        ];
    }

    private function assignments($currentPeriod, $upcomingPeriod, array $people)
    {
        $courses = [
            ['number' => '101', 'section' => '01', 'title' => 'TST 101 - Test Course One'],
            ['number' => '102', 'section' => '01', 'title' => 'TST 102 - Test Course Two'],
            ['number' => '103', 'section' => '01', 'title' => 'TST 103 - Test Course Three'],
            ['number' => '104', 'section' => '01', 'title' => 'TST 104 - Test Course Four'],
            ['number' => '105', 'section' => '01', 'title' => 'TST 105 - Test Course Five'],
        ];
        $assignments = [];

        foreach ($courses as $course) {
            if ($course['number'] === '101') {
                $assignments[] = $this->assignment($course, $currentPeriod, $people['facultyA']['smith_id']);
            }
            $assignments[] = $this->assignment($course, $upcomingPeriod, $people['facultyA']['smith_id']);
            if ($course['number'] === '104') {
                $assignments[] = $this->assignment($course, $upcomingPeriod, $people['facultyB']['smith_id']);
            }
        }

        foreach (['01', '02'] as $section) {
            $assignments[] = $this->assignment([
                'number' => '106',
                'section' => $section,
                'title' => 'TST 106 - Test Course Six',
            ], $upcomingPeriod, $people['facultyB']['smith_id']);
        }

        return $assignments;
    }

    private function assignment(array $course, $period, $smithId)
    {
        return [
            'academic_period' => $period,
            'course_id' => 'TST-' . $course['number'] . '-' . $course['section'] . '-' . substr($period, 3),
            'course_title' => $course['title'],
            'smith_id' => $smithId,
            'role' => 'Instructor',
        ];
    }

    private function defaultAcademicPeriods()
    {
        $today = new \DateTimeImmutable('today');
        $year = (int)$today->format('Y');
        $month = (int)$today->format('n');

        if ($month === 1) {
            return ['current' => $this->period($year, 2), 'upcoming' => $this->period($year, 9)];
        }
        if ($month >= 2 && $month <= 5) {
            return ['current' => $this->period($year, $month), 'upcoming' => $this->period($year, 9)];
        }
        if ($month === 6 || $month === 7) {
            return ['current' => $this->period($year, 5), 'upcoming' => $this->period($year, 9)];
        }
        if ($month === 8) {
            return ['current' => $this->period($year, 9), 'upcoming' => $this->period($year + 1, 2)];
        }

        return ['current' => $this->period($year, $month), 'upcoming' => $this->period($year + 1, 2)];
    }

    private function period($year, $month)
    {
        return sprintf('AP_%04d%02d', $year, $month);
    }

    private function validatePeriod($period)
    {
        if (!preg_match('/^AP_\d{4}(0[1-9]|1[0-2])$/', (string)$period)) {
            throw new \InvalidArgumentException('Academic periods must use AP_YYYYMM with a valid month.');
        }
    }

    private function assertFixturesAllowed()
    {
        $allowed = $this->fixturePermission === null
            ? Environment::allowsTestFixtures()
            : call_user_func($this->fixturePermission);
        if (!$allowed) {
            throw new \RuntimeException('Refusing to seed test data outside dev/test.');
        }
    }
}
