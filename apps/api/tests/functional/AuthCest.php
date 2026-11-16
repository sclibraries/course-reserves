<?php
/**
 * AuthCest.php — Smoke tests for authentication flows.
 *
 * Authentication boundary checks for the faculty API.
 *
 * Dev login and mock-login policy are covered by unit and entry-point tests.
 * This suite verifies normal bearer authentication and mock-token lifetime.
 *   UserController uses HttpBearerAuth which returns a proper 401 for
 *   missing or invalid tokens.  Testable through the Yii2 module directly.
 *
 * PHP 7.2 compatible — no typed properties, no arrow functions, no ??=.
 */
class AuthCest extends BaseFunctionalCest
{
    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    // ── Test 1 ────────────────────────────────────────────────────────────────

    /**
     * A request with an invalid Bearer token returns 401.
     *
     * UserController enforces HttpBearerAuth, which is the proper Yii2 auth
     * mechanism and correctly returns HTTP 401 Unauthorized for bad tokens.
     */
    public function invalidTokenReturns401(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer INVALID.JWT.TOKEN');
        $I->amOnRoute('user/me');
        $I->seeResponseCodeIs(401);
    }

    public function mockLoginIssuesEightHourAccessToken(FunctionalTester $I)
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => http_build_query(['full_name' => 'Synthetic Faculty']),
                'ignore_errors' => true,
            ],
        ]);
        $responseBody = file_get_contents('http://localhost/faculty-submission/mock-login', false, $context);
        \PHPUnit\Framework\Assert::assertSame(200, (int) explode(' ', $http_response_header[0])[1]);
        $response = json_decode($responseBody, true);
        $accessClaims = (array) \Firebase\JWT\JWT::decode(
            $response['token'],
            new \Firebase\JWT\Key(getenv('JWT_SECRET_KEY'), 'HS256')
        );
        $refreshClaims = (array) \Firebase\JWT\JWT::decode(
            $response['refreshToken'],
            new \Firebase\JWT\Key(getenv('JWT_SECRET_KEY'), 'HS256')
        );

        \PHPUnit\Framework\Assert::assertSame(28800, $accessClaims['exp'] - $accessClaims['iat']);
        \PHPUnit\Framework\Assert::assertSame($accessClaims['exp'], $response['user']['exp']);
        \PHPUnit\Framework\Assert::assertSame(
            'Mock login successful. This token is valid for 8 hours.',
            $response['message']
        );
        \PHPUnit\Framework\Assert::assertSame(86400, $refreshClaims['exp'] - $refreshClaims['iat']);
    }
}
