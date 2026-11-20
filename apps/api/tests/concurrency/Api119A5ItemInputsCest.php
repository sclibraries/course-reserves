<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';
require_once __DIR__ . '/../_support/Api116B1CommittedConnection.php';

use PHPUnit\Framework\Assert;

class Api119A5ItemInputsCest extends Api116B1ConcurrencyCase
{
    private $restore;
    private $prefix;
    private $materialTypeIds = [];

    public function _before(ConcurrencyTester $I)
    {
        $this->restore = Api116B1CommittedConnection::swap();
        parent::_before($I);
        $this->prefix = 'test-api119a5-' . substr(md5(uniqid('', true)), 0, 8) . '-';
    }

    public function _after(ConcurrencyTester $I)
    {
        $this->supervisor->stopAll();
        parent::_after($I);
        if ($this->materialTypeIds) {
            \Yii::$app->db->createCommand()->delete('material_types', [
                'material_type_id' => $this->materialTypeIds,
            ])->execute();
        }
        call_user_func($this->restore);
    }

    public function detailsRejectsATypeDeletedAfterDiscovery(ConcurrencyTester $I)
    {
        $item = $this->newItem('deleted-type');
        $this->claim($item);
        $typeId = $this->materialType('Synthetic requested type');
        $label = 'details-deleted-type';
        $this->pauseAt($label, 'item_lock_a5_details', [
            'kind' => 'new', 'item_id' => $item['id'], 'actor' => $this->actor(),
            'body' => ['effective_material_type_id' => $typeId, 'public_note' => 'Synthetic rejected note'],
        ], 'discovered');

        \Yii::$app->db->createCommand()->delete('material_types', ['material_type_id' => $typeId])->execute();
        $result = $this->continueAfterDiscovery($label, 'details type deletion');

        Assert::assertSame(400, $result['result']['status']);
        Assert::assertSame('invalid_item_detail', $result['result']['body']['error_code']);
        $row = $this->itemRow($item);
        Assert::assertNull($row['staff_material_type_id']);
        Assert::assertNull($row['public_note']);
        Assert::assertSame(0, $this->eventCount($item['id']));
        Assert::assertSame(1, $this->discoveryCount($result['queries']));
    }

    public function detailsKeepsDisplayOnlyClassificationAfterTypeRename(ConcurrencyTester $I)
    {
        $item = $this->newItem('type-rename');
        $typeId = $this->materialType('Synthetic article');
        $this->setItem($item, [
            'material_type_id' => $typeId,
            'resource_data' => json_encode(['title' => 'Synthetic article item']),
            'access_path' => 'ill',
        ]);
        $this->claim($item);
        $label = 'details-type-rename';
        $this->pauseAt($label, 'item_lock_a5_details', [
            'kind' => 'new', 'item_id' => $item['id'], 'actor' => $this->actor(),
            'body' => ['public_note' => 'Synthetic display note'],
        ], 'discovered');

        \Yii::$app->db->createCommand()->update('material_types', [
            'name' => $this->prefix . 'unmapped current type',
        ], ['material_type_id' => $typeId])->execute();
        $result = $this->continueAfterDiscovery($label, 'details type rename');

        Assert::assertSame(200, $result['result']['status']);
        Assert::assertSame('ill', $result['result']['body']['item']['access_path']);
        $state = $this->state($item);
        Assert::assertSame(2, (int)$state['draft_revision']);
        Assert::assertSame(1, (int)$state['workflow_revision']);
        Assert::assertSame(1, $this->eventCount($item['id'], 'item_details_updated'));
        Assert::assertSame(0, $this->eventCount($item['id'], 'item_inputs_updated'));
        Assert::assertSame(1, $this->discoveryCount($result['queries']));
    }

