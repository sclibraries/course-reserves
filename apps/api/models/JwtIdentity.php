<?php

namespace app\models;

use Yii;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use yii\web\IdentityInterface;

/**
 * JWT-based identity that validates tokens without a database lookup.
 *
 * Used by BaseRestController's HttpBearerAuth behavior so that faculty tokens
 * (issued by faculty-authorize.php, no users table record required) and staff
 * tokens are both accepted through the same code path.
 */
class JwtIdentity implements IdentityInterface
{
    /** @var string|int */
    public $id;
    /** @var string */
    public $username;
    /** @var string */
    public $role;
    /** @var string */
    public $fullName;
    /** @var string */
    public $internalId;
    /** @var string */
    public $email;
    /** @var string */
    public $institution;

    private function __construct(array $claims)
    {
        $this->id          = $claims['id']        ?? $claims['username'] ?? null;
        $this->username    = $claims['username']  ?? null;
        $this->role        = $claims['role']       ?? null;
        $this->fullName    = $claims['full_name']  ?? null;
        $this->internalId  = $claims['internal_id'] ?? $claims['interal_id'] ?? null;
        $this->email       = $claims['email']      ?? null;
        $this->institution = $claims['institution'] ?? null;
    }

    /**
     * Decodes a JWT bearer token and returns a JwtIdentity on success, null on failure.
     */
    public static function findIdentityByAccessToken($token, $type = null)
    {
        $secretKey = getenv('JWT_SECRET_KEY');
        if (!$secretKey) {
            Yii::error('JWT_SECRET_KEY env var is not set', 'jwt');
            return null;
        }

        try {
            $decoded = JWT::decode($token, new Key($secretKey, 'HS256'));
            // firebase/php-jwt ^6 throws ExpiredException automatically; no manual check needed.
            return new self((array) $decoded);

        } catch (\Exception $e) {
            Yii::error('JwtIdentity decode failed: ' . $e->getMessage(), 'jwt');
            return null;
        }
    }

    /**
     * Not supported — this identity is token-only, no persistent session.
     */
    public static function findIdentity($id)
    {
        return null;
    }

    public function getId()
    {
        return $this->id;
    }

    public function getAuthKey()
    {
        return null;
    }

    public function validateAuthKey($authKey)
    {
        return false;
    }
}
