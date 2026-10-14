<?php

namespace tests\unit\services;

use app\services\CourseRosterService;
use Yii;

class CourseRosterServiceTest extends \Codeception\Test\Unit
{
    private $terms = [
        [
            'id' => 'test-folio-term-2099',
            'name' => 'Fall 2099',
            'startDate' => '2099-01-01',
            'endDate' => '2099-12-31',
        ],
    ];

    public function testParseCourseIdKeepsTheInstructorCoursesResponseFormat()
    {
        $service = new CourseRosterService();

        $this->assertSame(
            [
                'courseNumber' => 'AFR 155',
                'sectionName' => '01',
                'raw' => 'AFR-155-01-209901',
            ],
            $service->parseCourseId('AFR-155-01-209901')
        );
    }

    public function testAcademicPeriodMapsToTheFolioTermCoveringItsDate()
    {
        $service = new CourseRosterService();

        $this->assertSame(
            $this->terms[0],
            $service->mapAcademicPeriodToTerm('AP_209901', $this->terms)
        );
        $this->assertNull(
            $service->mapAcademicPeriodToTerm('AP_202601', $this->terms)
        );
    }

    public function testRosterMatchNormalizesSpacingButRejectsCrossListedCodes()
    {
        $service = new CourseRosterService();
        $assignment = [
            'academic_period' => 'AP_209901',
            'course_id' => 'AFR-155-01-209901',
        ];

        $this->assertTrue(
            $service->isAssignmentForCourse(
                $assignment,
                'Fall 2099',
                ' AFR   155 ',
                ' 01 ',
                $this->terms
            )
        );
        $this->assertFalse(
            $service->isAssignmentForCourse(
                $assignment,
                'Fall 2099',
                'TST 155',
                '01',
                $this->terms
            )
        );
        $this->assertFalse(
            $service->isAssignmentForCourse(
                $assignment,
                'Fall 2099',
                'AFR 155',
                '1',
                $this->terms
            )
        );
    }

    protected function _before()
    {
        Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => ['999000151', '999000152'],
        ])->execute();
    }

    protected function _after()
    {
        Yii::$app->db->createCommand()->delete('course_assignments', [
            'smith_id' => ['999000151', '999000152'],
        ])->execute();
    }

    public function testRosterLookupRequiresMatchingInstructorSmithIdAndRole()
    {
        $this->insertAssignment('999000151', 'Instructor');
        $this->insertAssignment('999000152', 'Student');
        $service = new CourseRosterService(new TestCourseRosterTermsService($this->terms));

        $this->assertTrue($service->isInstructorRostered('999000151', 'Fall 2099', 'AFR 155', '01'));
        $this->assertFalse($service->isInstructorRostered('999000152', 'Fall 2099', 'AFR 155', '01'));
        $this->assertFalse($service->isInstructorRostered('', 'Fall 2099', 'AFR 155', '01'));
    }

    private function insertAssignment($smithId, $role)
    {
        Yii::$app->db->createCommand()->insert('course_assignments', [
            'academic_period' => 'AP_209901',
            'course_id' => 'AFR-155-01-209901',
            'course_title' => 'Synthetic course roster helper test',
            'smith_id' => $smithId,
            'role' => $role,
        ])->execute();
    }
}

class TestCourseRosterTermsService
{
    private $terms;

    public function __construct(array $terms)
    {
        $this->terms = $terms;
    }

    public function searchTerms()
    {
        return $this->terms;
    }
}
