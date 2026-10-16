<?php

/**
 * Verifies the API-078 test roster and people seed against the test database.
 */
class DevSeedCest extends BaseFunctionalCest
{
    private $currentPeriod = 'AP_209909';
    private $upcomingPeriod = 'AP_210002';
    private $facultyAId = '999078001';
    private $facultyBId = '999078002';

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanupSeed();
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanupSeed();
    }

    public function seedCreatesExpectedRosterAndPeople(FunctionalTester $I)
    {
        $summary = $this->service()->seed($this->currentPeriod, $this->upcomingPeriod);
        \PHPUnit\Framework\Assert::assertSame($this->currentPeriod, $summary['currentPeriod']);
        \PHPUnit\Framework\Assert::assertSame($this->upcomingPeriod, $summary['upcomingPeriod']);
        \PHPUnit\Framework\Assert::assertSame(9, $summary['assignmentCount']);

        $actualAssignments = \Yii::$app->db->createCommand(
            'SELECT academic_period, course_id, course_title, smith_id, role '
            . 'FROM course_assignments WHERE smith_id LIKE :prefix '
            . 'ORDER BY academic_period, course_id, smith_id'
        )->bindValue(':prefix', '999078%')->queryAll();
        \PHPUnit\Framework\Assert::assertSame($this->expectedAssignments(), $actualAssignments);

        $people = \Yii::$app->db->createCommand(
            'SELECT username, full_name, email, role, approved FROM users '
            . 'WHERE username LIKE :prefix ORDER BY username'
        )->bindValue(':prefix', 'test-api078-%')->queryAll();
        \PHPUnit\Framework\Assert::assertSame([
            ['username' => 'test-api078-employee', 'full_name' => 'Test Employee', 'email' => 'test-api078-employee@example.test', 'role' => 'employee', 'approved' => '1'],
            ['username' => 'test-api078-faculty-a', 'full_name' => 'Test Faculty A', 'email' => 'test-api078-faculty-a@example.test', 'role' => 'faculty', 'approved' => '0'],
            ['username' => 'test-api078-faculty-b', 'full_name' => 'Test Faculty B', 'email' => 'test-api078-faculty-b@example.test', 'role' => 'faculty', 'approved' => '0'],
            ['username' => 'test-api078-staff', 'full_name' => 'Test Staff', 'email' => 'test-api078-staff@example.test', 'role' => 'staff', 'approved' => '1'],
        ], $people);

        \PHPUnit\Framework\Assert::assertSame($this->facultyAId, $summary['people']['facultyA']['smith_id']);
        \PHPUnit\Framework\Assert::assertSame($this->facultyBId, $summary['people']['facultyB']['smith_id']);
        $staff = (new \app\services\ApprovedUserLookup())->find('test-api078-staff');
        \PHPUnit\Framework\Assert::assertSame('staff', $staff['role']);
        \PHPUnit\Framework\Assert::assertSame('1', $staff['approved']);
    }

    public function rerunningSeedDoesNotCreateDuplicates(FunctionalTester $I)
    {
        $service = $this->service();
        $service->seed($this->currentPeriod, $this->upcomingPeriod);
        $service->seed($this->currentPeriod, $this->upcomingPeriod);

        \PHPUnit\Framework\Assert::assertSame(9, $this->countOwnedAssignments());
        \PHPUnit\Framework\Assert::assertSame(4, $this->countOwnedPeople());
    }

    public function resetRemovesOnlyOwnedRows(FunctionalTester $I)
    {
        \Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => 'AP_209909',
            'course_id' => 'TST-777-01-209909',
            'course_title' => 'TST 777 - Unowned Test Row',
            'smith_id' => '999000078',
            'role' => 'Instructor',
        ])->execute();

        $service = $this->service();
        $service->seed($this->currentPeriod, $this->upcomingPeriod);
        $service->reset();

        \PHPUnit\Framework\Assert::assertSame(0, $this->countOwnedAssignments());
        \PHPUnit\Framework\Assert::assertSame(0, $this->countOwnedPeople());
        \PHPUnit\Framework\Assert::assertSame(1, (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM course_assignments WHERE smith_id = :smithId'
        )->bindValue(':smithId', '999000078')->queryScalar());
    }

    public function refusesSeedOutsideDevAndTest(FunctionalTester $I)
    {
        $service = new \app\services\DevSeedService(null, function () {
            return \app\components\Environment::allowsTestFixturesFor('prod');
        });

        try {
            $service->seed($this->currentPeriod, $this->upcomingPeriod);
            \PHPUnit\Framework\Assert::fail('Production environment should refuse test fixtures.');
        } catch (\RuntimeException $exception) {
            \PHPUnit\Framework\Assert::assertSame(
                'Refusing to seed test data outside dev/test.',
                $exception->getMessage()
            );
        }

        \PHPUnit\Framework\Assert::assertSame(0, $this->countOwnedAssignments());
        \PHPUnit\Framework\Assert::assertSame(0, $this->countOwnedPeople());
    }

    private function service()
    {
        return new \app\services\DevSeedService();
    }

    private function expectedAssignments()
    {
        $courses = [
            ['101', '01', 'TST 101 - Test Course One'],
            ['102', '01', 'TST 102 - Test Course Two'],
            ['103', '01', 'TST 103 - Test Course Three'],
            ['104', '01', 'TST 104 - Test Course Four'],
            ['105', '01', 'TST 105 - Test Course Five'],
        ];
        $expected = [];
        foreach ($courses as $course) {
            if ($course[0] === '101') {
                $expected[] = $this->assignment($this->currentPeriod, $course, $this->facultyAId);
            }
            $expected[] = $this->assignment($this->upcomingPeriod, $course, $this->facultyAId);
            if ($course[0] === '104') {
                $expected[] = $this->assignment($this->upcomingPeriod, $course, $this->facultyBId);
            }
        }
        foreach (['01', '02'] as $section) {
            $expected[] = $this->assignment(
                $this->upcomingPeriod,
                ['106', $section, 'TST 106 - Test Course Six'],
                $this->facultyBId
            );
        }

        usort($expected, function ($left, $right) {
            return strcmp(
                $left['academic_period'] . $left['course_id'] . $left['smith_id'],
                $right['academic_period'] . $right['course_id'] . $right['smith_id']
            );
        });
        return $expected;
    }

    private function assignment($period, array $course, $smithId)
    {
        return [
            'academic_period' => $period,
            'course_id' => 'TST-' . $course[0] . '-' . $course[1] . '-' . substr($period, 3),
            'course_title' => $course[2],
            'smith_id' => $smithId,
            'role' => 'Instructor',
        ];
    }

    private function countOwnedAssignments()
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM course_assignments WHERE smith_id LIKE :prefix'
        )->bindValue(':prefix', '999078%')->queryScalar();
    }

    private function countOwnedPeople()
    {
        return (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM users WHERE username LIKE :prefix'
        )->bindValue(':prefix', 'test-api078-%')->queryScalar();
    }

    private function cleanupSeed()
    {
        \Yii::$app->db->createCommand(
            'DELETE FROM course_assignments WHERE smith_id LIKE :prefix'
        )->bindValue(':prefix', '999078%')->execute();
        \Yii::$app->db->createCommand(
            'DELETE FROM users WHERE username LIKE :prefix'
        )->bindValue(':prefix', 'test-api078-%')->execute();
    }
}
