<?php
namespace app\models;

use Yii;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use yii\web\UnauthorizedHttpException;
use yii\db\ActiveRecord;
use yii\web\IdentityInterface;

class User extends ActiveRecord implements IdentityInterface
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
     * {@inheritdoc}
     */
    public static function findIdentity($id)
    {
        return static::findOne($id); // Fetch user from the database
    }

    /**
     * Decodes JWT token and finds the user by the username embedded in the token.
     * This method is used by HttpBearerAuth to authenticate the user via JWT token.
     *
     * {@inheritdoc}
     */
    public static function findIdentityByAccessToken($token, $type = null)
    {
        try {
            // Decode the JWT token using the secret key
            $decoded = JWT::decode($token, new Key(getenv('JWT_SECRET_KEY'), 'HS256'));
            
            // Log token decoding success
            Yii::info('JWT Token Decoded: ' . json_encode($decoded), 'jwt');
    
            // Verify the token has not expired
            if (isset($decoded->exp) && $decoded->exp < time()) {
                throw new UnauthorizedHttpException('The token has expired.');
            }
    
            // Get the user
            $user = static::findByUsername($decoded->username);
            
            // Check if the user is approved
            if ($user && $user->approved != 1) {
                Yii::error('User not approved: ' . $decoded->username, 'auth');
                return null;
            }
            
            // Optionally update the user instance with role from token
            if ($user && isset($decoded->role)) {
                $user->role = $decoded->role;
            }
    
            return $user;
    
        } catch (\Exception $e) {
            // If the token is invalid or decoding fails, log the error and return null
            Yii::error('JWT Decoding failed: ' . $e->getMessage(), 'jwt');
            return null;
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
     * {@inheritdoc}
     */
    public function getId()
    {
        return $this->id;
    }

    /**
     * {@inheritdoc}
     */
    public function getAuthKey()
    {
        return $this->authKey; // Assuming your table has an `authKey` column
    }

    /**
     * {@inheritdoc}
     */
    public function validateAuthKey($authKey)
    {
        return $this->authKey === $authKey;
    }

    /**
     * Validates password
     *
     * @param string $password password to validate
     * @return bool if password provided is valid for current user
     */
    public function validatePassword($password)
    {
        return Yii::$app->security->validatePassword($password, $this->password); // Use Yii's password validation
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