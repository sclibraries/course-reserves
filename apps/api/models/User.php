<?php
namespace app\models;

use yii\db\ActiveRecord;

class User extends ActiveRecord
{
    /**
     * {@inheritdoc}
     */
    public static function tableName()
    {
        return 'users'; // Replace with your actual table name
    }

    /**
     * {@inheritdoc}
     */
    public function rules()
    {
        return [
            [['username', 'full_name', 'email', 'institution'], 'required'],
            ['email', 'email'],
            ['email', 'validateInstitutionalEmail'],
            [['username', 'full_name', 'email', 'department', 'institution'], 'string'],
            ['role', 'default', 'value' => 'user'],
            ['approved', 'default', 'value' => 0],
            ['created_at', 'safe'],
        ];
    }

    /**
     * Validates that the email is from an allowed domain
     */
    public function validateInstitutionalEmail($attribute, $params)
    {
        $validDomains = ['smith.edu', 'hampshire.edu', 'amherst.edu', 'mtholyoke.edu', 'umass.edu'];
        $domain = explode('@', $this->$attribute)[1] ?? '';

        if (!in_array($domain, $validDomains)) {
            $this->addError($attribute, 'Email must be from a Five College institution.');
        }
    }

    /**
     * Finds user by username
     *
     * @param string $username
     * @return static|null
     */
    public static function findByUsername($username)
    {
        return static::findOne(['username' => $username]); // Fetch user from the database
    }

    /**
     * Check if user has a specific permission
     *
     * @param string $permission The permission key to check
     * @return bool Whether the user has the permission
     */
    public function hasPermission($permission)
    {
        // Admins have all permissions
        if ($this->role === 'admin') {
            return true;
        }

        // Check if the user's institution has this permission
        return InstitutionPermission::isGranted($this->institution, $permission);
    }

    /**
     * Get all permissions for this user
     *
     * @return array List of permission keys the user has
     */
    public function getPermissions()
    {
        // Admins have all permissions
        if ($this->role === 'admin') {
            // Return all possible permissions
            return InstitutionPermission::find()
                ->select(['permission_key'])
                ->distinct()
                ->column();
        }

        // Return permissions for the user's institution
        return InstitutionPermission::getInstitutionPermissions($this->institution);
    }

    /**
     * Check if user can customize a specific institution
     *
     * @param string $institution The institution to check
     * @return bool Whether the user can customize this institution
     */
    public function canCustomizeInstitution($institution)
    {
        // Admins can customize any institution
        if ($this->role === 'admin') {
            return true;
        }

        // Users can only customize their own institution if they have permission
        return $this->institution === $institution &&
            $this->hasPermission("customize_{$institution}");
    }
}
