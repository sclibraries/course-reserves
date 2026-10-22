<?php

use PHPUnit\Framework\Assert;
use app\services\FolioService;

/** Covers readiness and item-flow roll-up on staff submission details. */
class Api095SubmissionReadinessCest extends BaseFunctionalCest
{
    private $uuid = '77000000-0000-4000-8000-000000000095';
    private $submissionId;
    private $folio;
    private $token;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->submissionId = TestSubmissionFixture::create($this->uuid, 'test-api095-faculty');
        $this->folio = new TestApi095FolioService();
        \Yii::$container->set(FolioService::class, $this->folio);
        $this->token = $this->staffToken();
    }

    public function _after(FunctionalTester $I)
    {
        TestSubmissionFixture::delete($this->uuid);
        \Yii::$container->clear(FolioService::class);
    }

    public function detailBatchesCatalogItemsAndIncludesReadinessAndFlow(FunctionalTester $I)
    {
        $smithId = '00000000-0000-4000-8000-000000000951';
        $amherstId = '00000000-0000-4000-8000-000000000952';
        $this->setItems([
            ['source_folio_instance_id' => $smithId, 'resource_data' => ['title' => 'Synthetic print item']],
            ['resource_data' => [
                'title' => 'Synthetic EDS item',
                'eds' => ['dbId' => 'synthetic-db', 'an' => $this->accession($amherstId)],
            ]],
            ['resource_data' => ['title' => 'Synthetic manual item']],
        ]);
        $this->folio->results = [
            $smithId => [['library' => 'Smith College', 'status' => 'Available']],
            $amherstId => [],
        ];

        $detail = $this->getDetail($I);

        Assert::assertSame([[$smithId, $amherstId]], $this->folio->calls);
        Assert::assertSame(['ready', 'missing', 'unknown'], array_column($detail['newResources'], 'readiness'));
        Assert::assertSame('Available at a Five College library.', $detail['newResources'][0]['readiness_reason']);
        foreach ($detail['newResources'] as $item) {
            Assert::assertSame(['name', 'current_step_label', 'finish_state'], array_keys($item['flow']));
        }
    }

    public function folioFailureKeepsDetailAvailableAndReadinessUnknown(FunctionalTester $I)
    {
        $instanceId = '00000000-0000-4000-8000-000000000953';
        $this->setItems([[
            'source_folio_instance_id' => $instanceId,
            'resource_data' => ['title' => 'Synthetic lookup failure item'],
        ]]);
        $this->folio->results = [
            $instanceId => ['error' => true, 'reference' => 'synthetic-api095-reference'],
        ];

        $detail = $this->getDetail($I);

        Assert::assertSame([[$instanceId]], $this->folio->calls);
        Assert::assertSame('unknown', $detail['newResources'][0]['readiness']);
    }

    public function manualOnlyDetailSkipsFolioAvailability(FunctionalTester $I)
    {
        $detail = $this->getDetail($I);

        Assert::assertSame([], $this->folio->calls);
        Assert::assertArrayHasKey('readiness', $detail['newResources'][0]);
        Assert::assertSame('unknown', $detail['newResources'][0]['readiness']);
    }

    private function getDetail(FunctionalTester $I)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('GET', 'submission-workflow/view-submission', [], ['id' => $this->submissionId]);
        $I->seeResponseCodeIs(200);
        return $I->grabJsonResponse();
    }

    private function setItems(array $items)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->delete('submission_new_resources', ['submission_id' => $this->submissionId])->execute();
        foreach ($items as $index => $item) {
            $db->createCommand()->insert('submission_new_resources', [
                'submission_id' => $this->submissionId,
                'resource_data' => json_encode($item['resource_data']),
                'source_folio_instance_id' => $item['source_folio_instance_id'] ?? null,
                'display_order' => $index,
                'item_status' => 'pending',
            ])->execute();
        }
    }

    private function accession($instanceId)
    {
        return 'scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.' . str_replace('-', '.', $instanceId);
    }

    private function staffToken()
    {
        return \Firebase\JWT\JWT::encode([
            'iat' => time() - 1,
            'exp' => time() + 3600,
            'username' => 'test-api095-staff',
            'role' => 'staff',
            'id' => 'test-api095-staff',
            'internal_id' => '999095001',
            'full_name' => 'Synthetic API-095 Staff',
            'email' => 'test-api095-staff@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }
}

class TestApi095FolioService
{
    public $calls = [];
    public $results = [];

    public function fetchAvailability(array $instanceIds)
    {
        $this->calls[] = $instanceIds;
        return $this->results;
    }
}
