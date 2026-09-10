<?php

namespace tests\unit\controllers;

use app\controllers\UserController;

class UserControllerTest extends \Codeception\Test\Unit
{
    public function testUserManagementActionsAreNotBroadlyAllowedToEveryAuthenticatedUser()
    {
        $controller = new UserController('user', \Yii::$app);
        $behaviors = $controller->behaviors();
        $adminActions = ['index', 'view', 'create', 'update', 'delete', 'approve', 'reject', 'pending'];

        foreach ($behaviors['access']['rules'] as $rule) {
            $actions = $rule['actions'] ?? [];
            $hasAdminAction = (bool) array_intersect($adminActions, $actions);
            $allowsAuthenticatedUsers = ($rule['allow'] ?? false) === true
                && ($rule['roles'] ?? []) === ['@'];

            $this->assertFalse(
                $hasAdminAction && $allowsAuthenticatedUsers && !isset($rule['matchCallback']),
                'Admin user-management actions must not be broadly allowed to every authenticated user.'
            );
        }
    }
}
