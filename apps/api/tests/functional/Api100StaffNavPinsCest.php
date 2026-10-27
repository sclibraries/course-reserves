<?php

use PHPUnit\Framework\Assert;

/** Covers staff-owned navigation pins and admin-managed defaults. */
class Api100StaffNavPinsCest extends BaseFunctionalCest
{
    private $prefix = 'test-api100-';
    private $tokens = [];

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->cleanup();
        foreach (['admin', 'staff', 'second', 'faculty'] as $userType) {
            $role = $userType === 'admin' ? 'admin' : ($userType === 'faculty' ? 'faculty' : 'staff');
            $this->insertUser($userType, $role);
            $this->tokens[$userType] = $this->token($userType, $role);
        }
    }

    public function _after(FunctionalTester $I)
    {
        $this->cleanup();
    }

    public function protectsStaffRoutesAndAllowsPreflight(FunctionalTester $I)
    {
        $I->sendJsonRequest('OPTIONS', 'staff-nav-pin/options', []);
        $I->seeResponseCodeIs(204);
        $I->sendJsonRequest('OPTIONS', 'staff-nav-pin/options', []);
        $I->seeResponseCodeIs(204);

        $I->sendJsonRequest('GET', 'staff-nav-pin/index', []);
        $I->seeResponseCodeIs(401);

        $this->request($I, 'GET', 'staff-nav-pin/index', [], 'faculty');
        $I->seeResponseCodeIs(403);
        $this->request($I, 'GET', 'staff-nav-pin/defaults', [], 'staff');
        $I->seeResponseCodeIs(403);
        $this->request($I, 'PUT', 'staff-nav-pin/defaults', ['pins' => []], 'staff');
        $I->seeResponseCodeIs(403);

        $this->request($I, 'GET', 'staff-nav-pin/index', [], 'admin');
        $I->seeResponseCodeIs(200);
        Assert::assertTrue($this->response($I)['is_default']);
        $this->request($I, 'PUT', 'staff-nav-pin/index', ['pins' => []], 'admin');
        $I->seeResponseCodeIs(200);
        Assert::assertFalse($this->response($I)['is_default']);
    }

    public function appliesDefaultsUntilAnOrderedUserChoiceIsSavedOrDeleted(FunctionalTester $I)
    {
        $defaultPins = ['my-work', 'submissions'];
        $this->request($I, 'GET', 'staff-nav-pin/index', [], 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame([
            'pins' => $defaultPins,
            'is_default' => true,
            'defaults' => $defaultPins,
        ], $this->response($I));
        $this->request($I, 'GET', 'staff-nav-pin/defaults', [], 'admin');
        Assert::assertSame(['pins' => $defaultPins], $this->response($I));

        $changedDefaults = ['submissions', 'my-work', 'staff-custom'];
        $this->request($I, 'PUT', 'staff-nav-pin/defaults', ['pins' => $changedDefaults], 'admin');
        $I->seeResponseCodeIs(200);
        Assert::assertSame(['pins' => $changedDefaults], $this->response($I));
        $this->request($I, 'GET', 'staff-nav-pin/index', [], 'staff');
        Assert::assertSame($changedDefaults, $this->response($I)['pins']);
        Assert::assertTrue($this->response($I)['is_default']);
        $adminId = $this->userId('admin');
        Assert::assertSame($adminId, (int)\Yii::$app->db->createCommand(
            'SELECT updated_by FROM staff_nav_pin_defaults WHERE id = 1'
        )->queryScalar());

        $this->request($I, 'PUT', 'staff-nav-pin/index', ['pins' => ['staff-custom', 'my-work']], 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame(['staff-custom', 'my-work'], $this->response($I)['pins']);
        Assert::assertFalse($this->response($I)['is_default']);
        Assert::assertSame($changedDefaults, $this->response($I)['defaults']);
        Assert::assertSame('["staff-custom","my-work"]', (string)\Yii::$app->db->createCommand(
            'SELECT pins FROM staff_nav_pins WHERE user_id = :id', [':id' => $this->userId('staff')]
        )->queryScalar());

        $this->request($I, 'GET', 'staff-nav-pin/index', [], 'second');
        Assert::assertSame($changedDefaults, $this->response($I)['pins']);
        Assert::assertTrue($this->response($I)['is_default']);

        $this->request($I, 'PUT', 'staff-nav-pin/index', ['pins' => []], 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame([], $this->response($I)['pins']);
        Assert::assertFalse($this->response($I)['is_default']);
        $this->request($I, 'GET', 'staff-nav-pin/index', [], 'second');
        Assert::assertSame($changedDefaults, $this->response($I)['pins']);

        $this->request($I, 'DELETE', 'staff-nav-pin/index', [], 'staff');
        $I->seeResponseCodeIs(200);
        Assert::assertSame($changedDefaults, $this->response($I)['pins']);
        Assert::assertTrue($this->response($I)['is_default']);
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM staff_nav_pins WHERE user_id = :id', [':id' => $this->userId('staff')]
        )->queryScalar());

        $this->request($I, 'PUT', 'staff-nav-pin/defaults', ['pins' => []], 'admin');
        $I->seeResponseCodeIs(200);
        $this->request($I, 'GET', 'staff-nav-pin/defaults', [], 'admin');
        Assert::assertSame(['pins' => []], $this->response($I));
        $this->request($I, 'GET', 'staff-nav-pin/index', [], 'second');
        Assert::assertSame([], $this->response($I)['pins']);
        Assert::assertTrue($this->response($I)['is_default']);
    }

    public function rejectsInvalidListsThroughBothPutRoutes(FunctionalTester $I)
    {
        $invalid = [
            array_map(function ($index) {
                return 'key-' . $index;
            }, range(0, 10)),
            ['my-work', 'my-work'],
            ['My-Work'],
            'my-work',
            ['key' => 'my-work'],
            (object)[],
        ];
        foreach ($invalid as $pins) {
            $this->request($I, 'PUT', 'staff-nav-pin/index', ['pins' => $pins], 'staff');
            $I->seeResponseCodeIs(422);
            Assert::assertSame('invalid_pins', $this->response($I)['error']);
            Assert::assertSame('Invalid pins.', $this->response($I)['message']);

            $this->request($I, 'PUT', 'staff-nav-pin/defaults', ['pins' => $pins], 'admin');
            $I->seeResponseCodeIs(422);
            Assert::assertSame('invalid_pins', $this->response($I)['error']);
            Assert::assertSame('Invalid pins.', $this->response($I)['message']);
        }
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand('SELECT COUNT(*) FROM staff_nav_pins')->queryScalar());
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM staff_nav_pin_defaults'
        )->queryScalar());
    }

    public function deletesRespectPinAndDefaultEditorForeignKeys(FunctionalTester $I)
    {
        $this->request($I, 'PUT', 'staff-nav-pin/index', ['pins' => ['my-work']], 'staff');
        $this->request($I, 'PUT', 'staff-nav-pin/defaults', ['pins' => ['submissions']], 'admin');

        $staffId = $this->userId('staff');
        $adminId = $this->userId('admin');
        \Yii::$app->db->createCommand()->delete('users', ['id' => $staffId])->execute();
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand('SELECT COUNT(*) FROM staff_nav_pins')->queryScalar());
        \Yii::$app->db->createCommand()->delete('users', ['id' => $adminId])->execute();
        $defaults = \Yii::$app->db->createCommand(
            'SELECT updated_by FROM staff_nav_pin_defaults WHERE id = 1'
        )->queryOne();
        Assert::assertNull($defaults['updated_by']);
    }

    private function request(FunctionalTester $I, $method, $route, array $body, $userType)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->tokens[$userType]);
        $I->sendJsonRequest($method, $route, $body);
    }

    private function response(FunctionalTester $I)
    {
        $response = $I->grabJsonResponse();
        Assert::assertIsArray($response);
        return $response;
    }

    private function insertUser($userType, $role)
    {
        $username = $this->username($userType);
        \Yii::$app->db->createCommand()->insert('users', [
            'username' => $username,
            'full_name' => 'Synthetic API-100 ' . ucfirst($userType),
            'email' => $username . '@example.test',
            'role' => $role,
            'institution' => 'SM',
            'approved' => 1,
        ])->execute();
    }

    private function userId($userType)
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT id FROM users WHERE username = :username', [':username' => $this->username($userType)]
        )->queryScalar();
    }

    private function username($userType)
    {
        return $this->prefix . $userType;
    }

    private function token($userType, $role)
    {
        $username = $this->username($userType);
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'full_name' => 'Synthetic API-100 ' . ucfirst($userType),
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function cleanup()
    {
        \Yii::$app->db->createCommand()->delete('staff_nav_pin_defaults')->execute();
        \Yii::$app->db->createCommand()->delete('users', ['like', 'username', $this->prefix . '%'])->execute();
    }
}
