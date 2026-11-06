<?php

use PHPUnit\Framework\Assert;
use yii\base\Event;
use yii\db\ActiveRecord;

/** Staff reuse POST writes only course-specific settings on the new association. */
class Api127E1ResourceReuseCest extends BaseFunctionalCest
{
    private $db;
    private $courseIds = [];
    private $offeringIds = [];
    private $resourceIds = [];
    private $sourceOfferingId;
    private $targetOfferingId;
    private $originalUrlManager;
    private $staffToken;
    private $facultyToken;
    private $status;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->db = \Yii::$app->db;
        $this->loadProductionRouter();
        $this->sourceOfferingId = $this->createOffering('source');
        $this->targetOfferingId = $this->createOffering('target');

        for ($i = 0; $i < 8; $i++) {
            $this->resourceIds[] = $this->createResource($i);
        }

        $issuedAt = time();
        $this->staffToken = $this->token('staff', $issuedAt, $issuedAt + 3600);
        $this->facultyToken = $this->token('faculty', $issuedAt, $issuedAt + 3600);
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
        if ($this->originalUrlManager !== null) {
            \Yii::$app->set('urlManager', $this->originalUrlManager);
            $this->originalUrlManager = null;
        }
    }

    public function staffCanReuseResourcesWithIsolatedValidatedSettings(FunctionalTester $I)
    {
        $path = 'offering-link/link-existing-resources';
        $payload = [
            'offering_id' => $this->targetOfferingId,
            'resource_id' => $this->resourceIds[0],
            'order' => 17,
            'settings' => [
                'start_visibility' => '2026-01-02',
                'end_visibility' => null,
                'use_resource_visibility' => true,
                'primary_link_start_visibility' => null,
                'primary_link_end_visibility' => '2026-12-30',
                'use_primary_link_visibility' => '0',
            ],
        ];

        $this->request($I, 'POST', $path, $payload, null);
        Assert::assertSame(401, $this->status, 'Anonymous POST must be rejected.');
        $this->request($I, 'POST', $path, $payload, $this->facultyToken);
        Assert::assertSame(403, $this->status, 'Faculty POST must be rejected.');

        $beforeSharedRows = $this->sharedRows();
        $this->request($I, 'POST', $path, $payload, $this->staffToken);
        Assert::assertSame(201, $this->status);
        $created = $I->grabJsonResponse();
        Assert::assertSame('2026-01-02', $created['start_visibility']);
        Assert::assertNull($created['end_visibility']);
        Assert::assertSame(1, (int)$created['use_resource_visibility']);
        Assert::assertNull($created['primary_link_start_visibility']);
        Assert::assertSame('2026-12-30', $created['primary_link_end_visibility']);
        Assert::assertSame(0, (int)$created['use_primary_link_visibility']);
        Assert::assertSame(17, (int)$created['order']);

        $this->request($I, 'POST', $path, $payload, $this->staffToken);
        Assert::assertSame(409, $this->status, 'An existing association must be rejected.');
        Assert::assertSame('Already on this course', $I->grabJsonResponse()['message']);

        $defaultPayload = [
            'offering_id' => $this->targetOfferingId,
            'resource_id' => $this->resourceIds[1],
        ];
        $this->request($I, 'POST', $path, $defaultPayload, $this->staffToken);
        Assert::assertSame(201, $this->status);
        $defaults = $I->grabJsonResponse();
        foreach ([
            'start_visibility', 'end_visibility', 'primary_link_start_visibility', 'primary_link_end_visibility',
        ] as $field) {
            Assert::assertNull($defaults[$field], $field . ' must not copy source dates.');
        }
        Assert::assertSame(0, (int)$defaults['use_resource_visibility']);
        Assert::assertSame(0, (int)$defaults['use_primary_link_visibility']);
        Assert::assertSame(999, (int)$defaults['order']);

        foreach ([[0, 1], ['0', '1'], [true, false], ['1', '0']] as $index => $flags) {
            $this->request($I, 'POST', $path, [
                'offering_id' => $this->targetOfferingId,
                'resource_id' => $this->resourceIds[$index + 2],
                'settings' => [
                    'use_resource_visibility' => $flags[0],
                    'use_primary_link_visibility' => $flags[1],
                ],
            ], $this->staffToken);
            Assert::assertSame(201, $this->status);
            $stored = $I->grabJsonResponse();
            Assert::assertSame((int)$flags[0], (int)$stored['use_resource_visibility']);
            Assert::assertSame((int)$flags[1], (int)$stored['use_primary_link_visibility']);
        }

        $rejected = [
            [['resource_id' => $this->resourceIds[6]], 422],
            [['offering_id' => 'invalid', 'resource_id' => $this->resourceIds[6]], 422],
            [['offering_id' => 0, 'resource_id' => $this->resourceIds[6]], 422],
            [['offering_id' => $this->targetOfferingId, 'resource_id' => []], 422],
            [['offering_id' => $this->targetOfferingId, 'resource_id' => $this->resourceIds[6], 'order' => 1.5], 422],
            [['offering_id' => $this->targetOfferingId, 'resource_id' => $this->resourceIds[6], 'settings' => 'bad'], 422],
            [[
                'offering_id' => $this->targetOfferingId, 'resource_id' => $this->resourceIds[6],
                'settings' => ['unexpected' => 'value'],
            ], 422],
            [[
                'offering_id' => $this->targetOfferingId, 'resource_id' => $this->resourceIds[6],
                'settings' => ['start_visibility' => '2026-02-30'],
            ], 422],
            [[
                'offering_id' => $this->targetOfferingId, 'resource_id' => $this->resourceIds[6],
                'settings' => ['use_resource_visibility' => 2],
            ], 422],
            [[
                'offering_id' => $this->targetOfferingId, 'resource_id' => 2147483647,
            ], 404],
            [[
                'offering_id' => 2147483647, 'resource_id' => $this->resourceIds[6],
            ], 404],
        ];
        foreach ($rejected as $case) {
            $this->request($I, 'POST', $path, $case[0], $this->staffToken);
            Assert::assertSame($case[1], $this->status);
            if ($case[1] === 422) {
                Assert::assertNotEmpty($I->grabJsonResponse()['errors']);
            }
        }

        $this->request($I, 'PUT', $path, $defaultPayload, $this->staffToken);
        Assert::assertSame(405, $this->status, 'Other methods must not run the POST action.');

        $I->deleteHeader('Authorization');
        $preflightStatus = $I->sendCorsRequest(
            'OPTIONS', '/' . $path, 'http://localhost:5173', 'POST', 'Authorization, Content-Type'
        );
        Assert::assertGreaterThanOrEqual(200, $preflightStatus);
        Assert::assertLessThan(300, $preflightStatus);

        $this->request($I, 'GET', $path, [], $this->staffToken, [
            'offering_id' => $this->targetOfferingId,
            'resource_id' => $this->resourceIds[7],
            'order' => 23,
        ]);
        Assert::assertSame(201, $this->status, 'The legacy GET must still create a course association.');
        Assert::assertSame(23, (int)$I->grabJsonResponse()['order']);

        Assert::assertSame($beforeSharedRows, $this->sharedRows(), 'Reuse must not modify shared resource rows.');
        Assert::assertSame(7, (int)$this->db->createCommand(
            'SELECT COUNT(*) FROM course_resources WHERE offering_id = :offering_id',
            [':offering_id' => $this->targetOfferingId]
        )->queryScalar(), 'Rejected requests must not insert associations.');
        $this->assertSaveFailureIsNotReportedAsSuccess($I, $path);
    }

    private function assertSaveFailureIsNotReportedAsSuccess(FunctionalTester $I, $path)
    {
        $handler = function ($event) {
            $event->isValid = false;
        };
        Event::on(\app\models\CourseResources::class, ActiveRecord::EVENT_BEFORE_INSERT, $handler);
        try {
            $this->request($I, 'POST', $path, [
                'offering_id' => $this->targetOfferingId,
                'resource_id' => $this->resourceIds[6],
            ], $this->staffToken);
            Assert::assertSame(500, $this->status);
            Assert::assertSame(7, (int)$this->db->createCommand(
                'SELECT COUNT(*) FROM course_resources WHERE offering_id = :offering_id',
                [':offering_id' => $this->targetOfferingId]
            )->queryScalar());
        } finally {
            Event::off(\app\models\CourseResources::class, ActiveRecord::EVENT_BEFORE_INSERT, $handler);
        }
    }

    private function request(FunctionalTester $I, $method, $path, array $payload, $token, array $params = [])
    {
        if ($token === null) {
            $I->deleteHeader('Authorization');
        } else {
            $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        }
        $this->status = $I->sendJsonRequest($method, $path, $payload, $params);
    }

    private function sharedRows()
    {
        return [
            'resources' => $this->db->createCommand(
                'SELECT * FROM resources WHERE resource_id IN (' . implode(',', $this->resourceIds) . ') ORDER BY resource_id'
            )->queryAll(),
            'links' => $this->db->createCommand(
                'SELECT * FROM resource_links WHERE resource_id IN (' . implode(',', $this->resourceIds) . ') ORDER BY link_id'
            )->queryAll(),
            'metadata' => $this->db->createCommand(
                'SELECT * FROM resource_metadata WHERE resource_id IN (' . implode(',', $this->resourceIds) . ') ORDER BY metadata_id'
            )->queryAll(),
            'source_associations' => $this->db->createCommand(
                'SELECT * FROM course_resources WHERE offering_id = :offering_id ORDER BY resource_id',
                [':offering_id' => $this->sourceOfferingId]
            )->queryAll(),
        ];
    }

    private function createOffering($label)
    {
        $suffix = bin2hex(random_bytes(5));
        $this->db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $this->uuid(),
            'course_name' => 'API-127E1 synthetic ' . $label,
            'course_number' => 'API127E1-' . $label . '-' . $suffix,
        ])->execute();
        $courseId = (int)$this->db->getLastInsertID();
        $this->courseIds[] = $courseId;
        $this->db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $courseId,
            'folio_course_id' => 'api127e1-' . $label . '-' . $suffix,
            'term_id' => 'api127e1-' . $label . '-' . $suffix,
            'term_name' => 'API-127E1 synthetic term',
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)$this->db->getLastInsertID();
        $this->offeringIds[] = $offeringId;
        return $offeringId;
    }

    private function createResource($index)
    {
        $this->db->createCommand()->insert('resources', [
            'name' => 'API-127E1 synthetic resource ' . $index,
            'item_url' => 'https://example.test/api127e1-' . $index,
            'description' => 'Synthetic shared description',
            'start_visibility' => '2025-01-01',
            'end_visibility' => '2025-12-31',
            'use_proxy' => 1,
            'primary_link_start_visibility' => '2025-02-01',
            'primary_link_end_visibility' => '2025-11-30',
            'use_primary_link_visibility' => 1,
        ])->execute();
        $resourceId = (int)$this->db->getLastInsertID();
        $this->db->createCommand()->insert('course_resources', [
            'offering_id' => $this->sourceOfferingId,
            'resource_id' => $resourceId,
            'order' => 31,
            'start_visibility' => '2024-04-05',
            'end_visibility' => '2024-05-06',
            'use_resource_visibility' => 1,
            'primary_link_start_visibility' => '2024-06-07',
            'primary_link_end_visibility' => '2024-07-08',
            'use_primary_link_visibility' => 1,
        ])->execute();
        $this->db->createCommand()->insert('resource_links', [
            'resource_id' => $resourceId,
            'url' => 'https://example.test/api127e1-link-' . $index,
            'title' => 'Synthetic link',
        ])->execute();
        $this->db->createCommand()->insert('resource_metadata', [
            'resource_id' => $resourceId,
            'field_name' => 'api127e1_marker',
            'field_value' => 'synthetic',
        ])->execute();
        return $resourceId;
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
        if ($this->offeringIds) {
            $this->db->createCommand()->delete('course_resources', ['offering_id' => $this->offeringIds])->execute();
        }
        if ($this->resourceIds) {
            $this->db->createCommand()->delete('resources', ['resource_id' => $this->resourceIds])->execute();
        }
        if ($this->courseIds) {
            $this->db->createCommand()->delete('course_offerings', ['course_id' => $this->courseIds])->execute();
            $this->db->createCommand()->delete('courses', ['course_id' => $this->courseIds])->execute();
        }
    }

    private function token($role, $issuedAt, $expiresAt)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $expiresAt,
            'username' => 'test-api127e1-' . $role,
            'role' => $role,
            'id' => 999001271,
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
