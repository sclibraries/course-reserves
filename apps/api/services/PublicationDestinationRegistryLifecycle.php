<?php

namespace app\services;

use yii\db\IntegrityException;

/** Handles ownership, attachment and destination lifecycle transitions. */
class PublicationDestinationRegistryLifecycle extends PublicationDestinationRegistryStore
{
    public function release(array $item)
    {
        $key = $this->itemKey($item);
        return PublicationDestinationTransaction::run(function ($attempt) use ($key) {
            $collect = function ($current, $guard) use ($key) {
                $row = $key ? $this->loadItem($key, $current, $guard) : null;
                $itemContext = $this->itemContext($key, $row);
                $relations = $this->itemRelationships([$itemContext], $current, $guard);
                return [
                    'items' => [$itemContext],
                    'destinations' => $relations['destinations'],
                    'entries' => $relations['entries'],
                    'pointers' => [],
                    'attachments' => $relations['attachments'],
                    'owner' => $key ? ($relations['owners'][$key['kind'] . ':' . $key['id']] ?? null) : null,
                ];
            };
            return $this->stager->run($attempt, $collect, function ($data) use ($key) {
                $owner = $data['owner'];
                if ($owner) {
                    $this->db->createCommand()->update('publication_destinations', [
                        'owner_live' => null,
                        'ownership_source' => 'released',
                    ], ['id' => $owner['id'], 'owner_live' => 1])->execute();
                }
                return $this->success(['released' => (bool)$owner]);
            });
        }, $this->probe);
    }

    public function retire($destinationId)
    {
        return PublicationDestinationTransaction::run(function ($attempt) use ($destinationId) {
            $collect = function ($current, $guard) use ($destinationId) {
                $destination = $this->destination($destinationId, $current, $guard);
                $entry = $destination ? $this->destinationEntry($destination, $current, $guard) : null;
                $attachments = $destination
                    ? $this->attachmentsForDestination($destinationId, $current, $guard) : [];
                $items = $this->contextsForAttachments($attachments, $current, $guard);
                $owner = $destination ? $this->ownerContext($destination, $current, $guard) : null;
                $items[] = $owner;
                $relations = $this->itemRelationships($items, $current, $guard);
                return [
                    'items' => $items,
                    'destinations' => array_merge([$destination], $relations['destinations']),
                    'entries' => array_merge([$entry], $relations['entries']),
                    'pointers' => [],
                    'attachments' => array_merge($attachments, $relations['attachments']),
                    'destination' => $destination,
                    'attachments_for_destination' => $attachments,
                ];
            };
            return $this->stager->run($attempt, $collect, function ($data) use ($destinationId) {
                $destination = $data['destination'];
                if (!$destination) {
                    return $this->error('destination_missing');
                }
                if ($destination['retired_at'] !== null) {
                    return $this->success(['destination' => $destination]);
                }
                $values = [
                    'course_resource_id' => null,
                    'physical_reference_id' => null,
                    'owner_live' => null,
                    'retired_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
                ];
                if ($destination['owner_item_kind'] !== null && $destination['owner_item_id'] !== null) {
                    $values['ownership_source'] = 'released';
                }
                $this->db->createCommand()->update('publication_destinations', $values, [
                    'id' => $destinationId,
                ])->execute();
                $attachmentIds = array_column($data['attachments_for_destination'], 'id');
                if ($attachmentIds) {
                    $this->db->createCommand()->update('publication_attachments', [
                        'live' => null,
                        'detached_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
                    ], ['id' => $attachmentIds, 'live' => 1])->execute();
                }
                return $this->success(['destination' => $this->destination($destinationId)]);
            });
        }, $this->probe);
    }

    public function detach(array $item)
    {
        $key = $this->itemKey($item);
        return PublicationDestinationTransaction::run(function ($attempt) use ($key) {
            $collect = function ($current, $guard) use ($key) {
                $row = $key ? $this->loadItem($key, $current, $guard) : null;
                $itemContext = $this->itemContext($key, $row);
                $relations = $this->itemRelationships([$itemContext], $current, $guard);
                $id = $key ? $key['kind'] . ':' . $key['id'] : null;
                return [
                    'items' => [$itemContext],
                    'destinations' => $relations['destinations'],
                    'entries' => $relations['entries'],
                    'pointers' => [],
                    'attachments' => $relations['attachments'],
                    'attachment' => $id === null ? null : ($relations['attachments_by_item'][$id] ?? null),
                ];
            };
            return $this->stager->run($attempt, $collect, function ($data) {
                $attachment = $data['attachment'];
                if ($attachment) {
                    $this->db->createCommand()->update('publication_attachments', [
                        'live' => null,
                        'detached_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
                    ], ['id' => $attachment['id'], 'live' => 1])->execute();
                }
                return $this->success(['detached' => (bool)$attachment]);
            });
        }, $this->probe);
    }

