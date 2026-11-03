<?php

namespace app\services;

use yii\db\IntegrityException;

/** Owns destination and attachment history without changing publication state. */
class PublicationDestinationRegistry extends PublicationDestinationRegistryLifecycle
{
    public function registerOwned(array $item, array $destination)
    {
        $key = $this->itemKey($item);
        $pointer = $this->pointerKey($destination);
        return PublicationDestinationTransaction::run(function ($attempt) use ($key, $pointer) {
            $collect = function ($current, $guard) use ($key, $pointer) {
                $stageGuard = $guard;
                if ($current && $guard !== null) {
                    $stageGuard = function ($bucket, $id) use ($guard) {
                        if (!in_array($bucket, ['destination_ids', 'attachment_ids'], true)) {
                            call_user_func($guard, $bucket, $id);
                        }
                    };
                }
                $row = $key ? $this->loadItem($key, $current, $stageGuard) : null;
                $itemContext = $this->itemContext($key, $row);
                $entry = $pointer ? $this->loadPointer($pointer, $current, $stageGuard) : null;
                $registryRow = $pointer
                    ? $this->destinationForPointer($pointer, $current, $stageGuard)
                    : null;
                $targetAttachments = $registryRow
                    ? $this->attachmentsForDestination($registryRow['id'], $current, $stageGuard) : [];
                $targetItems = $this->contextsForAttachments($targetAttachments, $current, $stageGuard);
                $destinationOwner = $registryRow ? $this->ownerContext($registryRow, $current, $stageGuard) : null;
                $items = array_merge([$itemContext, $destinationOwner], $targetItems);
                $relationships = $this->itemRelationships($items, $current, $stageGuard);
                return [
                    'items' => $items,
                    'destinations' => array_merge([$registryRow], $relationships['destinations']),
                    'entries' => array_merge([$entry], $relationships['entries']),
                    'pointers' => [$pointer],
                    'attachments' => array_merge($targetAttachments, $relationships['attachments']),
                    'row' => $row,
                    'entry' => $entry,
                    'registry' => $registryRow,
                    'relationships' => $relationships,
                    'target_attachments' => $targetAttachments,
                    'key' => $key,
                    'pointer' => $pointer,
                ];
            };
            return $this->stager->run($attempt, $collect, function ($data, $attempt) {
                $key = $data['key'];
                $pointer = $data['pointer'];
                $row = $data['row'];
                $entry = $data['entry'];
                $registryRow = $data['registry'];
                $relationships = $data['relationships'];
                $owner = $key ? ($relationships['owners'][$key['kind'] . ':' . $key['id']] ?? null) : null;
                $attachment = $key
                    ? ($relationships['attachments_by_item'][$key['kind'] . ':' . $key['id']] ?? null) : null;

                if ($entry === null) {
                    return $this->error('destination_missing');
                }
                if (!$row) {
                    return $this->error('item_missing');
                }
                if ($registryRow && $this->isRetired($registryRow)) {
                    return $this->error('destination_retired');
                }
                $error = $this->offeringError(
                    $row,
                    $entry['row']['offering_id'],
                    $registryRow['offering_id'] ?? $entry['row']['offering_id']
                );
                if ($error !== null) {
                    return $this->error($error);
                }
                $error = $this->physicalError($key, $row, $entry);
                if ($error !== null) {
                    return $this->error($error);
                }
                if ($owner && $registryRow && (int)$owner['id'] === (int)$registryRow['id']) {
                    return $this->success(['destination' => $registryRow]);
                }
                if ($owner) {
                    return $this->error('item_already_owns');
                }
                if ($attachment) {
                    return $this->error('item_already_attached');
                }
                if ($registryRow) {
                    if ((int)$registryRow['owner_live'] === 1) {
                        return $this->error('destination_already_owned');
                    }
                    if ($data['target_attachments']) {
                        return $this->error('destination_has_attachments');
                    }
                    return $this->error('destination_occupied');
                }

                $this->probe->checkpoint('before_insert', $attempt, ['table' => 'publication_destinations']);
                try {
                    $this->insertDestination($pointer, $entry, $key, 'published');
                } catch (IntegrityException $exception) {
                    $this->restartDuplicate($exception, [
                        'uq_pub_dest_course_resource', 'uq_pub_dest_physical_reference', 'uq_pub_dest_owner_live',
                    ], $attempt);
                }
                return $this->success(['destination' => $this->destination((int)$this->db->getLastInsertID())]);
            }, function ($current) use ($key) {
                if (!$key || !$current['registry']) {
                    return false;
                }
                $owner = $current['relationships']['owners'][$key['kind'] . ':' . $key['id']] ?? null;
                return $owner && (int)$owner['id'] === (int)$current['registry']['id'];
            });
        }, $this->probe);
    }

