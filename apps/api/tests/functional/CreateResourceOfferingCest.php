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
