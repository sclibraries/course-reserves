<?php

use PHPUnit\Framework\Assert;
use app\services\FolioService;
use app\services\FlowRepository;

/** Covers readiness and item-flow roll-up on staff submission details. */
class Api095SubmissionReadinessCest extends BaseFunctionalCest
{
    private $uuid = '77000000-0000-4000-8000-000000000095';
    private $submissionId;
    private $folio;
    private $flows;
    private $materialTypeId;
    private $flowId;
    private $token;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->submissionId = TestSubmissionFixture::create($this->uuid, 'test-api095-faculty');
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'link_state' => 'linked',
        ], ['submission_id' => $this->submissionId])->execute();
        $this->folio = new TestApi095FolioService();
        $this->flows = new class extends FlowRepository {
            public $latestRunsCalls = 0;
            public $latestRunsBatchSizes = [];
            public $mappedFlowsCalls = 0;
            public $mappedFlowTypeBatches = [];

            public function latestRunsForItems(array $items)
            {
                $this->latestRunsCalls++;
                $this->latestRunsBatchSizes[] = count($items);
                return parent::latestRunsForItems($items);
            }

            public function mappedFlowsForMaterialTypes(array $materialTypeIds)
            {
                $this->mappedFlowsCalls++;
                $this->mappedFlowTypeBatches[] = $materialTypeIds;
                return parent::mappedFlowsForMaterialTypes($materialTypeIds);
            }
        };
        \Yii::$container->set(FolioService::class, $this->folio);
        \Yii::$container->setSingleton(FlowRepository::class, $this->flows);
        $this->token = $this->staffToken();
    }

    public function _after(FunctionalTester $I)
    {
        $db = \Yii::$app->db;
        if ($this->flowId) {
            $db->createCommand()->delete('item_flow_runs', ['flow_id' => $this->flowId])->execute();
            $db->createCommand()->delete('material_type_flows', ['flow_id' => $this->flowId])->execute();
            $db->createCommand()->delete('flow_versions', ['flow_id' => $this->flowId])->execute();
            $db->createCommand()->delete('flows', ['id' => $this->flowId])->execute();
        }
        if ($this->materialTypeId) {
            $db->createCommand()->delete('material_type_flows', ['material_type_id' => $this->materialTypeId])->execute();
            $db->createCommand()->delete('material_types', ['material_type_id' => $this->materialTypeId])->execute();
        }
        TestSubmissionFixture::delete($this->uuid);
        \Yii::$container->clear(FolioService::class);
        \Yii::$container->clear(FlowRepository::class);
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
            Assert::assertSame(['name' => null, 'current_step_label' => null, 'finish_state' => null], $item['flow']);
        }
    }

    public function folioFailureKeepsDetailAvailableAndReadinessUnknown(FunctionalTester $I)
    {
        $instanceId = '00000000-0000-4000-8000-000000000953';
        $this->setItems([[
            'source_folio_instance_id' => $instanceId,
            'resource_data' => ['title' => 'Synthetic lookup failure item'],
        ]]);
        $this->folio->results = [];

        $detail = $this->getDetail($I);

        Assert::assertSame([[$instanceId]], $this->folio->calls);
        Assert::assertSame('unknown', $detail['newResources'][0]['readiness']);
    }

    public function detailSummarizesFlowsWithoutStartingRunsAndMatchesTheItemFlowRoute(FunctionalTester $I)
    {
        $this->createMappedFlow();
        $this->setItems([
            ['material_type_id' => $this->materialTypeId, 'resource_data' => ['title' => 'Synthetic flow item one']],
            ['material_type_id' => $this->materialTypeId, 'resource_data' => ['title' => 'Synthetic flow item two']],
            ['material_type_id' => $this->materialTypeId, 'resource_data' => ['title' => 'Synthetic flow item three']],
        ]);

        $detail = $this->getDetail($I);
        $items = $detail['newResources'];

        Assert::assertSame(0, $this->runCount());
        Assert::assertSame(1, $this->flows->latestRunsCalls);
        Assert::assertSame([3], $this->flows->latestRunsBatchSizes);
        Assert::assertSame(1, $this->flows->mappedFlowsCalls);
        Assert::assertSame([[$this->materialTypeId]], $this->flows->mappedFlowTypeBatches);
        foreach ($items as $item) {
            Assert::assertSame([
                'name' => 'Synthetic API-095 mapped flow',
                'current_step_label' => 'Start processing',
                'finish_state' => null,
            ], $item['flow']);
        }

        $this->flows->insertRun('new', (int)$items[0]['id'], $this->flowId, 1, 'process');
        $routeState = $this->getItemFlow($I, $items[0]['id']);
        $detail = $this->getDetail($I);
        $summary = $detail['newResources'][0]['flow'];

        Assert::assertSame([
            'name' => $routeState['flow']['name'],
            'current_step_label' => $routeState['current_step']['step']['label'],
            'finish_state' => $routeState['finished']['finish_state'] ?? null,
        ], $summary);
        Assert::assertSame(1, $this->runCount());
        Assert::assertSame([3, 3], $this->flows->latestRunsBatchSizes);
        Assert::assertSame(2, $this->flows->latestRunsCalls);
        Assert::assertSame(2, $this->flows->mappedFlowsCalls);
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
                'material_type_id' => $item['material_type_id'] ?? null,
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

    private function createMappedFlow()
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('material_types', [
            'name' => 'test-api095-read-only-flow',
            'description' => 'Synthetic API-095 flow material type',
        ])->execute();
        $this->materialTypeId = (int)$db->getLastInsertID();
        $this->flowId = $this->flows->insertFlow(
            'Synthetic API-095 mapped flow', 'Synthetic API-095 read-only flow', 'test-api095-staff'
        );
        $this->flows->insertVersion($this->flowId, 1, [
            ['key' => 'start', 'kind' => 'question', 'label' => 'Start processing', 'outcomes' => []],
            ['key' => 'process', 'kind' => 'action', 'label' => 'In progress', 'outcomes' => []],
        ], 'test-api095-staff');
        $db->createCommand()->insert('material_type_flows', [
            'material_type_id' => $this->materialTypeId,
            'flow_id' => $this->flowId,
        ])->execute();
    }

    private function runCount()
    {
        return (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM item_flow_runs WHERE flow_id = :flow_id', [':flow_id' => $this->flowId]
        )->queryScalar();
    }

    private function getItemFlow(FunctionalTester $I, $itemId)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $this->token);
        $I->sendJsonRequest('GET', 'workflow-flow/item-flow', [], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        return $I->grabJsonResponse();
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
