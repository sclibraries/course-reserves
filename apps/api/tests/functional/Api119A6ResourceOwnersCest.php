<?php

require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';
require_once __DIR__ . '/../_support/Api119A3MutationCommand.php';

use PHPUnit\Framework\Assert;

/** Retry ownership for resource creation and the synthetic development seed. */
class Api119A6ResourceOwnersCest extends BaseFunctionalCest
{
    private $restore;
    private $commandClass;
    private $staffToken;
    private $prefix;
    private $resourceNames = [];
    private $courseId;
    private $offeringId;
    private $seedTouched = false;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->restore = Api116B1CommittedConnection::swap();
        $db = Yii::$app->db;
        $this->commandClass = $db->commandClass;
        $db->commandClass = Api119A3MutationCommand::class;
        Api119A3MutationCommand::clearConfiguration();

        $this->prefix = 'test-api119a6b-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        $issuedAt = time();
        $this->staffToken = \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => $this->prefix . 'staff',
            'role' => 'staff',
            'id' => 0,
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    public function _after(FunctionalTester $I)
    {
        Api119A3MutationCommand::clearConfiguration();
        Yii::$app->db->commandClass = $this->commandClass;
        if ($this->seedTouched) {
            $seed = new \app\services\DevSeedService();
            $seed->reset();
            $seed->seed(); // other suites rely on the runner's seeded Print book mapping
        }
        $this->cleanupResources();
        if ($this->courseId) {
            Yii::$app->db->createCommand()->delete('course_offerings', ['course_id' => $this->courseId])->execute();
            Yii::$app->db->createCommand()->delete('courses', ['course_id' => $this->courseId])->execute();
        }
        if ($this->restore !== null) {
            call_user_func($this->restore);
        }
    }