    public function follow($destinationId, array $newPointer)
    {
        $pointer = $this->pointerKey($newPointer);
        return PublicationDestinationTransaction::run(function ($attempt) use ($destinationId, $pointer) {
            $collect = function ($current, $guard) use ($destinationId, $pointer) {
                $destination = $this->destination($destinationId, $current, $guard);
                $oldEntry = $destination ? $this->destinationEntry($destination, $current, $guard) : null;
                $entry = $pointer ? $this->loadPointer($pointer, $current, $guard) : null;
                $conflict = $pointer ? $this->loadDestinationForPointer($pointer, $current, $guard) : null;
                $attachments = $destination
                    ? $this->attachmentsForDestination($destinationId, $current, $guard) : [];
                $itemContexts = $this->contextsForAttachments($attachments, $current, $guard);
                $owner = $destination ? $this->ownerContext($destination, $current, $guard) : null;
                $conflictOwner = $conflict ? $this->ownerContext($conflict, $current, $guard) : null;
                $items = array_merge($itemContexts, [$owner, $conflictOwner]);
                $relations = $this->itemRelationships($items, $current, $guard);
                return [
                    'items' => $items,
                    'destinations' => array_merge([$destination, $conflict], $relations['destinations']),
                    'entries' => array_merge([$oldEntry, $entry], $relations['entries']),
                    'pointers' => [$pointer],
                    'attachments' => array_merge($attachments, $relations['attachments']),
                    'destination' => $destination,
                    'entry' => $entry,
                    'conflict' => $conflict,
                    'attachment_items' => $itemContexts,
                    'attachments_for_destination' => $attachments,
                    'relations' => $relations,
                ];
            };
            return $this->stager->run($attempt, $collect, function ($data, $attempt) use ($destinationId, $pointer) {
                $destination = $data['destination'];
                $entry = $data['entry'];
                if (!$destination || !$entry) {
                    return $this->error('destination_missing');
                }
                if ($this->isRetired($destination)) {
                    return $this->error('destination_retired');
                }
                if (empty($destination['offering_id']) || empty($entry['row']['offering_id'])
                    || (int)$destination['offering_id'] !== (int)$entry['row']['offering_id']) {
                    return $this->error('offering_mismatch');
                }
                $rowItems = array_values(array_filter($data['attachment_items']));
                foreach ($rowItems as $context) {
                    if (!$context['row']) {
                        continue;
                    }
                    $error = $this->offeringError(
                        $context['row'], $entry['row']['offering_id'], $destination['offering_id']
                    );
                    if ($error !== null) {
                        return $this->error($error);
                    }
                }
                if ($entry['kind'] === 'physical') {
                    if ($entry['row']['identity_status'] !== 'verified'
                        || trim((string)$entry['row']['folio_instance_id']) === '') {
                        return $this->error('destination_unresolved');
                    }
                    foreach ($rowItems as $context) {
                        if (!$context['row']) {
                            continue;
                        }
                        $error = $this->snapshots->physicalIdentityError(
                            $context['kind'], $context['row'], $entry['row']
                        );
                        if ($error !== null) {
                            return $this->error($error);
                        }
                    }
                    if (count($entry['ambiguity_ids'] ?? []) > 1) {
                        return $this->error('destination_ambiguous');
                    }
                }
                foreach ($data['attachments_for_destination'] as $attachment) {
                    $key = $attachment['item_kind'] . ':' . (int)$attachment['item_id'];
                    if ($data['relations']['owners'][$key] ?? null) {
                        return $this->error('item_already_owns');
                    }
                }
                if ($destination['owner_live'] == 1 && $destination['owner_item_kind'] !== null) {
                    $ownerKey = $destination['owner_item_kind'] . ':' . (int)$destination['owner_item_id'];
                    if ($data['relations']['attachments_by_item'][$ownerKey] ?? null) {
                        return $this->error('item_already_attached');
                    }
                }
                if ($this->samePointer($destination, $pointer)) {
                    return $this->success(['destination' => $destination]);
                }
                if ($data['conflict'] && (int)$data['conflict']['id'] !== (int)$destinationId) {
                    return $this->error('destination_occupied');
                }

                $json = $this->snapshotJson($entry['snapshot']);
                $values = [
                    'destination_kind' => $pointer['kind'],
                    'course_resource_id' => $pointer['kind'] === 'electronic' ? $pointer['id'] : null,
                    'physical_reference_id' => $pointer['kind'] === 'physical' ? $pointer['id'] : null,
                    'offering_id' => $entry['row']['offering_id'],
                ];
                $this->probe->checkpoint('before_insert', $attempt, ['table' => 'publication_destinations']);
                try {
                    $this->db->createCommand()->update(
                        'publication_destinations', $values, ['id' => $destinationId]
                    )->execute();
                } catch (IntegrityException $exception) {
                    $this->restartDuplicate($exception, [
                        'uq_pub_dest_course_resource', 'uq_pub_dest_physical_reference',
                    ], $attempt);
                }
                foreach ($data['attachments_for_destination'] as $attachment) {
                    $this->db->createCommand()->update('publication_attachments', [
                        'attached_snapshot_json' => $json,
                    ], ['id' => $attachment['id'], 'live' => 1])->execute();
                }
                return $this->success(['destination' => $this->destination($destinationId)]);
            });
        }, $this->probe);
    }
}
