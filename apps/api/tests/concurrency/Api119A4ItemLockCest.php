<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';
require_once __DIR__ . '/../_support/Api116AFixture.php';

use PHPUnit\Framework\Assert;

class Api119A4ItemLockCest extends Api116B1ConcurrencyCase
{
    private $fixture;
    private $prefix;

    public function _before(ConcurrencyTester $I)
    {
        parent::_before($I);
        $this->prefix = 'test-api119a4-' . substr(md5(uniqid('', true)), 0, 8) . '-';
        $this->fixture = new Api116AFixture($this->prefix);
    }

    public function _after(ConcurrencyTester $I)
    {
        $this->supervisor->stopAll();
        $this->fixture->cleanup();
        parent::_after($I);
    }

    public function readsCurrentCompleteRowsAndRestartsAfterAssociationMovement(ConcurrencyTester $I)
    {
        $offeringId = $this->fixture->createOffering('item-lock');
        foreach (['new' => 'new', 'reuse' => 'legacy_reuse'] as $kind => $representation) {
            $item = $this->fixture->createItem('current-' . $kind, $offeringId, $representation);
            $label = 'current-' . $kind;
            $this->startReader($label, $kind, $item['id'], 1);
            $discovery = $this->supervisor->awaitPhase($label, 'discovered', 1);
            Assert::assertSame(1, preg_match('/submission_' . $kind . '_resources/', $discovery['context']['sql']));
            $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
            \Yii::$app->db->createCommand()->update('faculty_submissions', [
                'status' => 'in_review',
                'course_title' => $this->prefix . 'current submission ' . $kind,
            ], ['submission_id' => $item['submission_id']])->execute();
            \Yii::$app->db->createCommand()->update($table, [
                'item_status' => 'in_review',
                'public_note' => $this->prefix . 'current item ' . $kind,
                'claimed_by' => $this->prefix . 'current-reader',
            ], ['id' => $item['id']])->execute();
            $this->supervisor->release($label, 'discovered', 1);
            $current = $this->supervisor->complete($label);
            Assert::assertSame('in_review', $current['result']['submission']['status']);
            Assert::assertSame(
                $this->prefix . 'current submission ' . $kind,
                $current['result']['submission']['course_title']
            );
            Assert::assertSame('in_review', $current['result']['item']['item_status']);
            Assert::assertSame($this->prefix . 'current item ' . $kind, $current['result']['item']['public_note']);
            Assert::assertSame($this->prefix . 'current-reader', $current['result']['item']['claimed_by']);
            $this->assertAcquisitionAttempts($current['queries'], $kind, 1);

            $moving = $this->fixture->createItem('moving-' . $kind, $offeringId, $representation);
            $target = $this->fixture->createItem('target-' . $kind, $offeringId, $representation);
            $label = 'move-' . $kind;
            $this->startReader($label, $kind, $moving['id'], 2);
            $firstDiscovery = $this->supervisor->awaitPhase($label, 'discovered', 1);
            Assert::assertNotEmpty($firstDiscovery['context']['sql']);
            \Yii::$app->db->createCommand()->update(
                $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources',
                ['submission_id' => $target['submission_id']],
                ['id' => $moving['id']]
            )->execute();
            $this->supervisor->release($label, 'discovered', 1);
            $retryDiscovery = $this->supervisor->awaitPhase($label, 'discovered', 2);
            Assert::assertNotEmpty($retryDiscovery['context']['sql']);
            $this->supervisor->release($label, 'discovered', 2);
            $retried = $this->supervisor->complete($label);
            Assert::assertSame($target['submission_id'], $retried['result']['submission_id']);
            Assert::assertSame($target['submission_id'], (int)$retried['result']['item']['submission_id']);
            $this->assertAcquisitionAttempts($retried['queries'], $kind, 2);
        }
    }

