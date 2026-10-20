<?php

use app\services\FolioService;
use PHPUnit\Framework\Assert;

/** Locks down the two existing course-link action response contracts for API-080. */
class Api080CourseLinkCharacterizationCest extends BaseFunctionalCest
{
    private $prefix = 'test-api080-characterization-';
    private $staffToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        \Yii::$container->set(FolioService::class, new TestApi080CharacterizationFolioService());
        $this->cleanup();
        $this->staffToken = $this->token('staff');
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        \Yii::$container->clear(FolioService::class);
    }

    public function createFromFolioKeepsItsResponseShape(FunctionalTester $I)
    {
        $suffix = bin2hex(random_bytes(4));
        $courseNumber = $this->prefix . $suffix;
        $payload = [
            'course' => [
                'course_number' => $courseNumber,
                'course_name' => 'Synthetic characterization course',
                'department_id' => 'test-api080-department',
                'department_name' => 'Synthetic Department',
                'location_id' => 'test-api080-location',
                'location_name' => 'Synthetic Library',
            ],
            'offering' => [
                'folio_course_id' => $this->prefix . 'listing-' . $suffix,
                'term_id' => $this->prefix . 'term-' . $suffix,
                'term_name' => 'Synthetic Term',
                'section_name' => '01',
            ],
        ];

        $this->post($I, 'course/create-from-folio', $payload);

        $I->seeResponseCodeIs(200);
        $response = $this->response($I);
        Assert::assertSame($courseNumber, $response['course']['course_number']);
        Assert::assertSame($payload['offering']['folio_course_id'], $response['offering']['folio_course_id']);
        Assert::assertSame($response['offering']['offering_id'], $response['offering_id']);
        Assert::assertSame($response['offering_id'], $response['current_offering_id']);
        Assert::assertArrayHasKey('latestOfferingStartDate', $response);
    }

    public function linkCourseOfferingKeepsItsResponseShape(FunctionalTester $I)
    {
        $suffix = bin2hex(random_bytes(4));
        $submissionUuid = $this->insertSubmission($suffix);
        $folioListing = TestApi080CharacterizationFolioService::listing();
        $folioListing['courseListingId'] .= '-' . $suffix;
        $folioListing['id'] = $folioListing['courseListingId'];

        $this->post($I, 'course/link-course-offering', [
            'submission_id' => $this->submissionId($submissionUuid),
            'selectedCourse' => $folioListing,
        ]);

        $I->seeResponseCodeIs(200);
        $response = $this->response($I);
        Assert::assertTrue($response['success']);
        Assert::assertSame($submissionUuid, $response['submission']['submission_uuid']);
        Assert::assertSame($folioListing['courseListingId'], $response['submission']['folio_course_listing_id']);
        Assert::assertSame($response['offering']['offering_id'], $response['submission']['offering_id']);
        Assert::assertArrayHasKey('folder_scaffold', $response);
    }

    private function post(FunctionalTester $I, $route, array $payload)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->staffToken);
        $I->sendAjaxRequest('POST', \Yii::$app->urlManager->createUrl([$route]), $payload);
    }

    private function response(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);
        Assert::assertIsArray($response);
        return $response;
    }

    private function token($role)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => 'test-api080-' . $role,
            'role' => $role,
            'id' => 'test-api080-' . $role,
            'full_name' => 'Synthetic API080 User',
            'email' => 'test-api080-' . $role . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function insertSubmission($suffix)
    {
        $uuid = $this->uuid();
        \Yii::$app->db->createCommand()->insert('faculty_submissions', [
            'submission_uuid' => $uuid,
            'shibboleth_user_id' => $this->prefix . $suffix,
            'term_code' => 'Synthetic FOLIO Term',
            'course_code' => 'TST 080',
            'section' => '01',
            'course_title' => 'test-api080-characterization-title-' . $suffix,
            'status' => 'submitted',
        ])->execute();
        return $uuid;
    }

    private function submissionId($uuid)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE submission_uuid = :uuid',
            [':uuid' => $uuid]
        )->queryScalar();
    }

    private function cleanup()
    {
        $db = \Yii::$app->db;
        $submissionIds = $db->createCommand(
            'SELECT submission_id FROM faculty_submissions WHERE shibboleth_user_id LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($submissionIds) {
            foreach (['submission_new_resources', 'submission_reuse_resources', 'submission_folders'] as $table) {
                $db->createCommand()->delete($table, ['submission_id' => $submissionIds])->execute();
            }
            $db->createCommand()->delete('faculty_submissions', ['submission_id' => $submissionIds])->execute();
        }
        $courseIds = $db->createCommand(
            'SELECT course_id FROM courses WHERE course_number LIKE :prefix',
            [':prefix' => $this->prefix . '%']
        )->queryColumn();
        if ($courseIds) {
            $db->createCommand()->delete('course_offerings', ['course_id' => $courseIds])->execute();
            $db->createCommand()->delete('courses', ['course_id' => $courseIds])->execute();
        }
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}

class TestApi080CharacterizationFolioService
{
    public function fetchCourseById($id)
    {
        $listing = self::listing();
        $listing['courseListingId'] = $id;
        $listing['id'] = $id;
        return $listing;
    }

    public function searchCourses($query)
    {
        return null;
    }

    public function searchCoursesStrict($query)
    {
        if (!preg_match('/^\(courseListingId=="([^"]+)"\)$/', $query, $matches)) {
            return null;
        }
        $listing = self::listing();
        $listing['courseListingId'] = $matches[1];
        $listing['id'] = $matches[1];
        return $listing;
    }

    public static function listing()
    {
        return [
            'id' => 'test-api080-characterization-listing',
            'courseNumber' => 'TST 080',
            'name' => 'Synthetic API080 Course',
            'departmentId' => 'test-api080-folio-department',
            'departmentObject' => ['name' => 'Synthetic FOLIO Department'],
            'courseListingId' => 'test-api080-characterization-listing',
            'courseListingObject' => [
                'termId' => 'test-api080-folio-term',
                'termObject' => [
                    'name' => 'Synthetic FOLIO Term',
                    'startDate' => '2027-01-01T00:00:00.000Z',
                    'endDate' => '2027-06-01T00:00:00.000Z',
                ],
                'locationId' => 'test-api080-folio-location',
                'locationObject' => ['name' => 'Synthetic FOLIO Location'],
            ],
            'sectionName' => '01',
        ];
    }
}
