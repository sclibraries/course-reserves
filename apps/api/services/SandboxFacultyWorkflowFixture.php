<?php

namespace app\services;

use app\models\FacultySubmission;
use app\models\MaterialTypes;
use app\models\SubmissionFolder;
use app\models\SubmissionNewResource;
use app\models\CourseAssignments;
use Yii;

class SandboxFacultyWorkflowFixture
{
    const SUBMISSION_UUID = '11111111-1111-4111-8111-111111111111';
    const FACULTY_USER_ID = 'sandbox.faculty@example.test';
    const FACULTY_INTERNAL_ID = '999000001';
    const FACULTY_DISPLAY_NAME = 'Sandbox Faculty';
    const COURSE_NUMBER = 'TST 101';
    const COURSE_TITLE = 'Sandbox Course Reserves Workflow';
    const COURSE_ASSIGNMENT_ID = 'TST-101-01-202603';
    const ACADEMIC_PERIOD = 'AP_202603';
    const TERM_CODE = 'SANDBOX-2026';
    const TERM_NAME = 'Sandbox Term 2026';
    const FOLIO_COURSE_ID = 'sandbox-folio-course-001';
    const FOLIO_COURSE_LISTING_ID = 'sandbox-folio-course-001';
    const FOLIO_TERM_ID = 'sandbox-term-2026';
    const DEPARTMENT_ID = 'sandbox-department';
    const DEPARTMENT_NAME = 'Sandbox Department';
    const LOCATION_ID = 'sandbox-reserve-desk';
    const LOCATION_NAME = 'Sandbox Reserve Desk';
    const SECTION_NAME = '01';
    const PERMANENT_COURSE_UUID = '22222222-2222-4222-8222-222222222222';

    private $folderNames = [
        'Sandbox Week 1',
        'Sandbox Visibility Window',
    ];

    public function getFolioCourse()
    {
        return [
            'id' => self::FOLIO_COURSE_ID,
            'courseNumber' => self::COURSE_NUMBER,
            'name' => self::COURSE_TITLE,
            'departmentId' => self::DEPARTMENT_ID,
            'departmentObject' => [
                'id' => self::DEPARTMENT_ID,
                'name' => self::DEPARTMENT_NAME,
            ],
            'courseListingId' => self::FOLIO_COURSE_LISTING_ID,
            'courseListingObject' => [
                'id' => self::FOLIO_COURSE_LISTING_ID,
                'termId' => self::FOLIO_TERM_ID,
                'termObject' => [
                    'id' => self::FOLIO_TERM_ID,
                    'name' => self::TERM_NAME,
                    'startDate' => '2026-01-01T00:00:00.000+00:00',
                    'endDate' => '2026-12-31T23:59:59.000+00:00',
                ],
                'locationId' => self::LOCATION_ID,
                'locationObject' => [
                    'id' => self::LOCATION_ID,
                    'name' => self::LOCATION_NAME,
                ],
                'instructorObjects' => [
                    [
                        'id' => self::FACULTY_USER_ID,
                        'name' => self::FACULTY_DISPLAY_NAME,
                    ],
                ],
            ],
            'sectionName' => self::SECTION_NAME,
        ];
    }

    public function isSandboxIdentifier($value)
    {
        return in_array($value, [
            self::SUBMISSION_UUID,
            self::FACULTY_USER_ID,
            self::FACULTY_INTERNAL_ID,
            self::COURSE_NUMBER,
            self::COURSE_TITLE,
            self::COURSE_ASSIGNMENT_ID,
            self::ACADEMIC_PERIOD,
            self::TERM_CODE,
            self::FOLIO_COURSE_ID,
            self::FOLIO_COURSE_LISTING_ID,
            self::FOLIO_TERM_ID,
            self::DEPARTMENT_ID,
            self::LOCATION_ID,
            self::PERMANENT_COURSE_UUID,
        ], true);
    }

    public function getCourseAssignment()
    {
        return [
            'academic_period' => self::ACADEMIC_PERIOD,
            'course_id' => self::COURSE_ASSIGNMENT_ID,
            'course_title' => self::COURSE_TITLE,
            'smith_id' => self::FACULTY_INTERNAL_ID,
            'role' => 'Instructor',
        ];
    }

    public function matchesSearchQuery($query)
    {
        if (!$query) {
            return false;
        }

        return strpos($query, self::FOLIO_COURSE_LISTING_ID) !== false ||
            strpos($query, self::FOLIO_COURSE_ID) !== false ||
            strpos($query, self::COURSE_NUMBER) !== false ||
            strpos($query, self::COURSE_TITLE) !== false;
    }

    public function getSearchCoursesResponse($query = null)
    {
        $courses = $this->matchesSearchQuery($query) || $query === null
            ? [$this->getFolioCourse()]
            : [];

        return [
            'message' => 'success',
            'code' => 200,
            'data' => [
                'courses' => $courses,
                'totalRecords' => count($courses),
            ],
        ];
    }

