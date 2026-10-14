<?php

/**
 * ApiRootCest.php — Verifies the API root's public status response.
 *
 * PHP 7.2 compatible.
 */
class ApiRootCest extends BaseFunctionalCest
{
    /**
     * Checks the status and exact JSON response body.
     *
     * @param FunctionalTester $I The functional test actor.
     *
     * @return void
     */
    public function returnsJsonStatus(FunctionalTester $I)
    {
        $I->amOnPage('/');
        $I->seeResponseCodeIs(200);

        \PHPUnit\Framework\Assert::assertSame(
            '{"service":"course-reserves-api","status":"ok"}',
            $I->grabPageSource()
        );
    }
}
