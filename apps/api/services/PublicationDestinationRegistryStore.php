<?php

namespace app\services;

use Yii;

/** Shared query and locking support for registry operations. */
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
    )
    {
        $this->db = $db ?: Yii::$app->db;
        $this->lock = $lock ?: new PublicationDestinationLock();
        $this->snapshots = $snapshots ?: new PublicationDestinationSnapshot($this->db);
        $this->probe = $probe ?: new NullPublicationDestinationProbe();
    }
    protected function validatePointer(array $pointer)
    {
        if ($pointer['kind'] === 'electronic') {
            return $this->snapshots->electronic($pointer['id']);
        }
        if ($pointer['kind'] === 'physical') {
            return $this->snapshots->physical($pointer['id']);
        }
        return null;
    }

    protected function loadPointer(array $pointer)
    {
        $entry = $this->validatePointer($pointer);
        if ($entry !== null) {
            $entry['kind'] = $pointer['kind'];
            $entry['pointer_id'] = $pointer['id'];
        }
        return $entry;
    }

    protected function destinationEntry(array $destination)
    {
        if ($this->isRetired($destination)) {
            return null;
        }
        $pointer = $this->pointerKey($destination);
        return $pointer ? $this->loadPointer($pointer) : null;
    }

    protected function pointerKey(array $pointer)
    {
        $kind = $pointer['destination_kind'] ?? null;
        $column = $kind === 'electronic' ? 'course_resource_id' : ($kind === 'physical' ? 'physical_reference_id' : null);
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

    protected function loadItem(array $key)
    {
        $table = $key['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        return $this->db->createCommand(
            'SELECT item.*, submission.offering_id FROM ' . $table . ' item '
            . 'INNER JOIN faculty_submissions submission ON submission.submission_id = item.submission_id '
            . 'WHERE item.id = :id', [':id' => $key['id']]
        )->queryOne();
    }

    protected function destination($id, $forUpdate = false)
    {
        return is_numeric($id) && (int)$id > 0
            ? $this->db->createCommand(
                'SELECT * FROM publication_destinations WHERE id = :id' . ($forUpdate ? ' FOR UPDATE' : ''),
                [':id' => (int)$id]
            )->queryOne()
            : null;
    }

    protected function destinationForPointer(array $pointer, $forUpdate = false)
    {
        $column = $pointer['kind'] === 'electronic' ? 'course_resource_id' : 'physical_reference_id';
        return $this->db->createCommand(
            'SELECT * FROM publication_destinations WHERE `' . $column . '` = :id'
            . ($forUpdate ? ' FOR UPDATE' : ''), [':id' => $pointer['id']]
        )->queryOne();
    }

    protected function ownerForItem(array $key, $forUpdate = false)
    {
        return $this->db->createCommand(
            'SELECT * FROM publication_destinations WHERE owner_item_kind = :kind '
            . 'AND owner_item_id = :id AND owner_live = 1 LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : ''),
            [':kind' => $key['kind'], ':id' => $key['id']]
        )->queryOne();
    }

    protected function attachmentForItem(array $key, $forUpdate = false)
    {
        return $this->db->createCommand(
            'SELECT * FROM publication_attachments WHERE item_kind = :kind AND item_id = :id '
            . 'AND live = 1 ORDER BY id LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : ''),
            [':kind' => $key['kind'], ':id' => $key['id']]
        )->queryOne();
    }

    protected function attachmentsForDestination($id)
    {
        return $this->db->createCommand(
            'SELECT * FROM publication_attachments WHERE destination_id = :id AND live = 1 ORDER BY id',
            [':id' => $id]
        )->queryAll();
    }

    protected function attachment($id)
    {
        return $this->db->createCommand('SELECT * FROM publication_attachments WHERE id = :id', [':id' => $id])->queryOne();
    }

    protected function hasLiveAttachments($destinationId, $forUpdate = false)
    {
        return (bool)$this->db->createCommand(
            'SELECT 1 FROM publication_attachments WHERE destination_id = :id AND live = 1 LIMIT 1'
            . ($forUpdate ? ' FOR UPDATE' : ''),
            [':id' => $destinationId]
        )->queryScalar();
    }

    protected function offeringError(array $item, $pointerOffering, $registryOffering)
    {
        return empty($item['offering_id']) || empty($pointerOffering) || empty($registryOffering)
            || (int)$item['offering_id'] !== (int)$pointerOffering
            || (int)$item['offering_id'] !== (int)$registryOffering
            ? 'offering_mismatch' : null;
    }

    protected function physicalError(array $key, array $item, array $entry)
    {
        return $entry['kind'] === 'physical'
            ? $this->snapshots->physicalError($key['kind'], $item, $entry['row'])
            : null;
    }

    protected function isRetired(array $destination)
    {
        return $destination['retired_at'] !== null
            || ($destination['course_resource_id'] === null && $destination['physical_reference_id'] === null);
    }

    protected function samePointer(array $destination, array $pointer)
    {
        return $destination['destination_kind'] === $pointer['kind']
            && (int)($destination[$pointer['kind'] === 'electronic' ? 'course_resource_id' : 'physical_reference_id'])
                === (int)$pointer['id'];
    }

    protected function snapshotJson(array $snapshot)
    {
        $json = json_encode($snapshot, JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \RuntimeException('Could not encode the API-116A destination snapshot.');
        }
        return $json;
    }

    protected function itemContext($key, $row)
    {
        return $key ? ['kind' => $key['kind'], 'id' => $key['id'], 'row' => $row] : null;
    }

    protected function ownerContext(array $destination)
    {
        $key = $destination['owner_live'] == 1 && $destination['owner_item_kind'] !== null
            ? ['kind' => $destination['owner_item_kind'], 'id' => (int)$destination['owner_item_id']]
            : null;
        return $key ? $this->itemContext($key, $this->loadItem($key)) : null;
    }

    protected function contextsForAttachments(array $attachments)
    {
        $contexts = [];
        foreach ($attachments as $attachment) {
            $key = ['kind' => $attachment['item_kind'], 'id' => (int)$attachment['item_id']];
            $contexts[] = $this->itemContext($key, $this->loadItem($key));
        }
        return $contexts;
    }

    protected function loadContextItems(array $contexts)
    {
        $items = [];
        foreach ($contexts as $context) {
            if (!$context) {
                continue;
            }
            $row = $this->loadItem(['kind' => $context['kind'], 'id' => $context['id']]);
            if ($row) {
                $items[] = ['kind' => $context['kind'], 'id' => $context['id'], 'row' => $row];
            }
        }
        return $items;
    }

    protected function lockContext(array $items, array $destinations, array $entries, array $attachments = [])
    {
        $locks = array_fill_keys([
            'offering_ids', 'resource_ids', 'course_resource_ids', 'physical_reference_ids',
            'destination_ids', 'submission_ids', 'new_item_ids', 'reuse_item_ids',
            'publication_state_items', 'attachment_ids',
        ], []);
        foreach ($items as $context) {
            if (!$context) {
                continue;
            }
            $locks[$context['kind'] === 'new' ? 'new_item_ids' : 'reuse_item_ids'][] = $context['id'];
            $locks['publication_state_items'][] = ['kind' => $context['kind'], 'id' => $context['id']];
            $row = $context['row'] ?? [];
            if (!empty($row['submission_id'])) {
                $locks['submission_ids'][] = $row['submission_id'];
            }
            if (!empty($row['offering_id'])) {
                $locks['offering_ids'][] = $row['offering_id'];
            }
            $resourceId = SourceResourceId::canonical($row['source_resource_id'] ?? null);
            if ($resourceId !== null) {
                $locks['resource_ids'][] = $resourceId;
            }
        }
        foreach ($destinations as $destination) {
            if (!$destination) {
                continue;
            }
            $locks['destination_ids'][] = $destination['id'];
            if (!empty($destination['offering_id'])) {
                $locks['offering_ids'][] = $destination['offering_id'];
            }
            if (!empty($destination['course_resource_id'])) {
                $locks['course_resource_ids'][] = $destination['course_resource_id'];
            }
            if (!empty($destination['physical_reference_id'])) {
                $locks['physical_reference_ids'][] = $destination['physical_reference_id'];
            }
        }
        foreach ($entries as $entry) {
            if (!$entry) {
                continue;
            }
            $row = $entry['row'];
            $locks['offering_ids'][] = $row['offering_id'];
            if ($entry['kind'] === 'electronic') {
                $locks['course_resource_ids'][] = $row['course_resource_id'];
                $locks['resource_ids'][] = $row['resource_id'];
            } else {
                $locks['physical_reference_ids'][] = $row['reference_id'];
            }
        }
        foreach ($attachments as $attachment) {
            if (!$attachment) {
                continue;
            }
            $locks['attachment_ids'][] = $attachment['id'];
        }
        $this->lock->lock($locks);
    }

    protected function success(array $body)
    {
        return ['status' => 200, 'body' => $body];
    }

    protected function error($code)
    {
        return ['status' => 409, 'body' => ['error_code' => $code]];
    }
}