    public function seed()
    {
        $db = Yii::$app->db;
        $transaction = $db->beginTransaction();

        try {
            $this->reset(false);

            $submission = new FacultySubmission();
            $submission->submission_uuid = self::SUBMISSION_UUID;
            $submission->shibboleth_user_id = self::FACULTY_USER_ID;
            $submission->term_code = self::TERM_CODE;
            $submission->course_code = self::COURSE_NUMBER;
            $submission->section = self::SECTION_NAME;
            $submission->course_title = self::COURSE_TITLE;
            $submission->status = FacultySubmission::STATUS_SUBMITTED;
            $submission->faculty_display_name = self::FACULTY_DISPLAY_NAME;
            $submission->submission_notes = 'Sandbox faculty workflow fixture. Safe to reset.';

            if (!$submission->save()) {
                throw new \RuntimeException('Unable to create sandbox submission: ' . json_encode($submission->getErrors()));
            }

            foreach ($this->folderNames as $index => $folderName) {
                $folder = new SubmissionFolder();
                $folder->submission_id = $submission->submission_id;
                $folder->folder_name = $folderName;
                $folder->display_order = $index + 1;
                if (!$folder->save()) {
                    throw new \RuntimeException('Unable to create sandbox folder: ' . json_encode($folder->getErrors()));
                }
            }

            foreach ($this->getNewResourceFixtures() as $fixture) {
                $item = new SubmissionNewResource();
                $item->submission_id = $submission->submission_id;
                $item->material_type_id = $this->findMaterialTypeId($fixture['materialType']);
                $item->setResourceDataFromArray($fixture['resourceData']);
                $item->display_order = $fixture['displayOrder'];
                $item->folder_name = isset($fixture['folderName']) ? $fixture['folderName'] : null;
                $item->position_in_folder = isset($fixture['positionInFolder']) ? $fixture['positionInFolder'] : null;
                $item->source_barcode = isset($fixture['sourceBarcode']) ? $fixture['sourceBarcode'] : null;
                $item->source_call_number = isset($fixture['sourceCallNumber']) ? $fixture['sourceCallNumber'] : null;
                $item->source_folio_instance_id = isset($fixture['sourceFolioInstanceId']) ? $fixture['sourceFolioInstanceId'] : null;
                $item->faculty_notes = $fixture['facultyNotes'];
                $item->priority = $fixture['priority'];
                $item->item_status = 'pending';

                if (!$item->save()) {
                    throw new \RuntimeException('Unable to create sandbox resource item: ' . json_encode($item->getErrors()));
                }
            }

            $assignment = new CourseAssignments();
            $assignment->setAttributes($this->getCourseAssignment(), false);
            if (!$assignment->save()) {
                throw new \RuntimeException('Unable to create sandbox course assignment: ' . json_encode($assignment->getErrors()));
            }

            $transaction->commit();

            return $this->getSummary();
        } catch (\Throwable $exception) {
            $transaction->rollBack();
            throw $exception;
        }
    }

    public function reset($useTransaction = true)
    {
        $db = Yii::$app->db;
        $transaction = $useTransaction ? $db->beginTransaction() : null;

        try {
            $submissionIds = $this->getSandboxSubmissionIds();
            if ($submissionIds) {
                $db->createCommand()->delete('submission_new_resources', ['submission_id' => $submissionIds])->execute();
                $db->createCommand()->delete('submission_folders', ['submission_id' => $submissionIds])->execute();
                $this->deleteIfTableExists('submission_workflow_assignments', ['submission_id' => $submissionIds]);
                $this->deleteIfTableExists('submission_communications', ['submission_id' => $submissionIds]);
                $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
            }

            $db->createCommand()->delete('course_assignments', [
                'or',
                ['smith_id' => self::FACULTY_INTERNAL_ID],
                ['course_id' => self::COURSE_ASSIGNMENT_ID],
            ])->execute();

            $offeringIds = $this->getSandboxOfferingIds();
            if ($offeringIds) {
                $resourceIds = $this->getSandboxCourseResourceIds($offeringIds);
                $db->createCommand()->delete('course_resources', ['offering_id' => $offeringIds])->execute();
                $db->createCommand()->delete('physical_resource_references', ['offering_id' => $offeringIds])->execute();
                if ($resourceIds) {
                    $db->createCommand()->delete('resources', ['resource_id' => $resourceIds])->execute();
                }
                $db->createCommand()->delete('course_offerings', ['offering_id' => $offeringIds])->execute();
            }

            $folderIds = (new \yii\db\Query())
                ->select('folder_id')
                ->from('folders')
                ->where(['name' => $this->folderNames])
                ->column($db);
            if ($folderIds) {
                $db->createCommand()->delete('folders', ['folder_id' => $folderIds])->execute();
            }

            $db->createCommand()->delete('courses', [
                'or',
                ['permanent_course_uuid' => self::PERMANENT_COURSE_UUID],
                ['course_number' => self::COURSE_NUMBER],
            ])->execute();

            if ($transaction) {
                $transaction->commit();
            }

            return ['deleted' => true];
        } catch (\Throwable $exception) {
            if ($transaction) {
                $transaction->rollBack();
            }
            throw $exception;
        }
    }

