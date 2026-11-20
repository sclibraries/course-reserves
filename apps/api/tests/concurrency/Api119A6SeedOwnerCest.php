<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';

use PHPUnit\Framework\Assert;

/** The development seed owns the retry when the source-resource hook finds a dependent moved after discovery. */
class Api119A6SeedOwnerCest extends Api116B1ConcurrencyCase
{
    private const PERIODS = ['current_period' => 'AP_209909', 'upcoming_period' => 'AP_210002'];

    public function _after(ConcurrencyTester $I)
    {
        parent::_after($I);
        $seed = new \app\services\DevSeedService();
        $seed->reset();
        $seed->seed(); // restore the runner's seeded Print book mapping for later suites
    }

    public function seedRetriesWholeWhenAHookDependentMovesAfterDiscovery(ConcurrencyTester $I)
    {
        $db = \Yii::$app->db;
        (new \app\services\DevSeedService())->seed(self::PERIODS['current_period'], self::PERIODS['upcoming_period']);
        $resourceId = (int)$db->createCommand(
            'SELECT resource_id FROM resources WHERE name = "test-cx029-article"'
        )->queryScalar();
        $db->createCommand()->update('resources', ['description' => 'Stale description.'], ['resource_id' => $resourceId])
            ->execute();
        $moving = $this->item('seed-moving');
        $target = $this->item('seed-target');
        foreach ([$moving, $target] as $item) {
            $this->tracker->fixture()->setMarkers($item, ['source_resource_id' => (string)$resourceId]);
            $this->tracker->insertPublicationState($item);
        }

        $label = 'seed-owner';
        $this->supervisor->start($label, ['op' => 'item_lock_owner_seed', 'resource_id' => $resourceId] + self::PERIODS);
        $ready = $this->supervisor->awaitPhase($label, 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, (int)$ready['connection_id']);
        Assert::assertSame('REPEATABLE-READ', $ready['isolation_level']);
        $this->connections[$label] = (int)$ready['connection_id'];
        $this->supervisor->release($label, 'ready', 0);

        $discovered = $this->supervisor->awaitPhase($label, 'discovered', 0);
        Assert::assertNotEmpty($discovered['context']['sql']);
        $db->createCommand()->update('submission_new_resources', ['submission_id' => $target['submission_id']], [
            'id' => $moving['id'],
        ])->execute();
        $this->supervisor->release($label, 'discovered', 0);

        $result = $this->supervisor->complete($label);
        Assert::assertSame(9, $result['result']['assignment_count']);
        $discoveries = array_filter($result['queries'], function ($sql) use ($resourceId) {
            return strpos($sql, 'FROM submission_new_resources item WHERE item.source_resource_id = \'' . $resourceId . '\'') !== false;
        });
        Assert::assertCount(2, $discoveries, 'one hook discovery per seed attempt');
        Assert::assertSame(1, (int)$db->createCommand(
            'SELECT COUNT(*) FROM resources WHERE resource_id = :id AND description LIKE "Synthetic journal article%"',
            [':id' => $resourceId]
        )->queryScalar());
        foreach ([$moving, $target] as $item) {
            $state = $db->createCommand(
                'SELECT submission_id, draft_revision FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
                [':id' => $item['id']]
            )->queryOne();
            Assert::assertSame((int)$target['submission_id'], (int)$state['submission_id']);
            Assert::assertSame(18, (int)$state['draft_revision'], 'exactly one committed invalidation');
        }
    }
}
