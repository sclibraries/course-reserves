<?php

namespace app\services;

use Yii;

/**
 * Shared reads for registry operations.
 *
 * Each attempt discovers its course with plain reads, takes the course lock (or, with no course, a row lock on its
 * anchor row) and then validates only fresh locking reads: FOR UPDATE for the rows it validates or writes, and the
 * snapshot's shared content in share mode. Locking reads see current committed data, also inside an older caller
 * view, and their next-key locks keep a missing key missing until commit.
 */
class PublicationDestinationRegistryStore
{
    protected $db;
    protected $lock;
    protected $snapshots;
    protected $probe;

    public function __construct(
        $db = null,
        ?PublicationDestinationLock $lock = null,
        ?PublicationDestinationSnapshot $snapshots = null,
        ?PublicationDestinationProbe $probe = null
    ) {
        $this->db = $db ?: Yii::$app->db;
        $this->lock = $lock ?: new PublicationDestinationLock();
        $this->snapshots = $snapshots ?: new PublicationDestinationSnapshot($this->db);
        $this->probe = $probe ?: new NullPublicationDestinationProbe();
    }

    /** Ends discovery: locks the course, or the anchor rows when discovery found no course. */
    protected function lockFirst($attempt, $offeringId, array $anchor)
    {
        $this->probe->checkpoint('discovered', $attempt);
        $this->lock->lock($offeringId ? ['offering_ids' => [$offeringId]] : $anchor);
        $this->probe->checkpoint('locked', $attempt);
    }

    /** Plain reads: the destination's course, else its (or the given) pointer entry's, else the item's. */
    protected function discoverCourse(?array $destination, ?array $pointer = null, ?array $key = null)
    {
        if (!empty($destination['offering_id'])) {
            return (int)$destination['offering_id'];
        }
        $pointer = $destination ? $this->pointerKey($destination) : $pointer;
        $offering = $pointer ? $this->db->createCommand($pointer['kind'] === 'electronic'
            ? 'SELECT offering_id FROM course_resources WHERE course_resource_id = :id'
            : 'SELECT offering_id FROM physical_resource_references WHERE reference_id = :id', [':id' => $pointer['id']])
            ->queryScalar() : null;
        if (!$offering && $key) {
            $offering = $this->db->createCommand(
                'SELECT s.offering_id FROM ' . $this->itemTable($key) . ' i '
                . 'JOIN faculty_submissions s ON s.submission_id = i.submission_id WHERE i.id = :id',
                [':id' => $key['id']]
            )->queryScalar();
        }
        return $offering ? (int)$offering : null;
    }

    protected function itemAnchor(?array $key)
    {
        return $key ? [$key['kind'] === 'new' ? 'new_item_ids' : 'reuse_item_ids' => [$key['id']]] : [];
    }

    protected function loadPointer(array $pointer)
    {
        $entry = $pointer['kind'] === 'electronic'
            ? $this->snapshots->electronic($pointer['id'], true)
            : $this->snapshots->physical($pointer['id'], true);
        return $entry === null ? null : $entry + ['kind' => $pointer['kind']];
    }

    protected function destinationEntry(array $destination)
    {
        $pointer = $this->isRetired($destination) ? null : $this->pointerKey($destination);
        return $pointer ? $this->loadPointer($pointer) : null;
    }

    protected function pointerKey(array $pointer)
    {
        $kind = $pointer['destination_kind'] ?? null;
        $column = $kind === 'electronic' ? 'course_resource_id'
            : ($kind === 'physical' ? 'physical_reference_id' : null);
        $id = $column === null ? null : ($pointer[$column] ?? null);
        return is_numeric($id) && (int)$id > 0 ? ['kind' => $kind, 'id' => (int)$id] : null;
    }

    protected function itemKey(array $item)
    {
        return in_array($item['kind'] ?? null, ['new', 'reuse'], true)
            && is_numeric($item['id'] ?? null) && (int)$item['id'] > 0
            ? ['kind' => $item['kind'], 'id' => (int)$item['id']]
            : null;
    }

    protected function ownerKey(array $destination)
    {
        return $destination['owner_live'] == 1 && $destination['owner_item_kind'] !== null
            ? ['kind' => $destination['owner_item_kind'], 'id' => (int)$destination['owner_item_id']]
            : null;
    }

