<?php

/**
 * Unit tests for shared faculty JWT claim construction.
 */
namespace tests\unit\services;

use app\services\FacultyTokenClaims;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/**
 * Verifies canonical authorization and refresh JWT payloads.
 */
class FacultyTokenClaimsTest extends \Codeception\Test\Unit
{
    private const ACCESS_KEY = 'api-031-synthetic-access-key';
    private const REFRESH_KEY = 'api-031-synthetic-refresh-key';

    /**
     * Authorization claims use the canonical field for both token types.
     *
     * @return void
     */
    public function testAuthorizationBuildsCanonicalAccessAndRefreshPayloads()
    {
        $issuedAt = time();
        $identityClaims = [
            'username' => 'synthetic-faculty',
            'role' => 'faculty',
            'id' => 'synthetic-faculty',
            'full_name' => 'Synthetic Faculty',
            'email' => 'faculty@example.test',
            'institution' => 'TEST',
        ];

        $accessPayload = FacultyTokenClaims::forAuthorization(
            $identityClaims,
            '999000005',
            $issuedAt,
            $issuedAt + 3600
        );
        $refreshPayload = FacultyTokenClaims::forAuthorization(
            $identityClaims,
            '999000005',
            $issuedAt,
            $issuedAt + 86400
        );

        $this->_assertCanonicalPayload(
            $this->_encodeAndDecode($accessPayload, self::ACCESS_KEY),
            '999000005',
            $issuedAt + 3600
        );
        $this->_assertCanonicalPayload(
            $this->_encodeAndDecode($refreshPayload, self::REFRESH_KEY),
            '999000005',
            $issuedAt + 86400
        );
    }

    /**
     * Legacy refresh claims rotate into canonical access and refresh tokens.
     *
     * @return void
     */
    public function testLegacyRefreshClaimsRemainCanonical()
    {
        $issuedAt = time();
        $legacyToken = JWT::encode(
            [
            'iat' => $issuedAt - 60,
            'exp' => $issuedAt + 60,
            'username' => 'synthetic-faculty',
            'role' => 'faculty',
            'id' => 'synthetic-faculty',
            'full_name' => 'Synthetic Faculty',
            'email' => 'faculty@example.test',
            'institution' => 'TEST',
            'interal_id' => '999000006',
            ], self::REFRESH_KEY, 'HS256'
        );
        $decodedLegacyClaims = (array) JWT::decode(
            $legacyToken,
            new Key(self::REFRESH_KEY, 'HS256')
        );

        $accessPayload = FacultyTokenClaims::forRefresh(
            $decodedLegacyClaims,
            $issuedAt,
            $issuedAt + 3600
        );
        $refreshPayload = FacultyTokenClaims::forRefresh(
            $decodedLegacyClaims,
            $issuedAt,
            $issuedAt + 86400
        );

        $this->_assertCanonicalPayload(
            $this->_encodeAndDecode($accessPayload, self::ACCESS_KEY),
            '999000006',
            $issuedAt + 3600
        );
        $this->_assertCanonicalPayload(
            $this->_encodeAndDecode($refreshPayload, self::REFRESH_KEY),
            '999000006',
            $issuedAt + 86400
        );
    }

    /**
     * Encode and decode a token with its matching key.
     *
     * @param  array  $payload JWT claims.
     * @param  string $key     Signing key.
     * @return array Decoded JWT claims.
     */
    private function _encodeAndDecode(array $payload, $key)
    {
        $token = JWT::encode($payload, $key, 'HS256');

        return (array) JWT::decode($token, new Key($key, 'HS256'));
    }

    /**
     * Assert the canonical identifier and expiration claims.
     *
     * @param  array  $payload    Decoded JWT claims.
     * @param  string $internalId Expected faculty identifier.
     * @param  int    $expiration Expected token expiration.
     * @return void
     */
    private function _assertCanonicalPayload(array $payload, $internalId, $expiration)
    {
        $this->assertArrayHasKey('internal_id', $payload);
        $this->assertSame($internalId, $payload['internal_id']);
        $this->assertArrayNotHasKey('interal_id', $payload);
        $this->assertSame($expiration, $payload['exp']);
    }
}
