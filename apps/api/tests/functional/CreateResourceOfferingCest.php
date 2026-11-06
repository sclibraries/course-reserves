<?php
/**
 * CreateResourceOfferingCest.php — Regression coverage for staff resource
 * creation when one course has several sections in the same term.
 *
 * Bug being guarded: POST /course/create-resource used to resolve the
 * course offering by (course_id, term_id) alone. With sections 01 and 03
 * in the same term that lookup matches both rows and returns the first,
 * so a resource added while viewing section 03 was linked to section 01.
 *
 * Ported from the standalone harness on the section hotfix branch
 * (legacy tests/regression/create_resource_offering.php) into the isolated
 * Codeception stack. Fixtures are inserted directly through the test
 * database connection and removed in _after().
 *
 * PHP 7.2 compatible — no typed properties, no arrow functions, no ??=.
 */
class CreateResourceOfferingCest extends BaseFunctionalCest
{
    /** @var \yii\db\Connection */
    private $db;

    /** Staff JWT accepted by CourseController's HttpBearerAuth. */
    private $token;

    private $courseId;
    private $termId;
    private $sectionOneOfferingId;
    private $sectionOneFolioCourseId;
    private $sectionThreeOfferingId;
    private $sectionThreeFolioCourseId;

    /** Resource names created by the tests, removed in _after(). */
    private $resourceNames = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->db = \Yii::$app->db;

        $issuedAt = time();
        $this->token = \Firebase\JWT\JWT::encode([
            'iat'      => $issuedAt,
            'exp'      => $issuedAt + 3600,
            'username' => 'sandbox.staff',
            'role'     => 'admin',
            'id'       => 0,
        ], getenv('JWT_SECRET_KEY'), 'HS256');

        $suffix = bin2hex(random_bytes(6));
        $this->termId = $this->uuid();
        $this->sectionOneFolioCourseId = $this->uuid();
        $this->sectionThreeFolioCourseId = $this->uuid();