    public function defaultResourceCreateRetriesAndExhaustsAtomically(FunctionalTester $I)
    {
        $name = $this->resourceName('default-retry');
        $this->failAtInvalidation(2);
        $this->post($I, 'resource/create', ['name' => $name, 'item_url' => 'https://example.test/' . $name]);
        $I->seeResponseCodeIs(201);
        Assert::assertSame(2, Api119A3MutationCommand::matches());
        $created = $I->grabJsonResponse();
        Assert::assertSame($name, $created['name']);
        Assert::assertNotEmpty(Yii::$app->response->headers->get('Location'));
        Assert::assertSame(1, $this->resourceCount($name));
        Assert::assertSame(0, Api116B1CommittedConnection::level());

        $failedName = $this->resourceName('default-exhausted');
        $this->failAtInvalidation(3);
        $this->post($I, 'resource/create', ['name' => $failedName]);
        $I->seeResponseCodeIs(409);
        $this->assertContention($I->grabJsonResponse());
        Assert::assertSame(3, Api119A3MutationCommand::matches());
        Assert::assertSame(0, $this->resourceCount($failedName));
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    public function courseResourceCreateRetriesAndExhaustsAtomically(FunctionalTester $I)
    {
        $this->createCourseOffering();
        $name = $this->resourceName('course-retry');
        $payload = $this->courseResourcePayload($name);
        $this->failAtInvalidation(2);
        $this->post($I, 'course/create-resource', $payload);
        $I->seeResponseCodeIs(200);
        Assert::assertSame(2, Api119A3MutationCommand::matches());
        $body = $I->grabJsonResponse();
        Assert::assertTrue($body['success']);
        Assert::assertSame($this->offeringId, (int)$body['course_offering']);
        Assert::assertSame(1, $this->resourceCount($name));
        $this->assertCourseResourceChildren($name, 1);
        Assert::assertSame(0, Api116B1CommittedConnection::level());

        $failedName = $this->resourceName('course-exhausted');
        $this->failAtInvalidation(3);
        $this->post($I, 'course/create-resource', $this->courseResourcePayload($failedName));
        $I->seeResponseCodeIs(409);
        $this->assertContention($I->grabJsonResponse());
        Assert::assertSame(3, Api119A3MutationCommand::matches());
        Assert::assertSame(0, $this->resourceCount($failedName));
        $this->assertCourseResourceChildren($failedName, 0);
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    public function devSeedRetriesAndReportsContentionAfterExhaustion(FunctionalTester $I)
    {
        $this->seedTouched = true;
        (new \app\services\DevSeedService())->reset();
        $this->failAtInvalidation(2);
        $seed = $this->runSeedCommand(false);
        Assert::assertSame(0, $seed['status'], $seed['errors']);
        Assert::assertSame(2, Api119A3MutationCommand::matches());
        Assert::assertSame(1, count(array_filter($seed['output'], function ($line) {
            return strpos($line, 'Seeded 9 API-078 course assignments.') === 0;
        })));
        Assert::assertSame(1, (int)Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM resources WHERE name = :name', [':name' => 'test-cx029-article']
        )->queryScalar());
        Assert::assertSame(0, Api116B1CommittedConnection::level());

        Yii::$app->db->createCommand()->update('resources', [
            'description' => 'Synthetic row changed before exhausted seed.',
        ], ['name' => 'test-cx029-article'])->execute();
        $before = $this->seedSnapshot();
        $this->failAtInvalidation(3);
        $failed = $this->runSeedCommand(false);
        Assert::assertNotSame(0, $failed['status']);
        Assert::assertSame(3, Api119A3MutationCommand::matches());
        Assert::assertRegExp('/reference=[A-HJ-NP-Z2-9]{6}/', $failed['errors']);
        Assert::assertSame($before, $this->seedSnapshot());
        Assert::assertSame(0, Api116B1CommittedConnection::level());
    }

    private function failAtInvalidation($attempts)
    {
        Api119A3MutationCommand::failNext(
            '/SELECT "new" AS kind, item\.id, item\.submission_id FROM submission_new_resources item WHERE item\.source_resource_id =/i',
            $attempts
        );
    }

    private function post(FunctionalTester $I, $route, array $body)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->staffToken);
        $I->sendJsonPost($route, $body);
    }

    private function assertContention(array $body)
    {
        Assert::assertSame(['error_code', 'reference'], array_keys($body));
        Assert::assertSame('item_contention', $body['error_code']);
        Assert::assertRegExp('/^[A-HJ-NP-Z2-9]{6}$/', $body['reference']);
    }

    private function resourceName($suffix)
    {
        $name = $this->prefix . $suffix;
        $this->resourceNames[] = $name;
        return $name;
    }

    private function resourceCount($name)
    {
        return (int)Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM resources WHERE name = :name', [':name' => $name]
        )->queryScalar();
    }

    private function createCourseOffering()
    {
        $db = Yii::$app->db;
        $db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $this->uuid(),
            'course_name' => $this->prefix . 'course',
            'course_number' => $this->prefix . 'course-number',
        ])->execute();
        $this->courseId = (int)$db->getLastInsertID();
        $db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $this->courseId,
            'folio_course_id' => $this->prefix . 'folio-course',
            'term_id' => $this->prefix . 'term',
            'term_name' => 'Synthetic test term',
            'section_name' => '01',
        ])->execute();
        $this->offeringId = (int)$db->getLastInsertID();
    }

    private function courseResourcePayload($name)
    {
        return [
            'courseId' => $this->courseId,
            'offering_id' => $this->offeringId,
            'title' => $name,
            'link' => 'https://example.test/' . $name,
            'notes' => 'Synthetic course resource',
            'folioData' => ['courseListingId' => $this->prefix . 'folio-course'],
            'links' => [['url' => 'https://example.test/' . $name . '/alternate', 'title' => 'Synthetic link']],
            'metadata' => ['synthetic-field' => 'Synthetic metadata'],
        ];
    }

    private function assertCourseResourceChildren($name, $expected)
    {
        $resourceId = Yii::$app->db->createCommand(
            'SELECT resource_id FROM resources WHERE name = :name', [':name' => $name]
        )->queryScalar();
        $resourceId = $resourceId === false ? -1 : (int)$resourceId;
        foreach (['resource_links', 'resource_metadata', 'course_resources'] as $table) {
            Assert::assertSame($expected, (int)Yii::$app->db->createCommand(
                'SELECT COUNT(*) FROM ' . $table . ' WHERE resource_id = :id', [':id' => $resourceId]
            )->queryScalar(), $table . ' rows for ' . $name);
        }
    }

    private function cleanupResources()
    {
        if (!$this->resourceNames) {
            return;
        }
        $db = Yii::$app->db;
        $resourceIds = (new \yii\db\Query())->select('resource_id')->from('resources')
            ->where(['name' => $this->resourceNames])->column($db);
        if ($resourceIds) {
            foreach (['resource_metadata', 'resource_links', 'course_resources'] as $table) {
                $db->createCommand()->delete($table, ['resource_id' => $resourceIds])->execute();
            }
            $db->createCommand()->delete('resources', ['resource_id' => $resourceIds])->execute();
        }
    }

    private function seedSnapshot()
    {
        $db = Yii::$app->db;
        return [
            $db->createCommand('SELECT description FROM resources WHERE name = :name', [
                ':name' => 'test-cx029-article',
            ])->queryScalar(),
            (int)$db->createCommand('SELECT COUNT(*) FROM course_assignments WHERE smith_id LIKE "999078%"')->queryScalar(),
            (int)$db->createCommand('SELECT COUNT(*) FROM resources WHERE name LIKE "test-cx029-%"')->queryScalar(),
        ];
    }

    private function runSeedCommand($reset)
    {
        $controller = new class('dev-seed', Yii::$app) extends \app\commands\DevSeedController {
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
        $controller->currentPeriod = 'AP_209909';
        $controller->upcomingPeriod = 'AP_210002';
        $status = $controller->actionTestCourses();
        return [
            'status' => $status,
            'output' => explode("\n", $controller->capturedOutput),
            'errors' => $controller->capturedErrors,
        ];
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