    public function copyRefreshUsesCurrentSourceAndChildRowsInsideAnOldOuterSnapshot(ConcurrencyTester $I)
    {
        $item = $this->newItem('copy-refresh');
        $typeId = $this->materialType('ebook');
        $pointer = $this->electronic('copy-refresh');
        $oldName = $this->prefix . 'old source';
        $resourceId = $pointer['resource_id'];
        $db = \Yii::$app->db;
        $db->createCommand()->update('resources', [
            'name' => $oldName,
            'item_url' => 'https://example.test/old-source',
            'description' => 'Synthetic old description',
            'material_type_id' => $typeId,
        ], ['resource_id' => $resourceId])->execute();
        $db->createCommand()->delete('resource_links', ['resource_id' => $resourceId])->execute();
        $db->createCommand()->delete('resource_metadata', ['resource_id' => $resourceId])->execute();
        $this->setItem($item, [
            'source_resource_id' => (string)$resourceId,
            'material_type_id' => $typeId,
        ]);
        $this->claim($item);

        $label = 'copy-refresh-current-inputs';
        $this->pauseAt($label, 'item_lock_a5_copy_refresh', [
            'kind' => 'new', 'item_id' => $item['id'], 'actor' => $this->actor(),
            'caller_read' => [
                'sql' => 'SELECT name FROM resources WHERE resource_id = :id',
                'params' => [':id' => $resourceId],
            ],
        ], 'discovered');

        $currentName = $this->prefix . 'current source';
        $currentUrl = 'https://example.test/current-source';
        $start = date('Y-m-d', strtotime('-1 day'));
        $end = date('Y-m-d', strtotime('+30 days'));
        $db->createCommand()->update('resources', [
            'name' => $currentName,
            'item_url' => $currentUrl,
            'description' => 'Synthetic current description',
            'start_visibility' => $start,
            'end_visibility' => $end,
            'use_proxy' => 1,
            'use_primary_link_visibility' => 1,
            'primary_link_start_visibility' => $start,
            'primary_link_end_visibility' => $end,
        ], ['resource_id' => $resourceId])->execute();
        $currentLink = 'https://example.test/current-link';
        $db->createCommand()->insert('resource_links', [
            'resource_id' => $resourceId, 'url' => $currentLink,
            'title' => 'Synthetic current link', 'order' => 8,
            'use_proxy' => 1, 'use_link_visibility' => 1,
            'start_visibility' => $start, 'end_visibility' => $end,
        ])->execute();
        $db->createCommand()->insert('resource_metadata', [
            'resource_id' => $resourceId, 'field_name' => 'title',
            'field_value' => 'Synthetic current metadata title',
        ])->execute();

        $result = $this->continueAfterDiscovery($label, 'copy refresh source change');
        Assert::assertSame($oldName, $result['result']['caller_read_before']);
        Assert::assertSame($oldName, $result['result']['caller_read_after']);
        Assert::assertSame(200, $result['result']['result']['status']);
        Assert::assertSame(true, $result['result']['result']['body']['copy_inputs_refreshed']);
        $snapshot = json_decode($this->itemRow($item)['source_snapshot_json'], true);
        Assert::assertSame($currentName, $snapshot['title']);
        Assert::assertSame($currentUrl, $snapshot['url']);
        Assert::assertSame('Synthetic current description', $snapshot['description']);
        Assert::assertSame($start, $snapshot['display_start_date']);
        Assert::assertSame($end, $snapshot['display_end_date']);
        Assert::assertSame(1, $snapshot['use_proxy']);
        Assert::assertSame([
            'primary_link' => [
                'url' => $currentUrl, 'use_proxy' => 1, 'use_primary_link_visibility' => 1,
                'primary_link_start_visibility' => $start, 'primary_link_end_visibility' => $end,
            ],
            'additional_links' => [[
                'url' => $currentLink, 'label' => 'Synthetic current link', 'order' => 8,
                'use_proxy' => 1, 'use_link_visibility' => 1,
                'start_visibility' => $start, 'end_visibility' => $end,
            ]],
            'bibliographic_metadata' => [
                'title' => 'Synthetic current metadata title', 'authors' => null, 'publisher' => null,
                'publicationYear' => null, 'isbn' => null, 'issn' => null, 'doi' => null,
                'journalTitle' => null, 'volume' => null, 'issue' => null, 'edition' => null, 'pages' => null,
            ],
        ], $snapshot['copy_inputs']);
        Assert::assertSame(1, $this->discoveryCount($result['queries']));
    }

