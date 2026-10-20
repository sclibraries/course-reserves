<?php

use PHPUnit\Framework\Assert;

/** Covers authenticated catalog availability by accession number. */
class Api088CatalogAvailabilityCest extends BaseFunctionalCest
{
    private $folio;
    private $facultyToken;
    private $staffToken;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->folio = new TestApi088FolioService();
        \Yii::$container->set(app\services\FolioService::class, $this->folio);
        $this->facultyToken = $this->token('faculty');
        $this->staffToken = $this->token('staff');
    }

    public function _after(FunctionalTester $I)
    {
        \Yii::$container->clear(app\services\FolioService::class);
    }

    public function resultsContainEachAccessionAndSkipNonFolioRequests(FunctionalTester $I)
    {
        $id = '00000000-0000-4000-8000-000000000881';
        $an = $this->accession($id);
        $nonFolioAn = 'smc.oai.edge.example.test.catalog-record';
        $copy = [
            'library' => 'SC Neilson Library',
            'location' => 'Smith College Neilson Stacks',
            'callNumber' => 'QA 100 .T47',
            'status' => 'Available',
            'loanType' => 'Standard Loan',
        ];
        $this->folio->results = [$id => [$copy]];

        $this->get($I, $an . ',' . $nonFolioAn, $this->facultyToken);

        $I->seeResponseCodeIs(200);
        $records = $this->response($I)['records'];
        Assert::assertSame([
            $an => ['instanceId' => $id, 'copies' => [$copy]],
            $nonFolioAn => ['instanceId' => null, 'copies' => []],
        ], $records);
        Assert::assertSame([[$id]], $this->folio->calls);
    }

    public function staffCanReadAvailability(FunctionalTester $I)
    {
        $this->get($I, 'smc.oai.edge.example.test.catalog-record', $this->staffToken);

        $I->seeResponseCodeIs(200);
        Assert::assertSame([
            'smc.oai.edge.example.test.catalog-record' => ['instanceId' => null, 'copies' => []],
        ], $this->response($I)['records']);
        Assert::assertSame([], $this->folio->calls);
    }

    public function failedInstanceDoesNotFailOtherAccessionNumbers(FunctionalTester $I)
    {
        $goodId = '00000000-0000-4000-8000-000000000881';
        $failedId = '00000000-0000-4000-8000-000000000882';
        $goodAn = $this->accession($goodId);
        $failedAn = $this->accession($failedId);
        $this->folio->results = [
            $goodId => [],
            $failedId => ['error' => true, 'reference' => 'synthetic-reference'],
        ];

        $this->get($I, $goodAn . ',' . $failedAn, $this->facultyToken);

        $I->seeResponseCodeIs(200);
        Assert::assertSame(['instanceId' => $goodId, 'copies' => []], $this->response($I)['records'][$goodAn]);
        Assert::assertSame([
            'instanceId' => $failedId,
            'error' => true,
            'reference' => 'synthetic-reference',
        ], $this->response($I)['records'][$failedAn]);
        Assert::assertSame([[$goodId, $failedId]], $this->folio->calls);
    }

    public function missingEmptyAndOverTwentyAccessionNumbersAreRejected(FunctionalTester $I)
    {
        $this->get($I, null, $this->facultyToken);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('invalid_request', $this->response($I)['error_code']);

        $this->get($I, ' , ', $this->facultyToken);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('invalid_request', $this->response($I)['error_code']);

        $tooMany = [];
        for ($number = 1; $number <= 21; $number++) {
            $tooMany[] = 'smc.synthetic.accession.' . $number;
        }
        $this->get($I, implode(',', $tooMany), $this->facultyToken);
        $I->seeResponseCodeIs(400);
        Assert::assertSame('invalid_request', $this->response($I)['error_code']);
        Assert::assertSame([], $this->folio->calls);
    }

    public function unauthenticatedRequestsReturn401AndOptionsIsAllowed(FunctionalTester $I)
    {
        $I->deleteHeader('Authorization');
        $I->sendJsonRequest('GET', 'catalog-availability', [], ['an' => 'smc.synthetic.accession']);
        $I->seeResponseCodeIs(401);

        $I->sendJsonRequest('OPTIONS', 'catalog-availability');
        $I->seeResponseCodeIs(204);
    }

    private function get(FunctionalTester $I, $an, $token)
    {
        if ($token === null) {
            $I->deleteHeader('Authorization');
        } else {
            $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        }
        $params = $an === null ? [] : ['an' => $an];
        $I->sendJsonRequest('GET', 'catalog-availability', [], $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = $I->grabJsonResponse();
        Assert::assertIsArray($response);
        return $response;
    }

    private function accession($id)
    {
        return 'scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.' . str_replace('-', '.', $id);
    }

    private function token($role)
    {
        $username = 'test-api088-' . $role;
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'internal_id' => '999088001',
            'full_name' => 'Synthetic API-088 ' . ucfirst($role),
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }
}

class TestApi088FolioService
{
    public $calls = [];
    public $results = [];

    public function fetchAvailability(array $instanceIds)
    {
        $this->calls[] = $instanceIds;
        return $this->results;
    }
}
