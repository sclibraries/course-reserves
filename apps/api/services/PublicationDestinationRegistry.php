<?php

namespace app\services;

use yii\db\IntegrityException;

/** Owns destination and attachment history without changing publication state. */
class PublicationDestinationRegistry extends PublicationDestinationRegistryLifecycle
{
    public function __construct(
        $db = null,
        ?PublicationDestinationLock $lock = null,
        ?PublicationDestinationSnapshot $snapshots = null,
        ?PublicationDestinationProbe $probe = null
    ) {
        parent::__construct($db, $lock, $snapshots, $probe);
    }

    public function registerOwned(array $item, array $destination)
    {
        return Transactional::run(function () use ($item, $destination) {
            $key = $this->itemKey($item);
            $pointer = $this->pointerKey($destination);
            $row = $key ? $this->loadItem($key) : null;
            $entry = $pointer ? $this->loadPointer($pointer) : null;
            $registryRow = $pointer ? $this->destinationForPointer($pointer) : null;
            $owner = $key ? $this->ownerForItem($key) : null;
            $attachment = $key ? $this->attachmentForItem($key) : null;
            $this->lockContext([$this->itemContext($key, $row)], [$registryRow], [$entry], [$attachment]);

            $row = $key ? $this->loadItem($key) : null;
            $entry = $pointer ? $this->loadPointer($pointer) : null;
            $registryRow = $pointer ? $this->destinationForPointer($pointer) : null;
            $owner = $key ? $this->ownerForItem($key) : null;
            $attachment = $key ? $this->attachmentForItem($key) : null;
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
                if ($this->hasLiveAttachments($registryRow['id'])) {
                    return $this->error('destination_has_attachments');
                }
                return $this->error('destination_occupied');
            }
            $this->db->createCommand()->insert('publication_destinations', [
                'destination_kind' => $pointer['kind'],
                'course_resource_id' => $pointer['kind'] === 'electronic' ? $pointer['id'] : null,
                'physical_reference_id' => $pointer['kind'] === 'physical' ? $pointer['id'] : null,
                'offering_id' => $entry['row']['offering_id'],
                'origin_offering_id' => $entry['row']['offering_id'],
                'owner_item_kind' => $key['kind'],
                'owner_item_id' => $key['id'],
                'owner_live' => 1,
                'ownership_source' => 'published',
            ])->execute();
            return $this->success(['destination' => $this->destination((int)$this->db->getLastInsertID())]);
        }, function (IntegrityException $exception) use ($item, $destination) {
            $key = $this->itemKey($item);
            $pointer = $this->pointerKey($destination);
            if (!$key || !$pointer) {
                throw $exception;
            }
            return Transactional::run(function () use ($exception, $key, $pointer) {
                return $this->registrationRaceResult($exception, $key, $pointer);
            });
        });
    }

    private function registrationRaceResult(IntegrityException $exception, array $key, array $pointer)
    {
        if (!PublicationDestinationDuplicateKey::name($exception, [
            'uq_pub_dest_course_resource',
            'uq_pub_dest_physical_reference',
            'uq_pub_dest_owner_live',
        ])) {
            throw $exception;
        }

        $owner = $this->ownerForItem($key, true);
        $destination = $this->destinationForPointer($pointer, true);
        $attachment = $this->attachmentForItem($key, true);
        if ($owner && $destination && (int)$owner['id'] === (int)$destination['id']) {
            return $this->success(['destination' => $destination]);
        }
        if ($owner) {
            return $this->error('item_already_owns');
        }
        if ($attachment) {
            return $this->error('item_already_attached');
        }
        if ($destination) {
            if ((int)$destination['owner_live'] === 1) {
                return $this->error('destination_already_owned');
            }
            if ($this->hasLiveAttachments($destination['id'], true)) {
                return $this->error('destination_has_attachments');
            }
            return $this->error('destination_occupied');
        }
        throw $exception;
    }

    public function attach(array $item, $destinationId)
    {
        return $this->attachWithDestination($item, $destinationId, null);
    }

    private function attachWithDestination(array $item, $destinationId, $currentDestination)
    {
        return Transactional::run(function () use ($item, $destinationId, $currentDestination) {
            $key = $this->itemKey($item);
            $pointer = is_array($destinationId) ? $this->pointerKey($destinationId) : null;
            $destination = $currentDestination ?: ($pointer
                ? $this->destinationForPointer($pointer)
                : $this->destination($destinationId));
            $row = $key ? $this->loadItem($key) : null;
            $entry = $pointer ? $this->loadPointer($pointer) : ($destination ? $this->destinationEntry($destination) : null);
            $owner = $key ? $this->ownerForItem($key) : null;
            $attachment = $key ? $this->attachmentForItem($key) : null;
            $this->lockContext(
                [$this->itemContext($key, $row)], [$destination, $owner], [$entry], [$attachment]
            );

            $destination = $currentDestination
                ? $this->destination($destinationId, true)
                : ($pointer ? $this->destinationForPointer($pointer) : $this->destination($destinationId));
            $entry = $pointer ? $this->loadPointer($pointer) : ($destination ? $this->destinationEntry($destination) : null);
            if (!$destination && !$pointer) {
                return $this->error('destination_missing');
            }
            if ($destination && $this->isRetired($destination)) {
                return $this->error('destination_retired');
            }
            $row = $key ? $this->loadItem($key) : null;
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

            $owner = $this->ownerForItem($key);
            $attachment = $this->attachmentForItem($key);
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
                $this->db->createCommand()->insert('publication_destinations', [
                    'destination_kind' => $pointer['kind'],
                    'course_resource_id' => $pointer['kind'] === 'electronic' ? $pointer['id'] : null,
                    'physical_reference_id' => $pointer['kind'] === 'physical' ? $pointer['id'] : null,
                    'offering_id' => $entry['row']['offering_id'],
                    'origin_offering_id' => $entry['row']['offering_id'],
                    'ownership_source' => 'none',
                ])->execute();
                $destination = $this->destination((int)$this->db->getLastInsertID());
            }
            $json = $this->snapshotJson($entry['snapshot']);
            $this->db->createCommand()->insert('publication_attachments', [
                'destination_id' => $destination['id'],
                'item_kind' => $key['kind'],
                'item_id' => $key['id'],
                'attached_snapshot_json' => $json,
                'live' => 1,
            ])->execute();
            return $this->success(['attachment' => $this->attachment((int)$this->db->getLastInsertID())]);
        }, function (IntegrityException $exception) use ($item, $destinationId) {
            return $this->attachmentRaceResult($exception, $item, $destinationId);
        });
    }

    private function attachmentRaceResult(IntegrityException $exception, array $item, $destinationId)
    {
        $pointer = is_array($destinationId) ? $this->pointerKey($destinationId) : null;
        $key = $this->itemKey($item);
        $duplicate = PublicationDestinationDuplicateKey::name($exception, [
            'uq_pub_dest_course_resource',
            'uq_pub_dest_physical_reference',
            'uq_pub_attach_item_live',
        ]);
        if (!$key || !$duplicate) {
            throw $exception;
        }

        return Transactional::run(function () use ($exception, $destinationId, $pointer, $key, $duplicate) {
            $row = $this->loadItem($key);
            $destination = $pointer
                ? $this->destinationForPointer($pointer)
                : $this->destination($destinationId);
            $entry = $pointer
                ? $this->loadPointer($pointer)
                : ($destination ? $this->destinationEntry($destination) : null);
            $owner = $this->ownerForItem($key);
            $attachment = $this->attachmentForItem($key);
            $this->lockContext(
                [$this->itemContext($key, $row)], [$destination, $owner], [$entry], [$attachment]
            );

            $destination = $pointer
                ? $this->destinationForPointer($pointer, true)
                : $this->destination($destinationId, true);
            $this->ownerForItem($key, true);
            $attachment = $this->attachmentForItem($key, true);
            if ($duplicate === 'uq_pub_attach_item_live') {
                if (!$attachment) {
                    throw $exception;
                }
                if ($destination && (int)$attachment['destination_id'] === (int)$destination['id']) {
                    return $this->success(['attachment' => $attachment]);
                }
                return $this->error('item_already_attached');
            }

            if (!$pointer || !$destination) {
                throw $exception;
            }
            return $this->attachWithDestination($key, $destination['id'], $destination);
        });
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
}