    /** The item row with its submission's current offering, both locked; null when either is missing. */
    protected function loadItem(array $key)
    {
        $row = $this->db->createCommand(
            'SELECT * FROM ' . $this->itemTable($key) . ' WHERE id = :id FOR UPDATE', [':id' => $key['id']]
        )->queryOne();
        $submission = $row ? $this->db->createCommand(
            'SELECT offering_id FROM faculty_submissions WHERE submission_id = :id FOR UPDATE',
            [':id' => $row['submission_id']]
        )->queryOne() : false;
        return $submission ? array_merge($row, ['offering_id' => $submission['offering_id']]) : null;
    }

    /** Item contexts (kind, id, row) for the keys whose rows exist. */
    protected function loadItems(array $keys)
    {
        $items = [];
        foreach ($keys as $key) {
            $row = $this->loadItem($key);
            if ($row) {
                $items[] = $key + ['row' => $row];
            }
        }
        return $items;
    }

    protected function destination($id, $forUpdate = false)
    {
        return is_numeric($id) && (int)$id > 0 ? $this->one(
            'SELECT * FROM publication_destinations WHERE id = :id', [':id' => (int)$id], $forUpdate
        ) : null;
    }

    /** Test seam (API-116A): keep the name and signature. */
    protected function destinationForPointer(array $pointer, $forUpdate = false)
    {
        $column = $pointer['kind'] === 'electronic' ? 'course_resource_id' : 'physical_reference_id';
        return $this->one(
            'SELECT * FROM publication_destinations WHERE `' . $column . '` = :id', [':id' => $pointer['id']], $forUpdate
        );
    }

    protected function ownerForItem(array $key, $forUpdate = false)
    {
        return $this->one(
            'SELECT * FROM publication_destinations WHERE owner_item_kind = :kind AND owner_item_id = :id AND owner_live = 1',
            [':kind' => $key['kind'], ':id' => $key['id']],
            $forUpdate
        );
    }

    protected function attachmentForItem(array $key, $forUpdate = false)
    {
        return $this->one(
            'SELECT * FROM publication_attachments WHERE item_kind = :kind AND item_id = :id AND live = 1',
            [':kind' => $key['kind'], ':id' => $key['id']],
            $forUpdate
        );
    }

    protected function liveAttachments($destinationId)
    {
        return $this->db->createCommand(
            'SELECT * FROM publication_attachments WHERE destination_id = :id AND live = 1 ORDER BY id FOR UPDATE',
            [':id' => $destinationId]
        )->queryAll();
    }

    protected function attachment($id)
    {
        return $this->one('SELECT * FROM publication_attachments WHERE id = :id', [':id' => $id]);
    }

    protected function offeringError(array $item, $pointerOffering, $registryOffering)
    {
        return empty($item['offering_id']) || empty($pointerOffering) || empty($registryOffering)
            || (int)$item['offering_id'] !== (int)$pointerOffering
            || (int)$item['offering_id'] !== (int)$registryOffering
            ? 'offering_mismatch' : null;
    }

    /** For a physical entry: every item's identity, then the entry's own identity and ambiguity. */
    protected function physicalError(array $items, array $entry)
    {
        if ($entry['kind'] !== 'physical') {
            return null;
        }
        foreach ($items as $item) {
            $error = $this->snapshots->physicalIdentityError($item['kind'], $item['row'], $entry['row']);
            if ($error !== null) {
                return $error;
            }
        }
        return $this->snapshots->physicalDestinationError($entry['row'], $entry['ambiguity_ids']);
    }

    protected function isRetired(array $destination)
    {
        return $destination['retired_at'] !== null
            || ($destination['course_resource_id'] === null && $destination['physical_reference_id'] === null);
    }

    protected function samePointer(array $destination, array $pointer)
    {
        $column = $pointer['kind'] === 'electronic' ? 'course_resource_id' : 'physical_reference_id';
        return $destination['destination_kind'] === $pointer['kind']
            && (int)$destination[$column] === (int)$pointer['id'];
    }

    protected function snapshotJson(array $snapshot)
    {
        $json = json_encode($snapshot, JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \RuntimeException('Could not encode the API-116A destination snapshot.');
        }
        return $json;
    }

    protected function success(array $body)
    {
        return ['status' => 200, 'body' => $body];
    }

    protected function error($code)
    {
        return ['status' => 409, 'body' => ['error_code' => $code]];
    }

    private function itemTable(array $key)
    {
        return $key['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
    }

    private function one($sql, array $params, $forUpdate = false)
    {
        return $this->db->createCommand($sql . ($forUpdate ? ' FOR UPDATE' : ''), $params)->queryOne() ?: null;
    }
}