    public function getSummary()
    {
        return [
            'submissionUuid' => self::SUBMISSION_UUID,
            'facultyUserId' => self::FACULTY_USER_ID,
            'facultyInternalId' => self::FACULTY_INTERNAL_ID,
            'courseNumber' => self::COURSE_NUMBER,
            'courseTitle' => self::COURSE_TITLE,
            'termCode' => self::TERM_CODE,
            'folioCourseListingId' => self::FOLIO_COURSE_LISTING_ID,
            'resourceCount' => count($this->getNewResourceFixtures()),
            'folders' => $this->folderNames,
        ];
    }

    private function getNewResourceFixtures()
    {
        return [
            [
                'materialType' => 'Article',
                'displayOrder' => 1,
                'folderName' => 'Sandbox Week 1',
                'positionInFolder' => 1,
                'priority' => SubmissionNewResource::PRIORITY_HIGH,
                'facultyNotes' => 'Faculty wants this article first in the Week 1 folder.',
                'resourceData' => [
                    'title' => 'Sandbox Climate Change Article',
                    'authors' => 'Alex Example',
                    'materialType' => 'article',
                    'url' => 'https://sandbox.example.test/articles/climate-change',
                    'doi' => '10.5555/sandbox-climate',
                ],
            ],
            [
                'materialType' => 'Website',
                'displayOrder' => 2,
                'priority' => SubmissionNewResource::PRIORITY_MEDIUM,
                'facultyNotes' => 'Manual electronic item with no folder.',
                'resourceData' => [
                    'title' => 'Sandbox Open Web Resource',
                    'authors' => 'Open Author',
                    'materialType' => 'website',
                    'url' => 'https://sandbox.example.test/open-web-resource',
                ],
            ],
            [
                'materialType' => 'Book',
                'displayOrder' => 3,
                'folderName' => 'Sandbox Week 1',
                'positionInFolder' => 2,
                'priority' => SubmissionNewResource::PRIORITY_MEDIUM,
                'sourceBarcode' => 'sandbox-barcode-0001',
                'sourceCallNumber' => 'TST 101 .S26 2026',
                'sourceFolioInstanceId' => 'sandbox-instance-0001',
                'facultyNotes' => 'Physical item staff can use to test pull/order decisions.',
                'resourceData' => [
                    'title' => 'Sandbox Physical Book',
                    'authors' => 'Print Author',
                    'materialType' => 'book',
                    'isbn' => '9780000000000',
                ],
            ],
            [
                'materialType' => 'Video',
                'displayOrder' => 4,
                'folderName' => 'Sandbox Visibility Window',
                'positionInFolder' => 1,
                'priority' => SubmissionNewResource::PRIORITY_LOW,
                'facultyNotes' => 'Item includes requested student visibility dates.',
                'resourceData' => [
                    'title' => 'Sandbox Timed Visibility Video',
                    'authors' => 'Media Author',
                    'materialType' => 'video',
                    'url' => 'https://sandbox.example.test/video/timed-visibility',
                    'displayStartDate' => '2026-09-01',
                    'displayEndDate' => '2026-12-15',
                ],
            ],
        ];
    }

    private function findMaterialTypeId($name)
    {
        $materialType = MaterialTypes::find()
            ->where(['like', 'name', $name])
            ->one();

        if (!$materialType) {
            $materialType = MaterialTypes::find()
                ->orderBy(['material_type_id' => SORT_ASC])
                ->one();
        }

        return $materialType ? $materialType->material_type_id : null;
    }

    private function getSandboxSubmissionIds()
    {
        return (new \yii\db\Query())
            ->select('submission_id')
            ->from('faculty_submissions')
            ->where([
                'or',
                ['submission_uuid' => self::SUBMISSION_UUID],
                [
                    'and',
                    ['shibboleth_user_id' => self::FACULTY_USER_ID],
                    ['term_code' => self::TERM_CODE],
                    ['course_code' => self::COURSE_NUMBER],
                ],
            ])
            ->column(Yii::$app->db);
    }

    private function getSandboxOfferingIds()
    {
        return (new \yii\db\Query())
            ->select('offering_id')
            ->from('course_offerings')
            ->where(['folio_course_id' => self::FOLIO_COURSE_LISTING_ID])
            ->column(Yii::$app->db);
    }

    private function getSandboxCourseResourceIds($offeringIds)
    {
        return (new \yii\db\Query())
            ->select('resource_id')
            ->from('course_resources')
            ->where(['offering_id' => $offeringIds])
            ->column(Yii::$app->db);
    }

    private function deleteIfTableExists($tableName, $condition)
    {
        if (Yii::$app->db->schema->getTableSchema($tableName, true) === null) {
            return;
        }

        Yii::$app->db->createCommand()->delete($tableName, $condition)->execute();
    }
}
