<?php

/**
 * Unit tests for normalized JWT identity claims.
 */
namespace tests\unit\models;

use app\models\JwtIdentity;
use Firebase\JWT\JWT;

/**
 * Verifies canonical and legacy internal identifier claims.
 */
class JwtIdentityTest extends \Codeception\Test\Unit
{
    private const TEST_SECRET = 'api-031-synthetic-unit-test-key';

    /**
     * Original JWT signing key from the test environment.
     *
     * @var string|false
     */
    private $_originalSecret;

    /**
     * Set a deterministic signing key for token assertions.
     *
     * @return void
     */
    protected function _before()
    {
        $this->_originalSecret = getenv('JWT_SECRET_KEY');
        putenv('JWT_SECRET_KEY=' . self::TEST_SECRET);
    }

    /**
     * Restore the test environment's signing key.
     *
     * @return void
     */
    protected function _after()
    {
        if ($this->_originalSecret === false) {
            putenv('JWT_SECRET_KEY');
            return;
        }

        putenv('JWT_SECRET_KEY=' . $this->_originalSecret);
    }

    /**
     * Canonical internal_id populates the normalized identity property.
     *
     * @return void
     */
    public function testCanonicalInternalIdClaimPopulatesNormalizedProperty()
    {
        $identity = JwtIdentity::findIdentityByAccessToken(
            $this->_encode(
                [
                'full_name' => 'Synthetic Faculty',
                'internal_id' => '999000001',
                ]
            )
        );

        $this->assertInstanceOf(JwtIdentity::class, $identity);
        $this->assertSame('999000001', $identity->internalId);
    }

    /**
     * The misspelled legacy claim remains readable during token migration.
     *
     * @return void
     */
    public function testLegacyInternalIdClaimIsNormalized()
    {
        $identity = JwtIdentity::findIdentityByAccessToken(
            $this->_encode(
                [
                'full_name' => 'Synthetic Faculty',
                'interal_id' => '999000002',
                ]
            )
        );

        $this->assertInstanceOf(JwtIdentity::class, $identity);
        $this->assertSame('999000002', $identity->internalId);
    }

    /**
     * Encode synthetic claims with the unit test key.
     *
     * @param  array $claims Additional JWT identity claims.
     * @return string
     */
    private function _encode(array $claims)
    {
        return JWT::encode(
            array_merge(
                [
                'iat' => time() - 1,
                'exp' => time() + 60,
                'username' => 'synthetic-faculty',
                ], $claims
            ),
            self::TEST_SECRET,
            'HS256'
        );
    }
}
