<?php

namespace tests\unit\filters;

use app\filters\RoleAccessFilter;
use app\models\JwtIdentity;
use Firebase\JWT\JWT;
use Yii;
use yii\base\Action;
use yii\base\Controller;
use yii\web\ForbiddenHttpException;

/**
 * Verifies role access rules for action filters.
 */
class RoleAccessFilterTest extends \Codeception\Test\Unit
{
    private const TEST_SECRET = 'api-031-role-filter-test-key';

    /**
     * Original JWT key from the test environment.
     *
     * @var string|false
     */
    private $_originalSecret;
    private $_originalRequestMethod;

    protected function _before()
    {
        $this->_originalSecret = getenv('JWT_SECRET_KEY');
        $this->_originalRequestMethod = $_SERVER['REQUEST_METHOD'] ?? null;
        putenv('JWT_SECRET_KEY=' . self::TEST_SECRET);
    }

    protected function _after()
    {
        Yii::$app->user->setIdentity(null);
        if ($this->_originalRequestMethod === null) {
            unset($_SERVER['REQUEST_METHOD']);
        } else {
            $_SERVER['REQUEST_METHOD'] = $this->_originalRequestMethod;
        }

        if ($this->_originalSecret === false) {
            putenv('JWT_SECRET_KEY');
            return;
        }

        putenv('JWT_SECRET_KEY=' . $this->_originalSecret);
    }

    /**
     * A configured role is allowed through the filter.
     *
     * @return void
     */
    public function testAllowedRolePasses()
    {
        $this->_setRole('staff');
        $filter = $this->_filter(['lookup' => ['staff', 'admin']]);

        $this->assertTrue($filter->beforeAction($this->_action('lookup')));
    }

    /**
     * A role outside the configured list gets forbidden.
     *
     * @return void
     */
    public function testDisallowedRoleGetsForbidden()
    {
        $this->_setRole('faculty');
        $filter = $this->_filter(['lookup' => ['staff', 'admin']]);

        $this->expectException(ForbiddenHttpException::class);
        $filter->beforeAction($this->_action('lookup'));
    }

    /**
     * OPTIONS bypasses role checks so preflight can continue.
     *
     * @return void
     */
    public function testOptionsSkipsRoleCheck()
    {
        $_SERVER['REQUEST_METHOD'] = 'OPTIONS';
        $filter = $this->_filter(['lookup' => ['staff']]);

        $this->assertTrue($filter->beforeAction($this->_action('lookup')));
    }

    /**
     * An action absent from the map is unchanged.
     *
     * @return void
     */
    public function testUnlistedActionIsUntouched()
    {
        $filter = $this->_filter(['lookup' => ['staff']]);

        $this->assertTrue($filter->beforeAction($this->_action('public-action')));
    }

    /**
     * Build a filter using the action-role map.
     *
     * @param  array $rules Action IDs and their allowed roles.
     * @return RoleAccessFilter
     */
    private function _filter(array $rules)
    {
        return new RoleAccessFilter(['rules' => $rules]);
    }

    /**
     * Set a signed identity for this test.
     *
     * @param string $role Identity role.
     * @return void
     */
    private function _setRole($role)
    {
        $token = JWT::encode(
            [
            'iat' => time() - 1,
            'exp' => time() + 60,
            'username' => 'synthetic-role-filter-user',
            'role' => $role,
            ],
            self::TEST_SECRET,
            'HS256'
        );
        Yii::$app->user->setIdentity(JwtIdentity::findIdentityByAccessToken($token));
    }

    /**
     * Build an action owned by a controller.
     *
     * @param  string $id Action ID.
     * @return Action
     */
    private function _action($id)
    {
        return new Action($id, new Controller('test', Yii::$app));
    }
}
