<?php

require_once dirname(__DIR__) . '/Api116AFixture.php';

/** Owns committed synthetic API-116 fixtures and worker-created registry rows. */
class PublicationDestinationConcurrencyFixtureTracker
{
    private $fixture;
    private $prefix;
    private $destinationFloor;
    private $attachmentFloor;
    private $items = [];
    private $submissions = [];
    private $pointers = [];
    private $destinationIds = [];
    private $folderIds = [];

    public function __construct($prefix)
    {
        $this->prefix = $prefix;
        $db = \Yii::$app->db;
        $this->destinationFloor = $this->maxId($db, 'publication_destinations');
        $this->attachmentFloor = $this->maxId($db, 'publication_attachments');
        $this->fixture = new Api116AFixture($prefix);
    }

    public function fixture()
    {
        return $this->fixture;
    }

    public function trackItem(array $item)
    {
        $this->items[$item['kind'] . ':' . $item['id']] = [
            'kind' => $item['kind'],
            'id' => (int)$item['id'],
        ];
        $this->submissions[(int)$item['submission_id']] = (int)$item['submission_id'];
    }

    public function trackPointer(array $pointer)
    {
        $id = $pointer['destination_kind'] === 'electronic'
            ? $pointer['course_resource_id'] : $pointer['physical_reference_id'];
        $this->pointers[$pointer['destination_kind'] . ':' . $id] = [
            'kind' => $pointer['destination_kind'],
            'id' => (int)$id,
        ];
    }

    public function trackDestination($destinationId)
    {
        $this->destinationIds[(int)$destinationId] = (int)$destinationId;
    }

    public function trackFolder($folderId)
    {
        $this->folderIds[(int)$folderId] = (int)$folderId;
    }

    public function insertDestination(array $pointer, array $values = [])
    {
        $pointerValues = array_intersect_key($pointer, array_flip([
            'destination_kind', 'course_resource_id', 'physical_reference_id',
        ]));
        $row = array_merge([
            'destination_kind' => 'electronic',
            'course_resource_id' => null,
            'physical_reference_id' => null,
            'offering_id' => $pointer['offering_id'],
            'origin_offering_id' => $pointer['offering_id'],
            'owner_item_kind' => null,
            'owner_item_id' => null,
            'owner_live' => null,
            'ownership_source' => 'none',
            'retired_at' => null,
        ], $pointerValues, $values);
        $db = \Yii::$app->db;
        $db->createCommand()->insert('publication_destinations', $row)->execute();
        $id = (int)$db->getLastInsertID();
        $this->trackDestination($id);
        return $id;
    }

    public function insertAttachment($destinationId, array $item, $snapshot)
    {
        $db = \Yii::$app->db;
        $db->createCommand()->insert('publication_attachments', [
            'destination_id' => $destinationId,
            'item_kind' => $item['kind'],
            'item_id' => $item['id'],
            'attached_snapshot_json' => json_encode($snapshot, JSON_UNESCAPED_SLASHES),
            'attached_at' => '2026-10-01 10:00:00',
            'updated_at' => '2026-10-01 10:00:01',
            'live' => 1,
        ])->execute();
        return (int)$db->getLastInsertID();
    }

    public function insertPublicationState(array $item)
    {
        \Yii::$app->db->createCommand()->insert('submission_publication_state', [
            'item_kind' => $item['kind'],
            'item_id' => $item['id'],
            'submission_id' => $item['submission_id'],
            'state' => 'published',
            'draft_revision' => 17,
            'published_revision' => 12,
            'pending_changes' => 'none',
            'published_destination_json' => '{"kind":"electronic","resource_id":116001}',
            'published_snapshot' => '{"resource":{"name":"Synthetic frozen publication"}}',
            'created_at' => '2026-10-01 10:00:00',
            'updated_at' => '2026-10-01 10:00:01',
        ])->execute();
    }

    public function manifest()
    {
        return [
            'submissions' => array_values($this->submissions),
            'items' => array_values($this->items),
            'destinations' => array_values($this->destinationIds),
            'pointers' => array_values($this->pointers),
        ];
    }

    /** Worker processes are stopped and reaped before any fixture DDL or deletion. */
    public function cleanup(PublicationDestinationConcurrencySupervisor $supervisor)
    {
        $supervisor->stopAll();
        $db = \Yii::$app->db;
        $attachmentIds = $db->createCommand(
            'SELECT id FROM publication_attachments WHERE id > :floor', [':floor' => $this->attachmentFloor]
        )->queryColumn();
        foreach ($attachmentIds as $id) {
            $db->createCommand()->delete('publication_attachments', ['id' => $id])->execute();
        }

        $destinationIds = $db->createCommand(
            'SELECT id FROM publication_destinations WHERE id > :floor', [':floor' => $this->destinationFloor]
        )->queryColumn();
        foreach (array_unique(array_merge($destinationIds, array_values($this->destinationIds))) as $id) {
            $db->createCommand()->delete('publication_destinations', ['id' => $id])->execute();
        }

        $this->fixture->cleanup();
        foreach ($this->folderIds as $folderId) {
            $db->createCommand()->delete('folders', ['folder_id' => $folderId])->execute();
        }
        \PHPUnit\Framework\Assert::assertSame(
            0,
            (int)$db->createCommand(
                'SELECT COUNT(*) FROM publication_attachments WHERE id > :floor', [':floor' => $this->attachmentFloor]
            )->queryScalar(),
            'No worker-created or fixture attachment rows may remain.'
        );
        \PHPUnit\Framework\Assert::assertSame(
            0,
            (int)$db->createCommand(
                'SELECT COUNT(*) FROM publication_destinations WHERE id > :floor', [':floor' => $this->destinationFloor]
            )->queryScalar(),
            'No worker-created or retired destination rows may remain.'
        );
        foreach ($this->items as $item) {
            $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
            \PHPUnit\Framework\Assert::assertSame(
                0,
                (int)$db->createCommand(
                    'SELECT COUNT(*) FROM ' . $table . ' WHERE id = :id', [':id' => $item['id']]
                )->queryScalar(),
                'Synthetic item remains after fixture cleanup.'
            );
        }
    }

    private function maxId($db, $table)
    {
        return (int)$db->createCommand('SELECT COALESCE(MAX(id), 0) FROM ' . $table)->queryScalar();
    }
}
