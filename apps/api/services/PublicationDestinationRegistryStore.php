<?php

namespace app\services;

use Yii;

/** Shared closure discovery, current reads and ordered locking for registry operations. */
class PublicationDestinationRegistryStore
{
    protected $db;
    protected $lookups;
    protected $lock;
    protected $snapshots;
    protected $probe;
    protected $stager;

    public function __construct(
        $db = null,
        ?PublicationDestinationLock $lock = null,
        ?PublicationDestinationSnapshot $snapshots = null,
        ?PublicationDestinationProbe $probe = null
    ) {
        $this->db = $db ?: Yii::$app->db;
        $this->lookups = new PublicationDestinationRegistryLookup($this->db);
        $this->lock = $lock ?: new PublicationDestinationLock(null, $this->db);
        $this->snapshots = $snapshots ?: new PublicationDestinationSnapshot($this->db);
        $this->probe = $probe ?: new NullPublicationDestinationProbe();
        $this->stager = new PublicationDestinationRegistryStage($this->lock, $this->probe);
    }

    protected function validatePointer(array $pointer, $forUpdate = false, ?callable $guard = null)
    {
        if ($pointer['kind'] === 'electronic') {
            return $this->snapshots->electronic($pointer['id'], $forUpdate, $guard);
        }
        if ($pointer['kind'] === 'physical') {
            return $this->snapshots->physical($pointer['id'], $forUpdate, $guard);
        }
        return null;
    }

    protected function loadPointer(array $pointer, $forUpdate = false, ?callable $guard = null)
    {
        $entry = $this->validatePointer($pointer, $forUpdate, $guard);
        if ($entry !== null) {
            $entry['kind'] = $pointer['kind'];
            $entry['pointer_id'] = $pointer['id'];
        }
        return $entry;
    }

