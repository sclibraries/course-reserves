<?php

namespace tests\unit\models;

use app\models\User;
use Yii;

class UserTest extends \Codeception\Test\Unit
{
    /**
     * Finds a synthetic stored user and returns null for a missing username.
     *
     * @return void
     */
    public function testFindByUsernameUsesStoredUserRow()
    {
        $username = 'api065-user';
        $command = Yii::$app->db->createCommand();
        $command->delete('users', ['username' => $username])->execute();

        try {
            $row = [
                'username' => $username,
                'full_name' => 'API 065 Test User',
                'email' => 'api065-user@example.edu',
                'institution' => 'Smith College',
                'role' => 'user',
            ];
            $command->insert('users', $row)->execute();

            $user = User::findByUsername($username);
            $this->assertInstanceOf(User::class, $user);
            $this->assertSame($username, $user->username);
            $this->assertNull(User::findByUsername('api065-missing-user'));
        } finally {
            $command->delete('users', ['username' => $username])->execute();
        }
    }

    /**
     * Requires model fields and accepts an allowed institutional email domain.
     *
     * @return void
     */
    public function testRulesRequireFieldsAndAllowInstitutionalEmailDomain()
    {
        $user = new User();
        $user->username = 'api065-validation-user';
        $user->full_name = '';
        $user->email = 'api065-validation-user@smith.edu';
        $user->institution = 'Smith College';

        $this->assertFalse($user->validate());
        $this->assertArrayHasKey('full_name', $user->getErrors());

        $user->full_name = 'API 065 Validation User';
        $this->assertTrue($user->validate());
    }

    /**
     * Returns all permissions for admins and institution permissions for users.
     *
     * @return void
     */
    public function testGetPermissionsForSyntheticAdminAndUser()
    {
        $institution = 'API 065 Test Institution';
        $permission = 'api065-test-permission';
        $command = Yii::$app->db->createCommand();
        $where = [
            'institution' => $institution,
            'permission_key' => $permission,
        ];
        $command->delete('institution_permissions', $where)->execute();

        try {
            $row = [
                'institution' => $institution,
                'permission_key' => $permission,
                'granted' => 1,
            ];
            $command->insert('institution_permissions', $row)->execute();

            $admin = new User(['role' => 'admin']);
            $this->assertContains($permission, $admin->getPermissions());

            $user = new User();
            $user->role = 'user';
            $user->institution = $institution;
            $this->assertSame([$permission], $user->getPermissions());
        } finally {
            $command->delete('institution_permissions', $where)->execute();
        }
    }
}
