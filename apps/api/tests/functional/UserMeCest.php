<?php

use app\models\User;

/**
 * Verifies user profile endpoints resolve authenticated staff to their database record.
 */
class UserMeCest extends BaseFunctionalCest
{
    private $_staffToken;
    private $_unknownAccountToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);

        $staff = User::findByUsername('devadmin');
        if (!$staff) {
            throw new \RuntimeException('The synthetic staff account must be seeded.');
        }
        $issuedAt = time();
        $this->_staffToken = \Firebase\JWT\JWT::encode([
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
            'username' => $staff->username,
            'role' => $staff->role,
            'id' => $staff->id,
            'full_name' => $staff->full_name,
            'email' => $staff->email,
            'institution' => $staff->institution,
        ], getenv('JWT_SECRET_KEY'), 'HS256');

        \PHPUnit\Framework\Assert::assertNull(
            User::findByUsername('tnobody'),
            'The synthetic mock login must not have a matching users row.'
        );
        $this->_unknownAccountToken = $this->_requestToken(
            'http://localhost/faculty-submission/mock-login',
            ['full_name' => 'Test Nobody'],
            'token'
        );
    }

    public function staffTokenReturnsUserForMe(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->_staffToken);
        $I->amOnRoute('user/me');
        $I->seeResponseCodeIs(200);

        $this->_assertStaffResponse($I);
    }

    public function staffTokenReturnsUserForCurrent(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->_staffToken);
        $I->amOnRoute('user/current');
        $I->seeResponseCodeIs(200);

        $this->_assertStaffResponse($I);
    }

    public function anonymousRequestsRequireAuthentication(FunctionalTester $I)
    {
        $I->deleteHeader('Authorization');
        $I->amOnRoute('user/me');
        $I->seeResponseCodeIs(401);

        $I->deleteHeader('Authorization');
        $I->amOnRoute('user/current');
        $I->seeResponseCodeIs(401);
    }

    public function loginWithoutUserAccountIsForbidden(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->_unknownAccountToken);
        $I->amOnRoute('user/me');
        $I->seeResponseCodeIs(403);
        \PHPUnit\Framework\Assert::assertStringContainsString(
            'No user account for this login.',
            $I->grabPageSource()
        );

        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->_unknownAccountToken);
        $I->amOnRoute('user/current');
        $I->seeResponseCodeIs(403);
        \PHPUnit\Framework\Assert::assertStringContainsString(
            'No user account for this login.',
            $I->grabPageSource()
        );
    }

    private function _assertStaffResponse(FunctionalTester $I)
    {
        $response = json_decode($I->grabPageSource(), true);

        \PHPUnit\Framework\Assert::assertTrue(is_array($response));
        foreach ([
            'id',
            'username',
            'full_name',
            'email',
            'department',
            'institution',
            'role',
            'is_admin',
            'permissions',
        ] as $key) {
            \PHPUnit\Framework\Assert::assertArrayHasKey($key, $response);
        }

        \PHPUnit\Framework\Assert::assertSame('devadmin', $response['username']);
        \PHPUnit\Framework\Assert::assertSame('Dev Admin', $response['full_name']);
        \PHPUnit\Framework\Assert::assertSame('admin', $response['role']);
        \PHPUnit\Framework\Assert::assertTrue($response['is_admin']);
        \PHPUnit\Framework\Assert::assertTrue(is_array($response['permissions']));
    }

    private function _requestToken($url, array $postData, $tokenKey)
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => http_build_query($postData),
                'ignore_errors' => true,
            ],
        ]);
        $body = file_get_contents($url, false, $context);
        $data = json_decode($body, true);

        if (!is_array($data) || empty($data[$tokenKey])) {
            throw new \RuntimeException(
                "Expected '{$tokenKey}' in response from {$url}. Got: {$body}"
            );
        }

        return $data[$tokenKey];
    }
}