    protected function destinationEntry(array $destination, $forUpdate = false, ?callable $guard = null)
    {
        if ($this->isRetired($destination)) {
            return null;
        }
        $pointer = $this->pointerKey($destination);
        if ($pointer) {
            $bucket = $pointer['kind'] === 'electronic' ? 'course_resource_ids' : 'physical_reference_ids';
            if ($guard !== null) {
                call_user_func($guard, $bucket, $pointer['id']);
            }
        }
        return $pointer ? $this->loadPointer($pointer, $forUpdate, $guard) : null;
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

    protected function loadItem(array $key, $forUpdate = false, ?callable $guard = null)
    {
        $table = $key['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        if ($guard !== null) {
            call_user_func($guard, $key['kind'] === 'new' ? 'new_item_ids' : 'reuse_item_ids', $key['id']);
        }
        $row = $this->db->createCommand(
            'SELECT * FROM ' . $table . ' WHERE id = :id' . ($forUpdate ? ' FOR UPDATE' : ''),
            [':id' => $key['id']]
        )->queryOne();
        if (!$row) {
            return null;
        }
        if ($guard !== null && !empty($row['submission_id'])) {
            call_user_func($guard, 'submission_ids', $row['submission_id']);
        }
        $submission = $this->db->createCommand(
            'SELECT offering_id FROM faculty_submissions WHERE submission_id = :id'
            . ($forUpdate ? ' FOR UPDATE' : ''), [':id' => $row['submission_id']]
        )->queryOne();
        if (!$submission) {
            return null;
        }
        $row['offering_id'] = $submission['offering_id'];
        return $row;
    }

    protected function destination($id, $forUpdate = false, ?callable $guard = null)
    {
        $validId = is_numeric($id) && (int)$id > 0;
        if ($validId && $guard !== null) {
            call_user_func($guard, 'destination_ids', $id);
        }
        return $validId
            ? $this->db->createCommand(
                'SELECT * FROM publication_destinations WHERE id = :id' . ($forUpdate ? ' FOR UPDATE' : ''),
                [':id' => (int)$id]
            )->queryOne()
            : null;
    }

    protected function destinationForPointer(array $pointer, $forUpdate = false)
    {
        return $this->lookups->destinationForPointer($pointer, $forUpdate);
    }

    protected function loadDestinationForPointer(array $pointer, $forUpdate = false, ?callable $guard = null)
    {
        if ($guard === null) {
            return $this->destinationForPointer($pointer, $forUpdate);
        }
        call_user_func($guard, 'destination_pointers', $pointer);
        $destination = $this->destinationForPointer($pointer, false);
        if ($destination) {
            call_user_func($guard, 'destination_ids', $destination['id']);
        }
        return $destination && $forUpdate
            ? $this->lookups->destinationForPointer($pointer, true, $destination['id'])
            : $destination;
    }

    protected function ownerForItem(array $key, $forUpdate = false, ?callable $guard = null)
    {
        return $this->lookups->ownerForItem($key, $forUpdate, $guard);
    }

    protected function attachmentForItem(array $key, $forUpdate = false, ?callable $guard = null)
    {
        if ($guard !== null) {
            call_user_func($guard, $key['kind'] === 'new' ? 'new_item_ids' : 'reuse_item_ids', $key['id']);
        }
        $attachment = $this->db->createCommand(
            'SELECT * FROM publication_attachments WHERE item_kind = :kind AND item_id = :id '
            . 'AND live = 1 ORDER BY id LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : ''),
            [':kind' => $key['kind'], ':id' => $key['id']]
        )->queryOne();
        if ($attachment && $guard !== null) {
            call_user_func($guard, 'attachment_ids', $attachment['id']);
            call_user_func($guard, 'destination_ids', $attachment['destination_id']);
        }
        return $attachment;
    }

    protected function attachmentsForDestination($id, $forUpdate = false, ?callable $guard = null)
    {
        if ($guard !== null) {
            call_user_func($guard, 'destination_ids', $id);
        }
        $attachments = $this->db->createCommand(
            'SELECT * FROM publication_attachments WHERE destination_id = :id AND live = 1 ORDER BY id'
            . ($forUpdate ? ' FOR UPDATE' : ''), [':id' => $id]
        )->queryAll();
        foreach ($attachments as $attachment) {
            if ($guard !== null) {
                call_user_func($guard, 'attachment_ids', $attachment['id']);
            }
        }
        return $attachments;
    }

    protected function attachment($id)
    {
        return $this->db->createCommand('SELECT * FROM publication_attachments WHERE id = :id', [':id' => $id])
            ->queryOne();
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
        if ($entry['kind'] !== 'physical') {
            return null;
        }
        $error = $this->snapshots->physicalIdentityError($key['kind'], $item, $entry['row']);
        return $error !== null ? $error : (count($entry['ambiguity_ids'] ?? []) > 1 ? 'destination_ambiguous' : null);
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

    protected function itemContext($key, $row)
    {
        return $key ? ['kind' => $key['kind'], 'id' => (int)$key['id'], 'row' => $row] : null;
    }

    protected function ownerContext(array $destination, $forUpdate = false, ?callable $guard = null)
    {
        $key = $destination['owner_live'] == 1 && $destination['owner_item_kind'] !== null
            ? ['kind' => $destination['owner_item_kind'], 'id' => (int)$destination['owner_item_id']]
            : null;
        return $key ? $this->itemContext($key, $this->loadItem($key, $forUpdate, $guard)) : null;
    }

    protected function contextsForAttachments(array $attachments, $forUpdate = false, ?callable $guard = null)
    {
        $contexts = [];
        foreach ($attachments as $attachment) {
            $key = ['kind' => $attachment['item_kind'], 'id' => (int)$attachment['item_id']];
            $contexts[] = $this->itemContext($key, $this->loadItem($key, $forUpdate, $guard));
        }
        return $contexts;
    }

    protected function itemRelationships(array $items, $forUpdate = false, ?callable $guard = null)
    {
        $owners = [];
        $attachmentsByItem = [];
        $attachments = [];
        $destinations = [];
        $entries = [];
        foreach ($items as $item) {
            if (!$item) {
                continue;
            }
            $key = ['kind' => $item['kind'], 'id' => (int)$item['id']];
            $owners[$key['kind'] . ':' . $key['id']] = $this->ownerForItem($key, $forUpdate, $guard);
            $attachment = $this->attachmentForItem($key, $forUpdate, $guard);
            $attachmentsByItem[$key['kind'] . ':' . $key['id']] = $attachment;
            if ($owners[$key['kind'] . ':' . $key['id']]) {
                $destinations[] = $owners[$key['kind'] . ':' . $key['id']];
            }
            if ($attachment) {
                $attachments[] = $attachment;
                $destination = $this->destination($attachment['destination_id'], $forUpdate, $guard);
                if ($destination) {
                    $destinations[] = $destination;
                }
            }
        }
        foreach ($destinations as $destination) {
            $entries[] = $this->destinationEntry($destination, $forUpdate, $guard);
        }
        return [
            'owners' => $owners,
            'attachments_by_item' => $attachmentsByItem,
            'attachments' => $attachments,
            'destinations' => $destinations,
            'entries' => $entries,
        ];
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
