<?php

use PHPUnit\Framework\Assert;

/**
 * Linked-course routes keep public resources student-safe and require staff access
 * for internal lookup actions. All records are synthetic and removed after each test.
 */
class Api112OfferingLinkPrivacyCest extends BaseFunctionalCest
{
    private $db;
    private $sourceCourseId;
    private $targetCourseId;
    private $sourceOfferingId;
    private $targetOfferingId;
    private $courseListingId;
    private $courseListingIdForTarget;
    private $suffix;
    private $resourceIds = [];
    private $folderId;
    private $materialTypeId;
    private $staffNote = 'API-112 synthetic internal note';
    private $facultyToken;
    private $staffToken;
    private $adminToken;
    private $invalidToken = 'garbage.jwt.token';
    private $expiredToken;
    private $originalUrlManager;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->loadProductionRouter();
        $this->db = \Yii::$app->db;

        $this->suffix = bin2hex(random_bytes(6));
        $this->insertCourseAndOffering($this->suffix, 'source');
        $this->insertCourseAndOffering($this->suffix, 'target');
        $this->db->createCommand()->insert('offering_links', [
            'offering_id' => $this->sourceOfferingId,
            'linked_offering_id' => $this->targetOfferingId,
        ])->execute();

        $this->db->createCommand()->insert('folders', [
            'name' => 'API-112 synthetic folder ' . $this->suffix,
        ])->execute();
        $this->folderId = (int)$this->db->getLastInsertID();
        $this->db->createCommand()->insert('material_types', [
            'name' => 'API-112 synthetic type ' . $this->suffix,
        ])->execute();
        $this->materialTypeId = (int)$this->db->getLastInsertID();

        $this->insertResource($this->suffix, 'first', $this->staffNote, 4);
        $this->insertResource($this->suffix, 'second', 'API-112 synthetic second note', 8);

