<?php

/**
 * Public resource endpoints expose staff notes only to valid staff tokens.
 * All rows are synthetic and removed after the test.
 *
 * PHP 7.2 compatible.
 */
class PublicResourceFieldsCest extends BaseFunctionalCest
{
    private $db;
    private $courseId;
    private $offeringId;
    private $resourceId;
    private $courseListingId;
    private $resourceName;
    private $staffNote = 'API-057 synthetic staff-only note';
    private $facultyToken;
    private $staffToken;
    private $invalidToken = 'garbage.jwt.token';
    private $expiredToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->db = \Yii::$app->db;
        $suffix = bin2hex(random_bytes(6));
        $this->courseListingId = 'api057-listing-' . $suffix;
        $this->resourceName = 'API-057 synthetic resource ' . $suffix;

        $this->db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $this->uuid(),
            'course_name' => 'API-057 synthetic course ' . $suffix,
            'course_number' => 'TEST-API057-' . $suffix,
        ])->execute();
        $this->courseId = (int)$this->db->getLastInsertID();

        $this->db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $this->courseId,
            'folio_course_id' => $this->courseListingId,
            'term_id' => 'api057-term-' . $suffix,
            'term_name' => 'API-057 synthetic term',
            'section_name' => '01',
        ])->execute();
        $this->offeringId = (int)$this->db->getLastInsertID();

        $this->db->createCommand()->insert('resources', [
            'name' => $this->resourceName,
            'item_url' => 'https://example.test/api057-resource',
            'description' => 'API-057 public description',
            'external_note' => 'API-057 public note',
            'internal_note' => $this->staffNote,
        ])->execute();
        $this->resourceId = (int)$this->db->getLastInsertID();

        $this->db->createCommand()->insert('course_resources', [
            'offering_id' => $this->offeringId,
            'resource_id' => $this->resourceId,
            'order' => 7,
        ])->execute();
        $this->db->createCommand()->insert('resource_metadata', [
            'resource_id' => $this->resourceId,
            'field_name' => 'api057_fixture',
            'field_value' => 'preserved',
        ])->execute();
        $this->db->createCommand()->insert('resource_links', [
            'resource_id' => $this->resourceId,
            'url' => 'https://example.test/api057-secondary',
            'title' => 'API-057 synthetic secondary link',
            'order' => 3,
        ])->execute();
        $this->db->createCommand()->insert('physical_resource_references', [
            'external_resource_id' => 'api057-physical-' . $suffix,
            'resource_type' => 'physical',
            'display_name' => 'API-057 synthetic physical reserve',
            'offering_id' => $this->offeringId,
            'order' => 8,
        ])->execute();

        $issuedAt = time();
        $this->facultyToken = $this->token('faculty', $issuedAt, $issuedAt + 3600);
        $this->staffToken = $this->token('staff', $issuedAt, $issuedAt + 3600);
        $this->expiredToken = $this->token('staff', $issuedAt - 3600, $issuedAt - 1);
    }

    public function _after(FunctionalTester $I)
    {
        if ($this->resourceId) {
            $this->db->createCommand()->delete('resources', ['resource_id' => $this->resourceId])->execute();
        }
        if ($this->courseId) {
            $this->db->createCommand()->delete('courses', ['course_id' => $this->courseId])->execute();
        }
    }

    public function internalNoteIsVisibleOnlyToValidStaffOnEveryPublicResourceRoute(FunctionalTester $I)
    {
        $routes = [
            ['course/resources', ['offeringId' => $this->offeringId]],
            ['course/get-resources', ['courseListingId' => $this->courseListingId]],
            ['course/get-merged-resources', ['courseListingId' => $this->courseListingId]],
            ['course/search-resources', ['search' => $this->resourceName]],
            ['resource/index', []],
            ['resource/view', ['id' => $this->resourceId]],
            ['resource/search', ['name' => $this->resourceName]],
        ];

        foreach ($routes as $route) {
            $I->deleteHeader('Authorization');
            $anonymous = $this->request($I, $route);
            \PHPUnit\Framework\Assert::assertFalse(
                $this->hasInternalNoteKey($anonymous),
                $route[0] . ' must omit internal_note for anonymous callers.'
            );

            $faculty = $this->request($I, $route, $this->facultyToken);
            \PHPUnit\Framework\Assert::assertFalse(
                $this->hasInternalNoteKey($faculty),
                $route[0] . ' must omit internal_note for faculty callers.'
            );

            $staff = $this->request($I, $route, $this->staffToken);
            \PHPUnit\Framework\Assert::assertTrue(
                $this->hasInternalNoteValue($staff, $this->staffNote),
                $route[0] . ' must preserve internal_note for valid staff callers.'
            );

            $invalid = $this->request($I, $route, $this->invalidToken);
            \PHPUnit\Framework\Assert::assertFalse(
                $this->hasInternalNoteKey($invalid),
                $route[0] . ' must treat an invalid token as anonymous and omit internal_note.'
            );

            $expired = $this->request($I, $route, $this->expiredToken);
            \PHPUnit\Framework\Assert::assertFalse(
                $this->hasInternalNoteKey($expired),
                $route[0] . ' must treat an expired token as anonymous and omit internal_note.'
            );
        }
    }

    private function request(FunctionalTester $I, array $route, $token = null)
    {
        // Codeception reuses the Yii application between requests; start each as a fresh HTTP request.
        \Yii::$app->user->logout(false);
        if ($token !== null) {
            $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        } else {
            $I->deleteHeader('Authorization');
        }

        $I->amOnRoute($route[0], $route[1]);
        $I->seeResponseCodeIs(200);

        return $I->grabJsonResponse();
    }

    private function hasInternalNoteKey($value)
    {
        if (!is_array($value)) {
            return false;
        }
        if (array_key_exists('internal_note', $value)) {
            return true;
        }
        foreach ($value as $child) {
            if ($this->hasInternalNoteKey($child)) {
                return true;
            }
        }

        return false;
    }

    private function hasInternalNoteValue($value, $expected)
    {
        if (!is_array($value)) {
            return false;
        }
        if (isset($value['internal_note']) && $value['internal_note'] === $expected) {
            return true;
        }
        foreach ($value as $child) {
            if ($this->hasInternalNoteValue($child, $expected)) {
                return true;
            }
        }

        return false;
    }

    private function token($role, $issuedAt, $expiresAt)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $expiresAt,
            'username' => 'test-api057-' . $role,
            'role' => $role,
            'id' => 999000057,
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
