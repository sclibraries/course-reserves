<?php
/**
 * AuthCest.php — Smoke tests for authentication flows.
 *
 * Authentication boundary checks for the faculty API.
 *
 * Dev login and mock-login policy are covered by unit and entry-point tests.
 * This functional test verifies normal bearer authentication.
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
}