        $issuedAt = time();
        $this->facultyToken = $this->token('faculty', $issuedAt, $issuedAt + 3600);
        $this->staffToken = $this->token('staff', $issuedAt, $issuedAt + 3600);
        $this->adminToken = $this->token('admin', $issuedAt, $issuedAt + 3600);
        $this->expiredToken = $this->token('staff', $issuedAt - 3600, $issuedAt - 1);
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        if ($this->originalUrlManager !== null) {
            \Yii::$app->set('urlManager', $this->originalUrlManager);
            $this->originalUrlManager = null;
        }
    }

    public function linkedCoursePageKeepsItsEnvelopeAndOnlyExposesStaffNotesToStaff(FunctionalTester $I)
    {
        $path = '/offering-link/get-linked-resources?courseListingId=' . $this->courseListingId;
        $publicCallers = [
            ['anonymous', null],
            ['faculty', $this->facultyToken],
            ['invalid token', $this->invalidToken],
            ['expired token', $this->expiredToken],
        ];

        foreach ($publicCallers as $caller) {
            list($status, $response) = $this->request($I, $path, $caller[1]);
            Assert::assertSame(200, $status, $caller[0] . ' must retain public course access.');
            $this->assertLinkedResourceContract($response);
            Assert::assertFalse(
                $this->containsKey($response, 'internal_note'),
                $caller[0] . ' must never receive internal_note anywhere in the response.'
            );
        }

        foreach (['staff' => $this->staffToken, 'admin' => $this->adminToken] as $role => $token) {
            list($status, $response) = $this->request($I, $path, $token);
            Assert::assertSame(200, $status, $role . ' must retain linked-course access.');
            $this->assertLinkedResourceContract($response);
            Assert::assertTrue(
                $this->containsKeyValue($response, 'internal_note', $this->staffNote),
                $role . ' may receive internal_note through the existing staff serializer fields.'
            );
            foreach (['faculty_notes', 'staff_notes', 'public_note'] as $field) {
                Assert::assertFalse($this->containsKey($response, $field), $role . ' must not receive ' . $field . '.');
            }
        }
    }

    public function internalOfferingLookupsRequireStaffAndSerializeResources(FunctionalTester $I)
    {
        $routes = [
            '/offering-link/find-linked-resources?offering_id=' . $this->targetOfferingId,
            '/offering-link/find-links?offering_id=' . $this->sourceOfferingId,
        ];
        $deniedCallers = [
            ['anonymous', null, 401],
            ['faculty', $this->facultyToken, 403],
            ['invalid token', $this->invalidToken, 401],
            ['expired token', $this->expiredToken, 401],
        ];

        foreach ($routes as $path) {
            foreach ($deniedCallers as $caller) {
                list($status, $response) = $this->request($I, $path, $caller[1]);
                Assert::assertSame($caller[2], $status, $path . ' must deny ' . $caller[0] . '.');
                Assert::assertFalse($this->containsKey($response, 'internal_note'));
            }

            foreach (['staff' => $this->staffToken, 'admin' => $this->adminToken] as $role => $token) {
                list($status, $response) = $this->request($I, $path, $token);
                Assert::assertSame(200, $status, $path . ' must allow ' . $role . '.');
                Assert::assertFalse($this->containsKey($response, 'faculty_notes'));
                Assert::assertFalse($this->containsKey($response, 'staff_notes'));
                Assert::assertFalse($this->containsKey($response, 'public_note'));

                if (strpos($path, '/find-linked-resources?') !== false) {
                    Assert::assertSame($this->resourceIds, $this->resourceIdsFrom($response));
                    Assert::assertTrue($this->containsKeyValue($response, 'internal_note', $this->staffNote));
                } else {
                    Assert::assertCount(1, $response);
                    Assert::assertSame((string)$this->sourceOfferingId, (string)$response[0]['offering_id']);
                }
            }
        }
    }

    public function linkedOfferingLookupRemainsPublicForTheCrosslinkForm(FunctionalTester $I)
    {
        $path = '/offering-link/find-linked-offerings?offering_id=' . $this->sourceOfferingId;
        list($status, $response) = $this->request($I, $path, null);

        Assert::assertSame(200, $status);
        Assert::assertCount(1, $response);
        Assert::assertSame((string)$this->targetOfferingId, (string)$response[0]['offering_id']);
        Assert::assertSame($this->courseListingIdForTarget, $response[0]['folio_course_id']);
        Assert::assertFalse($this->containsKey($response, 'internal_note'));
    }

    private function assertLinkedResourceContract(array $response)
    {
        Assert::assertArrayHasKey('course', $response);
        Assert::assertArrayHasKey('offering', $response);
        Assert::assertArrayHasKey('resources', $response);
        Assert::assertSame(2, (int)$response['count']);
        Assert::assertSame((string)$this->sourceCourseId, (string)$response['course']['course_id']);
        Assert::assertSame((string)$this->targetOfferingId, (string)$response['offering']['linked_offering_id']);
        Assert::assertSame($this->resourceIds, $this->resourceIdsFrom($response['resources']));

        $resource = $response['resources'][0];
        foreach ([
            'resource_id', 'name', 'item_url', 'description', 'external_note', 'start_visibility',
            'end_visibility', 'use_proxy', 'folder_id', 'folder_name', 'material_type_name',
            'course_resource_id', 'order', 'metadata',
        ] as $field) {
            Assert::assertArrayHasKey($field, $resource, 'Linked public resources must preserve ' . $field . '.');
        }
        Assert::assertSame('API-112 synthetic folder ' . $this->suffix, $resource['folder_name']);
        Assert::assertSame('API-112 synthetic type ' . $this->suffix, $resource['material_type_name']);
        Assert::assertEquals(4, $resource['order']);
        Assert::assertCount(2, $resource['metadata']);
        $metadataFields = array_column($resource['metadata'], 'field_name');
        sort($metadataFields);
        Assert::assertSame(['api112_author', 'api112_year'], $metadataFields);
    }

    private function request(FunctionalTester $I, $path, $token)
    {
        \Yii::$app->user->logout(false);
        $status = $I->sendApiRequest('GET', $path, $token);

        return [$status, $I->grabJsonResponse()];
    }

    private function resourceIdsFrom(array $resources)
    {
        $ids = array_map('strval', array_column($resources, 'resource_id'));
        sort($ids, SORT_NUMERIC);
        return $ids;
    }

    private function containsKey($value, $key)
    {
        if (!is_array($value)) {
            return false;
        }
        if (array_key_exists($key, $value)) {
            return true;
        }
        foreach ($value as $child) {
            if ($this->containsKey($child, $key)) {
                return true;
            }
        }

        return false;
    }

    private function containsKeyValue($value, $key, $expected)
    {
        if (!is_array($value)) {
            return false;
        }
        if (isset($value[$key]) && $value[$key] === $expected) {
            return true;
        }
        foreach ($value as $child) {
            if ($this->containsKeyValue($child, $key, $expected)) {
                return true;
            }
        }

        return false;
    }

    private function insertCourseAndOffering($suffix, $label)
    {
        $courseListingId = 'api112-' . $label . '-listing-' . $suffix;
        if ($label === 'source') {
            $this->courseListingId = $courseListingId;
        } else {
            $this->courseListingIdForTarget = $courseListingId;
        }

        $this->db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $this->uuid(),
            'course_name' => 'API-112 synthetic ' . $label . ' course',
            'course_number' => 'API112-' . strtoupper($label) . '-' . $suffix,
        ])->execute();
        $courseId = (int)$this->db->getLastInsertID();
        if ($label === 'source') {
            $this->sourceCourseId = $courseId;
        } else {
            $this->targetCourseId = $courseId;
        }

        $this->db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $courseId,
            'folio_course_id' => $courseListingId,
            'term_id' => 'api112-term-' . $label . '-' . $suffix,
            'term_name' => 'API-112 synthetic term',
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)$this->db->getLastInsertID();
        if ($label === 'source') {
            $this->sourceOfferingId = $offeringId;
        } else {
            $this->targetOfferingId = $offeringId;
        }
    }

    private function insertResource($suffix, $label, $note, $order)
    {
        $this->db->createCommand()->insert('resources', [
            'name' => 'API-112 synthetic resource ' . $label . ' ' . $suffix,
            'item_url' => 'https://example.test/api112-' . $label,
            'use_proxy' => 1,
            'folder_id' => $this->folderId,
            'description' => 'API-112 synthetic description ' . $label,
            'internal_note' => $note,
            'external_note' => 'API-112 synthetic public note ' . $label,
            'start_visibility' => '2026-01-01',
            'end_visibility' => '2026-12-31',
            'material_type_id' => $this->materialTypeId,
        ])->execute();
        $resourceId = (int)$this->db->getLastInsertID();
        $this->resourceIds[] = (string)$resourceId;

        $this->db->createCommand()->insert('course_resources', [
            'offering_id' => $this->targetOfferingId,
            'resource_id' => $resourceId,
            'order' => $order,
        ])->execute();

        $metadata = $label === 'first'
            ? [['api112_author', 'Synthetic author'], ['api112_year', '2026']]
            : [['api112_author', 'Another synthetic author']];
        foreach ($metadata as $field) {
            $this->db->createCommand()->insert('resource_metadata', [
                'resource_id' => $resourceId,
                'field_name' => $field[0],
                'field_value' => $field[1],
            ])->execute();
        }
    }

    private function loadProductionRouter()
    {
        $this->originalUrlManager = \Yii::$app->get('urlManager');
        $webConfig = require codecept_root_dir('config/web.php');
        $urlManagerConfig = $webConfig['components']['urlManager'];
        $urlManagerConfig['class'] = \yii\web\UrlManager::class;
        \Yii::$app->set('urlManager', $urlManagerConfig);
        \Yii::$app->urlManager->showScriptName = false;
    }

    private function cleanup()
    {
        if (!$this->db) {
            return;
        }
        if ($this->sourceOfferingId || $this->targetOfferingId) {
            $offeringIds = array_filter([$this->sourceOfferingId, $this->targetOfferingId]);
            $this->db->createCommand()->delete('offering_links', [
                'or',
                ['offering_id' => $offeringIds],
                ['linked_offering_id' => $offeringIds],
            ])->execute();
        }
        if ($this->resourceIds) {
            $this->db->createCommand()->delete('resource_metadata', ['resource_id' => $this->resourceIds])->execute();
            $this->db->createCommand()->delete('course_resources', ['resource_id' => $this->resourceIds])->execute();
            $this->db->createCommand()->delete('resources', ['resource_id' => $this->resourceIds])->execute();
        }
        if ($this->sourceCourseId || $this->targetCourseId) {
            $courseIds = array_filter([$this->sourceCourseId, $this->targetCourseId]);
            $this->db->createCommand()->delete('course_offerings', ['course_id' => $courseIds])->execute();
            $this->db->createCommand()->delete('courses', ['course_id' => $courseIds])->execute();
        }
        if ($this->folderId) {
            $this->db->createCommand()->delete('folders', ['folder_id' => $this->folderId])->execute();
        }
        if ($this->materialTypeId) {
            $this->db->createCommand()->delete('material_types', ['material_type_id' => $this->materialTypeId])->execute();
        }
    }

    private function token($role, $issuedAt, $expiresAt)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $expiresAt,
            'username' => 'test-api112-' . $role,
            'role' => $role,
            'id' => 999000112,
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