    public function invalidatorMovementRetriesTheWholeResourceOwner(ConcurrencyTester $I)
    {
        $offeringId = $this->fixture->createOffering('invalidator');
        $resource = $this->fixture->createElectronicDestination($offeringId, 'invalidator-race');
        $moving = $this->fixture->createItem('invalidator-moving', $offeringId);
        $target = $this->fixture->createItem('invalidator-target', $offeringId);
        foreach ([$moving, $target] as $item) {
            \Yii::$app->db->createCommand()->update('submission_new_resources', [
                'source_resource_id' => (string)$resource['resource_id'],
            ], ['id' => $item['id']])->execute();
            $this->insertPublicationState($item);
        }

        $label = 'invalidator-owner';
        $this->supervisor->start($label, [
            'op' => 'item_lock_resource_update',
            'resource_id' => $resource['resource_id'],
            'body' => ['name' => $this->prefix . 'updated source'],
            'pause_attempts' => 2,
        ]);
        $ready = $this->supervisor->awaitPhase($label, 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, (int)$ready['connection_id']);
        Assert::assertSame('reserves_test', $ready['database']);
        Assert::assertSame('REPEATABLE-READ', $ready['isolation_level']);
        $this->connections[$label] = (int)$ready['connection_id'];
        $this->supervisor->release($label, 'ready', 0);

        $candidates = $this->supervisor->awaitPhase($label, 'discovered', 0);
        Assert::assertNotEmpty($candidates['context']['sql']);
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'submission_id' => $target['submission_id'],
        ], ['id' => $moving['id']])->execute();
        $this->supervisor->release($label, 'discovered', 0);

        $firstDiscovery = $this->supervisor->awaitPhase($label, 'discovered', 1);
        Assert::assertNotEmpty($firstDiscovery['context']['sql']);
        $this->supervisor->release($label, 'discovered', 1);
        $retryDiscovery = $this->supervisor->awaitPhase($label, 'discovered', 2);
        Assert::assertNotEmpty($retryDiscovery['context']['sql']);
        $this->supervisor->release($label, 'discovered', 2);

        $result = $this->supervisor->complete($label);
        Assert::assertSame($this->prefix . 'updated source', $result['result']['resource_name']);
        Assert::assertCount(2, array_filter($result['queries'], function ($sql) {
            return preg_match('/^UPDATE `?resources`? SET /i', $sql);
        }));
        $this->assertAcquisitionAttempts($result['queries'], 'new', 3);
        foreach ([$moving, $target] as $item) {
            $state = \Yii::$app->db->createCommand(
                'SELECT submission_id, draft_revision FROM submission_publication_state '
                . 'WHERE item_kind = "new" AND item_id = :id', [':id' => $item['id']]
            )->queryOne();
            Assert::assertSame($target['submission_id'], (int)$state['submission_id']);
            Assert::assertSame(18, (int)$state['draft_revision']);
        }
    }

    private function startReader($label, $kind, $itemId, $pauseAttempts)
    {
        $this->supervisor->start($label, [
            'op' => 'item_lock_read',
            'kind' => $kind,
            'item_id' => (int)$itemId,
            'pause_attempts' => $pauseAttempts,
        ]);
        $ready = $this->supervisor->awaitPhase($label, 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, (int)$ready['connection_id']);
        Assert::assertSame('reserves_test', $ready['database']);
        Assert::assertSame('REPEATABLE-READ', $ready['isolation_level']);
        $this->connections[$label] = (int)$ready['connection_id'];
        $this->supervisor->release($label, 'ready', 0);
    }

    private function insertPublicationState(array $item)
    {
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => $item['kind'],
            'item_id' => $item['id'],
            'submission_id' => $item['submission_id'],
            'state' => 'published',
            'draft_revision' => 17,
            'published_revision' => 12,
            'pending_changes' => 'none',
            'published_destination_json' => '{"kind":"electronic","resource_id":119004}',
            'published_snapshot' => '{"resource":{"name":"Synthetic source"}}',
            'created_at' => '2026-10-01 10:00:00',
            'updated_at' => '2026-10-01 10:00:01',
        ])->execute();
    }

    private function assertAcquisitionAttempts(array $queries, $kind, $attempts)
    {
        $table = $kind === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $discoveries = array_filter($queries, function ($sql) use ($table) {
            return preg_match('/SELECT submission_id FROM ' . $table . ' WHERE id =/i', $sql);
        });
        $locks = array_values(array_filter($queries, function ($sql) {
            return preg_match(
                '/SELECT \* FROM (?:faculty_submissions|submission_new_resources|submission_reuse_resources) '
                . '.*FOR UPDATE/i',
                $sql
            );
        }));
        Assert::assertCount($attempts, $discoveries);
        Assert::assertCount(2 * $attempts, $locks);
        for ($index = 0; $index < $attempts; $index++) {
            Assert::assertSame(1, preg_match('/SELECT \* FROM faculty_submissions .*FOR UPDATE/i', $locks[2 * $index]));
            Assert::assertSame(1, preg_match('/SELECT \* FROM ' . $table . ' .*FOR UPDATE/i', $locks[2 * $index + 1]));
        }
    }
}
