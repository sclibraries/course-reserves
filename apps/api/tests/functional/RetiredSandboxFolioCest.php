<?php

/**
 * Confirms the obsolete API-backed FOLIO sandbox endpoint is no longer served.
 */
class RetiredSandboxFolioCest extends BaseFunctionalCest
{
    public function oldSandboxSearchEndpointIsNotFound(FunctionalTester $I)
    {
        $I->sendJsonRequest('GET', 'sandbox-folio/search-courses');
        $I->seeResponseCodeIs(404);
    }
}