    public function attach(array $item, $destinationId)
    {
        $key = $this->itemKey($item);
        $pointer = is_array($destinationId) ? $this->pointerKey($destinationId) : null;
        return PublicationDestinationTransaction::run(function ($attempt) use ($key, $destinationId, $pointer) {
            $collect = function ($current, $guard) use ($key, $destinationId, $pointer) {
                $stageGuard = $guard;
                if ($current && $guard !== null) {
                    $stageGuard = function ($bucket, $id) use ($guard) {
                        if (!in_array($bucket, ['destination_ids', 'attachment_ids'], true)) {
                            call_user_func($guard, $bucket, $id);
                        }
                    };
                }
                $destination = $pointer
                    ? $this->destinationForPointer($pointer, $current, $stageGuard)
                    : $this->destination($destinationId, $current, $stageGuard);
                $entry = $pointer
                    ? $this->loadPointer($pointer, $current, $stageGuard)
                    : ($destination ? $this->destinationEntry($destination, $current, $stageGuard) : null);
                $row = $key ? $this->loadItem($key, $current, $stageGuard) : null;
                $itemContext = $this->itemContext($key, $row);
                $destinationOwner = $destination ? $this->ownerContext($destination, $current, $stageGuard) : null;
                $destinationAttachments = $destination
                    ? $this->attachmentsForDestination($destination['id'], $current, $stageGuard) : [];
                $attachedItems = $this->contextsForAttachments($destinationAttachments, $current, $stageGuard);
                $items = array_merge([$itemContext, $destinationOwner], $attachedItems);
                $relationships = $this->itemRelationships($items, $current, $stageGuard);
                return [
                    'items' => $items,
                    'destinations' => array_merge([$destination], $relationships['destinations']),
                    'entries' => array_merge([$entry], $relationships['entries']),
                    'pointers' => [$pointer],
                    'attachments' => array_merge($destinationAttachments, $relationships['attachments']),
                    'destination' => $destination,
                    'entry' => $entry,
                    'row' => $row,
                    'key' => $key,
                    'relationships' => $relationships,
                ];
            };
            return $this->stager->run($attempt, $collect, function ($data, $attempt) use ($destinationId, $pointer) {
                $destination = $data['destination'];
                $entry = $data['entry'];
                $row = $data['row'];
                $key = $data['key'];
                $relationships = $data['relationships'];
                if (!$destination && !$pointer) {
                    return $this->error('destination_missing');
                }
                if ($destination && $this->isRetired($destination)) {
                    return $this->error('destination_retired');
                }
                if ($entry === null) {
                    return $this->error('destination_missing');
                }
                if (!$row) {
                    return $this->error('item_missing');
                }
                $error = $this->offeringError(
                    $row,
                    $entry['row']['offering_id'],
                    $destination['offering_id'] ?? $entry['row']['offering_id']
                );
                if ($error !== null) {
                    return $this->error($error);
                }
                $error = $this->physicalError($key, $row, $entry);
                if ($error !== null) {
                    return $this->error($error);
                }

                $itemKey = $key['kind'] . ':' . $key['id'];
                $owner = $relationships['owners'][$itemKey] ?? null;
                $attachment = $relationships['attachments_by_item'][$itemKey] ?? null;
                if ($destination && $attachment && (int)$attachment['destination_id'] === (int)$destination['id']) {
                    return $this->success(['attachment' => $attachment]);
                }
                if ($owner) {
                    return $this->error('item_already_owns');
                }
                if ($attachment) {
                    return $this->error('item_already_attached');
                }
                if (!$destination) {
                    $this->probe->checkpoint('before_insert', $attempt, ['table' => 'publication_destinations']);
                    try {
                        $this->insertDestination($pointer, $entry);
                    } catch (IntegrityException $exception) {
                        $this->restartDuplicate($exception, [
                            'uq_pub_dest_course_resource', 'uq_pub_dest_physical_reference',
                        ], $attempt);
                    }
                    $destination = $this->destination((int)$this->db->getLastInsertID());
                }

                $json = $this->snapshotJson($entry['snapshot']);
                $this->probe->checkpoint('before_insert', $attempt, ['table' => 'publication_attachments']);
                try {
                    $this->db->createCommand()->insert('publication_attachments', [
                        'destination_id' => $destination['id'],
                        'item_kind' => $key['kind'],
                        'item_id' => $key['id'],
                        'attached_snapshot_json' => $json,
                        'live' => 1,
                    ])->execute();
                } catch (IntegrityException $exception) {
                    $this->restartDuplicate($exception, ['uq_pub_attach_item_live'], $attempt);
                }
                return $this->success(['attachment' => $this->attachment((int)$this->db->getLastInsertID())]);
            }, function ($current) use ($key) {
                if (!$key || !$current['destination'] || !$current['entry']) {
                    return false;
                }
                $itemKey = $key['kind'] . ':' . $key['id'];
                $attachment = $current['relationships']['attachments_by_item'][$itemKey] ?? null;
                if ($attachment) {
                    return (int)$attachment['destination_id'] === (int)$current['destination']['id'];
                }
                return !($current['relationships']['owners'][$itemKey] ?? null);
            });
        }, $this->probe);
    }

    public function read($destinationId)
    {
        $destination = $this->destination($destinationId);
        if (!$destination) {
            return $this->error('destination_missing');
        }
        $destination['is_retired'] = $this->isRetired($destination);
        return $this->success(['destination' => $destination]);
    }

    private function insertDestination(array $pointer, array $entry, ?array $owner = null, $source = 'none')
    {
        $this->db->createCommand()->insert('publication_destinations', [
            'destination_kind' => $pointer['kind'],
            'course_resource_id' => $pointer['kind'] === 'electronic' ? $pointer['id'] : null,
            'physical_reference_id' => $pointer['kind'] === 'physical' ? $pointer['id'] : null,
            'offering_id' => $entry['row']['offering_id'],
            'origin_offering_id' => $entry['row']['offering_id'],
            'owner_item_kind' => $owner['kind'] ?? null,
            'owner_item_id' => $owner['id'] ?? null,
            'owner_live' => $owner ? 1 : null,
            'ownership_source' => $source,
        ])->execute();
    }

    private function restartDuplicate(IntegrityException $exception, array $constraints, $attempt)
    {
        $constraint = PublicationDestinationDuplicateKey::name($exception, $constraints);
        if ($constraint === null) {
            throw $exception;
        }
        $info = $exception->errorInfo;
        $this->probe->checkpoint('recovery_entered', $attempt, [
            'mysql_code' => (int)($info[1] ?? 0),
            'constraint' => $constraint,
        ]);
        throw new PublicationDestinationRestartRequired(
            'Destination duplicate requires a fresh closure.',
            0,
            $exception
        );
    }
}
