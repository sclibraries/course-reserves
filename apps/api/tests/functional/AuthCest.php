<?php
/**
 * AuthCest.php — Smoke tests for authentication flows.
 *
 * Test 1 (validLoginReturnsTokens):
 *   DevAuthController rejects calls when YII_ENV !== 'dev'.  Codeception
 *   bootstraps with YII_ENV='test', so this test calls the running Apache
 *   server via HTTP.  web/index.php defines YII_ENV='dev', so the real
 *   DevAuth endpoint is exercised end-to-end.
 *
 * Test 2 (invalidTokenReturns401):
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

    /**
     * A valid dev login returns an access_token and refresh_token.
     *
     * DevAuthController requires YII_ENV='dev' which Codeception overrides to
     * 'test'.  We therefore call the Apache web server running in the same
     * container via HTTP — web/index.php defaults YII_ENV to 'dev' — so the
     * real controller code path is exercised.
     */
    public function validLoginReturnsTokens(FunctionalTester $I)
    {
        $url     = 'http://localhost/dev-auth/login';
        $context = stream_context_create([
            'http' => [
                'method'        => 'POST',
                'header'        => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content'       => http_build_query(['username' => 'devadmin']),
                'ignore_errors' => true,
            ],
        ]);

        // $http_response_header is not populated when the Codeception Yii2
        // module intercepts the PHP HTTP stream wrapper, so we assert on the
        // response body rather than the status line.
        $body = file_get_contents($url, false, $context);
        $data = json_decode($body, true);

        if (empty($data['access_token'])) {
            throw new \RuntimeException(
                "Expected 'access_token' in response from POST /dev-auth/login. Got: {$body}"
            );
        }

        if (empty($data['refresh_token'])) {
            throw new \RuntimeException(
                "Expected 'refresh_token' in response from POST /dev-auth/login. Got: {$body}"
            );
        }

        $I->comment('Valid login returned access_token and refresh_token.');
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

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
}
