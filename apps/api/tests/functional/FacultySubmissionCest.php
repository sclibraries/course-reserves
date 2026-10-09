<?php
/**
 * FacultySubmissionCest.php — Smoke tests for faculty submission CRUD.
 *
 * Uses the synthetic seed-faculty-workflow UUID and a manually-crafted
 * faculty JWT (same HS256 secret as faculty-authorize.php) so that
 * FacultySubmissionController authenticates the requests.
 *
 * The seeded UUID '11111111-1111-4111-8111-111111111111' belongs to shibboleth
 * user 'sandbox.faculty@example.test' and has status 'submitted' (editable).
 *
 * Note: FacultySubmissionController extends BaseRestController which uses
 * HttpBearerAuth. Missing or invalid tokens cause HttpBearerAuth to throw
 * UnauthorizedHttpException (HTTP 401), not ForbiddenHttpException (403).
 *
 * PHP 7.2 compatible — no typed properties, no arrow functions, no ??=.
 */
class FacultySubmissionCest extends BaseFunctionalCest
{
    /** UUID of an existing 'submitted' record owned by $shibbolethId. */
    private $uuid = '11111111-1111-4111-8111-111111111111';

    /** Shibboleth user ID that owns the above submission. */
    private $shibbolethId = 'sandbox.faculty@example.test';

    /** Faculty JWT minted in _before() and shared across tests. */
    private $token;

    /**
     * Delegate DB/URL setup to the base class, then mint a faculty JWT
     * for the submission owner so FacultySubmissionController accepts the token.
     */
    public function _before(FunctionalTester $I)
    {
        parent::_before($I);

        $secretKey = getenv('JWT_SECRET_KEY');
        $issuedAt  = time();
        $payload   = [
            'iat'         => $issuedAt,
            'exp'         => $issuedAt + 3600,
            'username'    => $this->shibbolethId,
            'role'        => 'faculty',
            'id'          => 0,
            'full_name'   => 'Test Faculty',
            'email'       => $this->shibbolethId . '@test.local',
            'institution' => 'SM',
        ];
        $this->token = \Firebase\JWT\JWT::encode($payload, $secretKey, 'HS256');
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    /**
     * GET /faculty-submission/{uuid} with a valid faculty token returns 200.
     */
    public function getWithValidTokenReturns200(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->amOnRoute('faculty-submission/view', ['id' => $this->uuid]);
        $I->seeResponseCodeIs(200);
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

    /**
     * PUT /faculty-submission/{uuid} with a valid payload returns 200.
     *
     * Updates submission_notes — a safe, non-critical field — to verify the
     * write path works end-to-end.  The submission has status 'submitted'
     * which FacultySubmission::canEdit() permits.
     */
    public function putWithValidPayloadReturns200(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendAjaxRequest(
            'PUT',
            '/faculty-submission/' . $this->uuid,
            ['submission_notes' => 'smoke-test update — safe to ignore']
        );
        $I->seeResponseCodeIs(200);
    }

    // ── Test 3 ────────────────────────────────────────────────────────────────

    /**
     * GET /faculty-submission/{uuid} without a token returns 401.
     *
     * HttpBearerAuth (inherited from BaseRestController) throws
     * UnauthorizedHttpException (HTTP 401) when no Authorization header is present.
     */
    public function getWithoutTokenReturns401(FunctionalTester $I)
    {
        $I->amOnRoute('faculty-submission/view', ['id' => $this->uuid]);
        $I->seeResponseCodeIs(401);
    }
}