        $this->db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $this->uuid(),
            'course_name'           => 'Offering regression ' . $suffix,
            'course_number'         => 'TEST-' . $suffix,
        ])->execute();
        $this->courseId = (int)$this->db->getLastInsertID();

        // Section 01 is inserted first so a course+term lookup returns it.
        $this->sectionOneOfferingId = $this->insertOffering($this->sectionOneFolioCourseId, '01');
        $this->sectionThreeOfferingId = $this->insertOffering($this->sectionThreeFolioCourseId, '03');
    }

    public function _after(FunctionalTester $I)
    {
        if ($this->resourceNames) {
            $resourceIds = (new \yii\db\Query())
                ->select('resource_id')
                ->from('resources')
                ->where(['name' => $this->resourceNames])
                ->column($this->db);

            if ($resourceIds) {
                foreach (['resource_metadata', 'resource_links', 'course_resources'] as $table) {
                    $this->db->createCommand()->delete($table, ['resource_id' => $resourceIds])->execute();
                }
                $this->db->createCommand()->delete('resources', ['resource_id' => $resourceIds])->execute();
            }
            $this->resourceNames = [];
        }

        if ($this->courseId) {
            $this->db->createCommand()->delete('course_offerings', ['course_id' => $this->courseId])->execute();
            $this->db->createCommand()->delete('courses', ['course_id' => $this->courseId])->execute();
        }
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    /**
     * Staff working in section 03 must get a resource linked to section 03,
     * even though section 01 shares the same course and term.
     */
    public function resourceCreatedForSectionThreeIsLinkedToSectionThree(FunctionalTester $I)
    {
        $name = $this->resourceName('selected');

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonPost('course/create-resource', $this->payload(
            $this->sectionThreeOfferingId,
            $this->sectionThreeFolioCourseId,
            $name
        ));
        $I->seeResponseCodeIs(200);

        $body = $I->grabJsonResponse();
        \PHPUnit\Framework\Assert::assertSame(
            $this->sectionThreeOfferingId,
            (int)(isset($body['course_offering']) ? $body['course_offering'] : 0),
            'Response should report the explicitly selected offering.'
        );

        $storedOfferingId = $this->db->createCommand(
            'SELECT cr.offering_id FROM course_resources cr '
            . 'JOIN resources r ON r.resource_id = cr.resource_id WHERE r.name = :name',
            [':name' => $name]
        )->queryScalar();
        \PHPUnit\Framework\Assert::assertSame(
            $this->sectionThreeOfferingId,
            (int)$storedOfferingId,
            'Stored course_resources row should point at the selected offering.'
        );
    }

    /**
     * An offering that does not match the FOLIO listing in the request is a
     * client error, not a silent link to whichever offering was found first.
     */
    public function offeringThatDoesNotMatchFolioListingIsRejected(FunctionalTester $I)
    {
        $name = $this->resourceName('mismatch');

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonPost('course/create-resource', $this->payload(
            $this->sectionOneOfferingId,
            $this->sectionThreeFolioCourseId,
            $name
        ));
        $I->seeResponseCodeIs(400);
        $this->assertNoResourceNamed($name);
    }

    /**
     * Without an explicit offering the request cannot be resolved safely.
     */
    public function missingOfferingIdIsRejected(FunctionalTester $I)
    {
        $name = $this->resourceName('missing');
        $payload = $this->payload($this->sectionThreeOfferingId, $this->sectionThreeFolioCourseId, $name);
        unset($payload['offering_id']);

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonPost('course/create-resource', $payload);
        $I->seeResponseCodeIs(400);
        $this->assertNoResourceNamed($name);
    }

    public function createAndEditResourceVisibilityAndLinkSettings(FunctionalTester $I)
    {
        $name = $this->resourceName('visibility');
        $payload = $this->payload($this->sectionThreeOfferingId, $this->sectionThreeFolioCourseId, $name);
        $payload['start_visibility'] = '2027-01-01';
        $payload['end_visibility'] = '2027-12-31';
        $payload['primary_link_start_visibility'] = '2027-02-01';
        $payload['primary_link_end_visibility'] = '2027-11-30';
        $payload['use_resource_visibility'] = 1;
        $payload['use_primary_link_visibility'] = 1;
        $payload['links'] = [[
            'url' => 'https://links.example.test/api127b-create',
            'use_link_visibility' => 1,
            'start_visibility' => '2027-03-01',
            'end_visibility' => '2027-10-31',
        ]];

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonPost('course/create-resource', $payload);
        $I->seeResponseCodeIs(200);

        $resourceId = (int)$this->db->createCommand(
            'SELECT resource_id FROM resources WHERE name = :name', [':name' => $name]
        )->queryScalar();
        $resource = $this->db->createCommand(
            'SELECT start_visibility, end_visibility FROM resources WHERE resource_id = :id', [':id' => $resourceId]
        )->queryOne();
        $link = $this->db->createCommand(
            'SELECT use_link_visibility, start_visibility, end_visibility FROM resource_links WHERE resource_id = :id',
            [':id' => $resourceId]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertSame('2027-01-01', $resource['start_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-12-31', $resource['end_visibility']);
        \PHPUnit\Framework\Assert::assertSame(1, (int)$link['use_link_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-03-01', $link['start_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-10-31', $link['end_visibility']);

        $I->sendJsonRequest('PUT', 'resource/update', [
            'start_visibility' => null,
            'primary_link_start_visibility' => '',
            'use_resource_visibility' => null,
            'links' => [[
                'url' => 'https://links.example.test/api127b-create',
                'use_link_visibility' => '0',
                'start_visibility' => '2027-04-01',
                'end_visibility' => '2027-09-30',
            ]],
        ], ['id' => $resourceId]);
        $I->seeResponseCodeIs(200);

        $association = $this->db->createCommand(
            'SELECT start_visibility, end_visibility, use_resource_visibility, '
            . 'primary_link_start_visibility, primary_link_end_visibility, use_primary_link_visibility '
            . 'FROM course_resources WHERE resource_id = :id',
            [':id' => $resourceId]
        )->queryOne();
        $link = $this->db->createCommand(
            'SELECT use_link_visibility, start_visibility, end_visibility FROM resource_links WHERE resource_id = :id',
            [':id' => $resourceId]
        )->queryOne();
        $resource = $this->db->createCommand(
            'SELECT start_visibility, end_visibility FROM resources WHERE resource_id = :id', [':id' => $resourceId]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertNull($association['start_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-12-31', $association['end_visibility']);
        \PHPUnit\Framework\Assert::assertSame(1, (int)$association['use_resource_visibility']);
        \PHPUnit\Framework\Assert::assertNull($association['primary_link_start_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-11-30', $association['primary_link_end_visibility']);
        \PHPUnit\Framework\Assert::assertSame(1, (int)$association['use_primary_link_visibility']);
        \PHPUnit\Framework\Assert::assertSame(0, (int)$link['use_link_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-04-01', $link['start_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-09-30', $link['end_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-01-01', $resource['start_visibility']);
        \PHPUnit\Framework\Assert::assertSame('2027-12-31', $resource['end_visibility']);

        $I->sendJsonRequest('PUT', 'resource/update', [
            'end_visibility' => '',
            'use_resource_visibility' => 0,
        ], ['id' => $resourceId]);
        $I->seeResponseCodeIs(200);
        $association = $this->db->createCommand(
            'SELECT end_visibility, use_resource_visibility FROM course_resources WHERE resource_id = :id',
            [':id' => $resourceId]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertNull($association['end_visibility']);
        \PHPUnit\Framework\Assert::assertSame(0, (int)$association['use_resource_visibility']);
    }

    public function invalidLaterAdditionalLinkRollsBackResourceCreation(FunctionalTester $I)
    {
        $name = $this->resourceName('invalid-link');
        $payload = $this->payload($this->sectionThreeOfferingId, $this->sectionThreeFolioCourseId, $name);
        $payload['links'] = [
            ['url' => 'https://links.example.test/api127b-valid'],
            'invalid link object',
        ];

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonPost('course/create-resource', $payload);
        $I->seeResponseCodeIs(400);

        $counts = $this->db->createCommand(
            'SELECT COUNT(DISTINCT r.resource_id) AS resources, COUNT(DISTINCT rl.link_id) AS links, '
            . 'COUNT(DISTINCT cr.course_resource_id) AS associations FROM resources r '
            . 'LEFT JOIN resource_links rl ON rl.resource_id = r.resource_id '
            . 'LEFT JOIN course_resources cr ON cr.resource_id = r.resource_id WHERE r.name = :name',
            [':name' => $name]
        )->queryOne();
        \PHPUnit\Framework\Assert::assertSame(0, (int)$counts['resources']);
        \PHPUnit\Framework\Assert::assertSame(0, (int)$counts['links']);
        \PHPUnit\Framework\Assert::assertSame(0, (int)$counts['associations']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function payload($offeringId, $folioCourseId, $title)
    {
        return [
            'courseId'    => $this->courseId,
            'offering_id' => $offeringId,
            'title'       => $title,
            'link'        => 'https://example.test/resource',
            'folioData'   => [
                'courseListingId'     => $folioCourseId,
                'courseListingObject' => ['termId' => $this->termId],
            ],
        ];
    }

    private function insertOffering($folioCourseId, $sectionName)
    {
        $this->db->createCommand()->insert('course_offerings', [
            'offering_uuid'   => $this->uuid(),
            'course_id'       => $this->courseId,
            'folio_course_id' => $folioCourseId,
            'term_id'         => $this->termId,
            'term_name'       => 'Regression term',
            'section_name'    => $sectionName,
        ])->execute();

        return (int)$this->db->getLastInsertID();
    }

    private function resourceName($label)
    {
        $name = 'offering-regression-' . $label . '-' . bin2hex(random_bytes(4));
        $this->resourceNames[] = $name;

        return $name;
    }

    private function assertNoResourceNamed($name)
    {
        $count = (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM resources WHERE name = :name',
            [':name' => $name]
        )->queryScalar();
        \PHPUnit\Framework\Assert::assertSame(0, $count, 'Rejected request must not create a resource.');
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
