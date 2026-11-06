<?php

use PHPUnit\Framework\Assert;

/** Resource usage is a staff-only read backed only by synthetic records. */
class Api127AResourceUsageCest extends BaseFunctionalCest
{
    private $db;
    private $originalUrlManager;
    private $suffix;
    private $courseIds = [];
    private $offeringIds = [];
    private $resourceIds = [];
    private $resourceId;
    private $emptyResourceId;
    private $resourceName;
    private $facultyToken;
    private $staffToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->loadProductionRouter();
        $this->db = \Yii::$app->db;
        $this->suffix = bin2hex(random_bytes(6));

        $courseA = $this->createCourse('A');
        $courseB = $this->createCourse('B');
        $externalCourse = $this->createCourse('external');
        $this->offeringIds['fallA'] = $this->createOffering($courseA, 'fall', 'Fall 2027');
        $this->offeringIds['springA'] = $this->createOffering($courseA, 'spring', 'Spring 2028');
        $this->offeringIds['fallB'] = $this->createOffering($courseB, 'fall', 'Fall 2027');
        $this->offeringIds['external'] = $this->createOffering($externalCourse, 'external', 'Fall 2027');

        $this->resourceName = 'API-127A synthetic resource ' . $this->suffix;
        $this->resourceId = $this->createResource($this->resourceName);
        foreach (['fallA', 'springA', 'fallB'] as $offering) {
            $this->db->createCommand()->insert('course_resources', [
                'offering_id' => $this->offeringIds[$offering],
                'resource_id' => $this->resourceId,
            ])->execute();
        }
        foreach (['fallA', 'springA'] as $associatedOffering) {
            $this->db->createCommand()->insert('offering_links', [
                'offering_id' => $this->offeringIds['external'],
                'linked_offering_id' => $this->offeringIds[$associatedOffering],
            ])->execute();
        }
        $this->emptyResourceId = $this->createResource('API-127A empty resource ' . $this->suffix);

        $this->facultyToken = $this->token('faculty');
        $this->staffToken = $this->token('staff');
    }

    public function _after(FunctionalTester $I)
    {
        if ($this->db) {
            if ($this->offeringIds) {
                $this->db->createCommand()->delete('offering_links', [
                    'or',
                    ['offering_id' => $this->offeringIds],
                    ['linked_offering_id' => $this->offeringIds],
                ])->execute();
            }
            if ($this->resourceIds) {
                $this->db->createCommand()->delete('course_resources', ['resource_id' => $this->resourceIds])->execute();
                $this->db->createCommand()->delete('resources', ['resource_id' => $this->resourceIds])->execute();
            }
            if ($this->offeringIds) {
                $this->db->createCommand()->delete('course_offerings', ['offering_id' => $this->offeringIds])->execute();
            }
            if ($this->courseIds) {
                $this->db->createCommand()->delete('courses', ['course_id' => $this->courseIds])->execute();
            }
        }
        if ($this->originalUrlManager !== null) {
            \Yii::$app->set('urlManager', $this->originalUrlManager);
            $this->originalUrlManager = null;
        }
    }

    public function usageReportsCountsAndRequiresStaff(FunctionalTester $I)
    {
        $path = '/resource/' . $this->resourceId . '/usage';

        Assert::assertSame(401, $I->sendApiRequest('GET', $path));
        Assert::assertSame(403, $I->sendApiRequest('GET', $path, $this->facultyToken));
        Assert::assertSame(200, $I->sendApiRequest('GET', $path, $this->staffToken));
        Assert::assertSame([
            'course_count' => 2,
            'offering_count' => 3,
            'terms' => [
                ['term_id' => 'api127a-fall-' . $this->suffix, 'term_name' => 'Fall 2027'],
                ['term_id' => 'api127a-spring-' . $this->suffix, 'term_name' => 'Spring 2028'],
            ],
            'linked_page_count' => 1,
        ], $I->grabJsonResponse());

        Assert::assertSame(200, $I->sendApiRequest(
            'GET',
            '/resource?name=' . rawurlencode($this->resourceName)
        ));
        $index = $I->grabJsonResponse();
        $rows = array_values(array_filter($index, function ($row) {
            return (int)$row['resource_id'] === $this->resourceId;
        }));
        Assert::assertCount(1, $rows);
        Assert::assertSame(3, (int)$rows[0]['course_count']);
    }

    public function emptyUsageUnknownResourceAndPreflightUseProductionRoutes(FunctionalTester $I)
    {
        $emptyPath = '/resource/' . $this->emptyResourceId . '/usage';
        Assert::assertSame(200, $I->sendApiRequest('GET', $emptyPath, $this->staffToken));
        Assert::assertSame([
            'course_count' => 0,
            'offering_count' => 0,
            'terms' => [],
            'linked_page_count' => 0,
        ], $I->grabJsonResponse());

        Assert::assertSame(404, $I->sendApiRequest('GET', '/resource/2147483647/usage', $this->staffToken));

        $origin = 'http://localhost:5173';
        Assert::assertSame(200, $I->sendCorsRequest('OPTIONS', $emptyPath, $origin, 'GET', 'Authorization'));
        Assert::assertSame($origin, \Yii::$app->response->headers->get('Access-Control-Allow-Origin'));
        Assert::assertSame('resource/options', \Yii::$app->requestedRoute);
    }

    private function createCourse($label)
    {
        $this->db->createCommand()->insert('courses', [
            'permanent_course_uuid' => $this->uuid(),
            'course_name' => 'API-127A synthetic course ' . $label . ' ' . $this->suffix,
            'course_number' => 'API127A-' . $label . '-' . $this->suffix,
        ])->execute();
        $courseId = (int)$this->db->getLastInsertID();
        $this->courseIds[] = $courseId;
        return $courseId;
    }

    private function createOffering($courseId, $termId, $termName)
    {
        $this->db->createCommand()->insert('course_offerings', [
            'offering_uuid' => $this->uuid(),
            'course_id' => $courseId,
            'term_id' => 'api127a-' . $termId . '-' . $this->suffix,
            'term_name' => $termName,
            'section_name' => '01',
        ])->execute();
        $offeringId = (int)$this->db->getLastInsertID();
        return $offeringId;
    }

    private function createResource($name)
    {
        $this->db->createCommand()->insert('resources', ['name' => $name])->execute();
        $resourceId = (int)$this->db->getLastInsertID();
        $this->resourceIds[] = $resourceId;
        return $resourceId;
    }

    private function token($role)
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => 'api127a-' . $role . '-' . $this->suffix,
            'role' => $role,
            'id' => 99900127,
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function uuid()
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
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
}
