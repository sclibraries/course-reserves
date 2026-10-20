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
        $seededGroup = \Yii::$app->db->createCommand(
            'SELECT g.name, m.username FROM staff_groups g '
            . 'INNER JOIN staff_group_members m ON m.group_id = g.id WHERE g.name = :name',
            [':name' => 'Acquisitions']
        )->queryOne();
        \PHPUnit\Framework\Assert::assertSame([
            'name' => 'Acquisitions',
            'username' => 'test-api078-staff',
        ], $seededGroup);

        $book = \Yii::$app->db->createCommand(
            'SELECT material_type_id, name, description FROM material_types WHERE LOWER(name) = :name LIMIT 1',
            [':name' => 'book']
        )->queryOne();
        \PHPUnit\Framework\Assert::assertNotNull($book, 'dev-seed must ensure a book material type exists.');
        \PHPUnit\Framework\Assert::assertSame('book', strtolower($book['name']));
        \PHPUnit\Framework\Assert::assertSame(
            'Synthetic material type created by dev-seed/test-courses for the Print book flow.',
            $book['description']
        );
        $mapping = \Yii::$app->db->createCommand(
            'SELECT f.name FROM material_type_flows m INNER JOIN flows f ON f.id = m.flow_id '
            . 'WHERE m.material_type_id = :type_id', [':type_id' => $book['material_type_id']]
        )->queryScalar();
        \PHPUnit\Framework\Assert::assertSame('Print book', $mapping);
    }

    public function seedCommandPrintsPrintBookMappingAndResetRemovesSeededType(FunctionalTester $I)
    {
        $seed = $this->runSeedCommand(false);
        \PHPUnit\Framework\Assert::assertSame(0, $seed['status'], implode("\n", $seed['output']));
        \PHPUnit\Framework\Assert::assertSame(1, count(array_filter($seed['output'], function ($line) {
            return trim($line) === 'Flow: Print book mapped to material type book';
        })), 'The seed command must print the flow mapping exactly once.');

        $repeat = $this->runSeedCommand(false);
        \PHPUnit\Framework\Assert::assertSame(0, $repeat['status'], implode("\n", $repeat['output']));
        $seededBook = \Yii::$app->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE description = :description LIMIT 1',
            [':description' => 'Synthetic material type created by dev-seed/test-courses for the Print book flow.']
        )->queryOne();
        \PHPUnit\Framework\Assert::assertNotNull($seededBook);
        \PHPUnit\Framework\Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM material_types WHERE LOWER(name) = :name', [':name' => 'book']
        )->queryScalar());
        \PHPUnit\Framework\Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM material_type_flows m INNER JOIN material_types mt '
            . 'ON mt.material_type_id = m.material_type_id INNER JOIN flows f ON f.id = m.flow_id '
            . 'WHERE LOWER(mt.name) = :name AND f.name = :flow',
            [':name' => 'book', ':flow' => 'Print book']
        )->queryScalar());

        $reset = $this->runSeedCommand(true);
        \PHPUnit\Framework\Assert::assertSame(0, $reset['status'], implode("\n", $reset['output']));
        \PHPUnit\Framework\Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM material_types WHERE description = :description',
            [':description' => 'Synthetic material type created by dev-seed/test-courses for the Print book flow.']
        )->queryScalar());
        \PHPUnit\Framework\Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM material_type_flows WHERE material_type_id = :type_id',
            [':type_id' => $seededBook['material_type_id']]
        )->queryScalar());
    }

    public function rerunningSeedDoesNotCreateDuplicates(FunctionalTester $I)
    {
        $service = $this->service();
        $service->seed($this->currentPeriod, $this->upcomingPeriod);
        $service->seed($this->currentPeriod, $this->upcomingPeriod);

        \PHPUnit\Framework\Assert::assertSame(9, $this->countOwnedAssignments());
        \PHPUnit\Framework\Assert::assertSame(4, $this->countOwnedPeople());
        \PHPUnit\Framework\Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM staff_groups WHERE name = :name', [':name' => 'Acquisitions']
        )->queryScalar());
        \PHPUnit\Framework\Assert::assertSame(1, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM staff_group_members m INNER JOIN staff_groups g ON g.id = m.group_id '
            . 'WHERE g.name = :name AND m.username = :username',
            [':name' => 'Acquisitions', ':username' => 'test-api078-staff']
        )->queryScalar());
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
        \PHPUnit\Framework\Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM staff_groups WHERE name = :name', [':name' => 'Acquisitions']
        )->queryScalar());
        \PHPUnit\Framework\Assert::assertSame(1, (int) \Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM course_assignments WHERE smith_id = :smithId'
        )->bindValue(':smithId', '999000078')->queryScalar());
    }

    public function resetKeepsPreExistingBookTypeAndMapping(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        $type = $db->createCommand(
            'SELECT material_type_id, name, description FROM material_types WHERE LOWER(name) = :name LIMIT 1',
            [':name' => 'book']
        )->queryOne();
        $createdType = !$type;
        if (!$type) {
            $db->createCommand()->insert('material_types', [
                'name' => 'Book',
                'description' => 'Pre-existing API-084-fr1 material type fixture.',
            ])->execute();
            $type = $db->createCommand(
                'SELECT material_type_id, name, description FROM material_types WHERE LOWER(name) = :name LIMIT 1',
                [':name' => 'book']
            )->queryOne();
        }
        $flowId = $db->createCommand(
            'SELECT id FROM flows WHERE name = :name LIMIT 1', [':name' => 'API-084-fr1 pre-existing flow fixture']
        )->queryScalar();
        $createdFlow = !$flowId;
        if (!$flowId) {
            $db->createCommand()->insert('flows', [
                'name' => 'API-084-fr1 pre-existing flow fixture',
                'description' => 'Synthetic pre-existing mapping fixture.',
                'created_by' => 'test-api084-fr1',
            ])->execute();
            $flowId = (int)$db->getLastInsertID();
        }
        $mappingRow = $db->createCommand(
            'SELECT flow_id FROM material_type_flows WHERE material_type_id = :type_id',
            [':type_id' => $type['material_type_id']]
        )->queryOne();
        $createdMapping = !$mappingRow;
        $originalFlowId = $mappingRow ? $mappingRow['flow_id'] : null;
        $mapping = $mappingRow ? $mappingRow['flow_id'] : null;
        if ($createdMapping) {
            $db->createCommand()->insert('material_type_flows', [
                'material_type_id' => $type['material_type_id'],
                'flow_id' => $flowId,
            ])->execute();
            $mapping = $flowId;
        } elseif ($mapping === null) {
            $db->createCommand()->update('material_type_flows', ['flow_id' => $flowId], [
                'material_type_id' => $type['material_type_id'],
            ])->execute();
            $mapping = $flowId;
        }
        $typeBefore = $type;

        try {
            $service = $this->service();
            $service->seed($this->currentPeriod, $this->upcomingPeriod);
            $reset = $this->runSeedCommand(true);
            \PHPUnit\Framework\Assert::assertSame(0, $reset['status'], implode("\n", $reset['output']));
            $typeAfter = $db->createCommand(
                'SELECT material_type_id, name, description FROM material_types WHERE material_type_id = :id',
                [':id' => $typeBefore['material_type_id']]
            )->queryOne();
            \PHPUnit\Framework\Assert::assertSame($typeBefore, $typeAfter);
            \PHPUnit\Framework\Assert::assertSame((string)$mapping, (string)$db->createCommand(
                'SELECT flow_id FROM material_type_flows WHERE material_type_id = :type_id',
                [':type_id' => $typeBefore['material_type_id']]
            )->queryScalar());
        } finally {
            if ($createdMapping) {
                $db->createCommand()->delete('material_type_flows', [
                    'material_type_id' => $typeBefore['material_type_id'],
                ])->execute();
            } elseif ($originalFlowId === null) {
                $db->createCommand()->update('material_type_flows', ['flow_id' => null], [
                    'material_type_id' => $typeBefore['material_type_id'],
                ])->execute();
            }
            if ($createdType) {
                $db->createCommand()->delete('material_types', [
                    'material_type_id' => $typeBefore['material_type_id'],
                ])->execute();
            }
            if ($createdFlow) {
                $db->createCommand()->delete('flows', ['id' => $flowId])->execute();
            }
        }
    }

    public function previousCourseSeedCreatesOrderedResourcesAndResetRemovesThem(FunctionalTester $I)
    {
        $service = $this->service();
        $summary = $service->seed($this->currentPeriod, $this->upcomingPeriod);
        $service->seed($this->currentPeriod, $this->upcomingPeriod);

        \PHPUnit\Framework\Assert::assertSame([
            'courseNumber' => 'TST 101',
            'termName' => 'Spring 2026',
            'electronicCount' => 4,
            'physicalCount' => 3,
        ], $summary['previousCourse']);

        $offering = \app\models\CourseOfferings::findOne([
            'folio_course_id' => '00000000-0000-4000-8000-000000000209',
        ]);
        \PHPUnit\Framework\Assert::assertNotNull($offering);
        $resources = (new \yii\db\Query())
            ->select(['r.name', 'r.item_url', 'type' => 'mt.name', 'cr.order', 'folder_name' => 'f.name'])
            ->from(['cr' => 'course_resources'])
            ->innerJoin(['r' => 'resources'], 'r.resource_id = cr.resource_id')
            ->leftJoin(['mt' => 'material_types'], 'mt.material_type_id = r.material_type_id')
            ->leftJoin(['f' => 'folders'], 'f.folder_id = cr.folder_id')
            ->where(['cr.offering_id' => $offering->offering_id])
            ->orderBy(['cr.order' => SORT_ASC])
            ->all();

        \PHPUnit\Framework\Assert::assertSame([
            ['name' => 'test-cx029-article', 'item_url' => 'https://example.test/cx029/journal-article', 'type' => 'article', 'order' => '1', 'folder_name' => 'Week 1'],
            ['name' => 'test-cx029-chapter', 'item_url' => 'https://example.test/cx029/chapter', 'type' => 'chapter', 'order' => '2', 'folder_name' => 'Week 1'],
            ['name' => 'test-cx029-website', 'item_url' => 'https://example.test/cx029/website', 'type' => 'website', 'order' => '3', 'folder_name' => null],
            ['name' => 'test-cx029-video', 'item_url' => 'https://example.test/cx029/video', 'type' => 'video', 'order' => '4', 'folder_name' => null],
        ], $resources);

        $I->amOnRoute('course/get-merged-resources', [
            'courseListingId' => '00000000-0000-4000-8000-000000000209',
        ]);
        $I->seeResponseCodeIs(200);
        $merged = $I->grabJsonResponse();
        \PHPUnit\Framework\Assert::assertSame(4, $merged['count']);
        \PHPUnit\Framework\Assert::assertSame([
            'test-cx029-article', 'test-cx029-chapter', 'test-cx029-website', 'test-cx029-video',
        ], array_column($merged['resources'], 'title'));

        $service->reset();
        \PHPUnit\Framework\Assert::assertNull(\app\models\CourseOfferings::findOne([
            'folio_course_id' => '00000000-0000-4000-8000-000000000209',
        ]));
        \PHPUnit\Framework\Assert::assertSame(0, (int)\app\models\Resources::find()
            ->where(['like', 'name', 'test-cx029-', false])->count());
        \PHPUnit\Framework\Assert::assertSame(0, (int)\app\models\Folder::find()
            ->where(['description' => 'test-cx029-previous-course-week-1'])->count());
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

    private function runSeedCommand($reset)
    {
        $currentPeriod = $this->currentPeriod;
        $upcomingPeriod = $this->upcomingPeriod;
        $controller = new class('dev-seed', \Yii::$app) extends \app\commands\DevSeedController {
            public $capturedOutput = '';
            public $capturedErrors = '';

            public function stdout($string)
            {
                $this->capturedOutput .= $string;
                return strlen($string);
            }

            public function stderr($string)
            {
                $this->capturedErrors .= $string;
                return strlen($string);
            }
        };
        $controller->reset = $reset;
        $controller->currentPeriod = $currentPeriod;
        $controller->upcomingPeriod = $upcomingPeriod;
        $status = $controller->actionTestCourses();
        return [
            'status' => $status,
            'output' => explode("\n", $controller->capturedOutput),
            'errors' => $controller->capturedErrors,
        ];
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
        $this->service()->reset();
    }
}