    public function legacyUpdateKeepsTheCurrentFrozenSnapshotAndType(ConcurrencyTester $I)
    {
        $item = $this->newItem('legacy-update');
        $sourceTypeId = $this->materialType('book');
        $currentTypeId = $this->materialType('other');
        $pointer = $this->electronic('legacy-update');
        $db = \Yii::$app->db;
        $db->createCommand()->update('resources', ['material_type_id' => $sourceTypeId], [
            'resource_id' => $pointer['resource_id'],
        ])->execute();
        $this->setItem($item, [
            'source_resource_id' => (string)$pointer['resource_id'],
            'material_type_id' => null,
            'source_snapshot_json' => null,
        ]);
        $this->claim($item);
        $label = 'legacy-current-model';
        $this->pauseAt($label, 'item_lock_a5_legacy_update', [
            'kind' => 'new', 'item_id' => $item['id'], 'actor' => $this->actor(),
            'body' => ['staff_notes' => 'Synthetic legacy staff note'],
        ], 'discovered');

        $frozen = json_encode([
            'version' => 2,
            'title' => 'Synthetic committed frozen title',
            'url' => 'https://example.test/frozen-current',
            'copy_inputs' => ['bibliographic_metadata' => ['title' => 'Synthetic frozen metadata']],
        ], JSON_UNESCAPED_SLASHES);
        $db->createCommand()->update('submission_new_resources', [
            'material_type_id' => $currentTypeId,
            'source_snapshot_json' => $frozen,
        ], ['id' => $item['id']])->execute();

        $result = $this->continueAfterDiscovery($label, 'legacy item changed');
        Assert::assertSame(200, $result['result']['status']);
        $row = $this->itemRow($item);
        Assert::assertSame((string)$currentTypeId, (string)$row['material_type_id']);
        Assert::assertSame($frozen, $row['source_snapshot_json']);
        Assert::assertSame('Synthetic legacy staff note', $row['staff_notes']);
        Assert::assertSame(1, $this->discoveryCount($result['queries']));
    }

    private function newItem($suffix)
    {
        $item = $this->item($suffix);
        \Yii::$app->db->createCommand()->update('faculty_submissions', [
            'submitted_at' => date('Y-m-d H:i:s'),
        ], ['submission_id' => $item['submission_id']])->execute();
        return $item;
    }

    private function claim(array $item)
    {
        $now = date('Y-m-d H:i:s');
        \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'claimed_by' => $this->actor()['username'], 'claimed_at' => $now, 'last_activity_at' => $now,
        ], ['id' => $item['id']])->execute();
    }

    private function setItem(array $item, array $values)
    {
        \Yii::$app->db->createCommand()->update('submission_new_resources', $values, ['id' => $item['id']])->execute();
    }

    private function materialType($name)
    {
        $name = $this->prefix . $name;
        \Yii::$app->db->createCommand()->insert('material_types', ['name' => $name])->execute();
        $id = (int)\Yii::$app->db->getLastInsertID();
        $this->materialTypeIds[] = $id;
        return $id;
    }

    private function actor()
    {
        return ['username' => $this->prefix . 'staff', 'role' => 'staff'];
    }

    private function continueAfterDiscovery($label, $description)
    {
        $this->supervisor->release($label, 'discovered', 1);
        $result = $this->supervisor->complete($label);
        Assert::assertTrue($result['ok'], $description . ': ' . ($result['error'] ?? 'worker failed'));
        Assert::assertNotSame($this->parentConnectionId, $this->connections[$label]);
        return $result;
    }

    private function itemRow(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_new_resources WHERE id = :id', [':id' => $item['id']]
        )->queryOne();
    }

    private function state(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM submission_publication_state WHERE item_kind = "new" AND item_id = :id',
            [':id' => $item['id']]
        )->queryOne();
    }

    private function eventCount($itemId, $eventType = null)
    {
        $sql = 'SELECT COUNT(*) FROM workflow_events WHERE item_kind = "new" AND item_id = :id';
        $params = [':id' => $itemId];
        if ($eventType !== null) {
            $sql .= ' AND event_type = :event';
            $params[':event'] = $eventType;
        }
        return (int)\Yii::$app->db->createCommand($sql, $params)->queryScalar();
    }

    private function discoveryCount(array $queries)
    {
        return count(array_filter($queries, function ($sql) {
            return preg_match('/SELECT\s+submission_id\s+FROM\s+submission_new_resources\s+WHERE\s+id\s*=/i', $sql);
        }));
    }
}
