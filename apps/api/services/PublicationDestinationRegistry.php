<?php

namespace app\services;

use yii\db\IntegrityException;

/** Owns destination and attachment history without changing publication state. */
class PublicationDestinationRegistry extends PublicationDestinationRegistryLifecycle
{
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
            return $this->registrationRaceResult($exception, $key, $pointer);
        });
    }

    private function registrationRaceResult(IntegrityException $exception, array $key, array $pointer)
    {
        $info = $exception->errorInfo;
        $message = $info[2] ?? '';
        $isRegistryDuplicate = ($info[0] ?? null) === '23000'
            && (int)($info[1] ?? 0) === 1062
            && is_string($message)
            && (strpos($message, 'uq_pub_dest_course_resource') !== false
                || strpos($message, 'uq_pub_dest_physical_reference') !== false
                || strpos($message, 'uq_pub_dest_owner_live') !== false);
        if (!$isRegistryDuplicate) {
            throw $exception;
        }

        $owner = $this->ownerForItem($key);
        $destination = $this->destinationForPointer($pointer);
        $attachment = $this->attachmentForItem($key);
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
            if ($this->hasLiveAttachments($destination['id'])) {
                return $this->error('destination_has_attachments');
            }
            return $this->error('destination_occupied');
        }
        throw $exception;
    }

    public function attach(array $item, $destinationId)
    {
        return Transactional::run(function () use ($item, $destinationId) {
            $key = $this->itemKey($item);
            $destination = $this->destination($destinationId);
            $row = $key ? $this->loadItem($key) : null;
            $entry = $destination ? $this->destinationEntry($destination) : null;
            $owner = $key ? $this->ownerForItem($key) : null;
            $attachment = $key ? $this->attachmentForItem($key) : null;
            $this->lockContext(
                [$this->itemContext($key, $row)], [$destination, $owner], [$entry], [$attachment]
            );

            $destination = $this->destination($destinationId);
            if (!$destination) {
                return $this->error('destination_missing');
            }
            if ($this->isRetired($destination)) {
                return $this->error('destination_retired');
            }
            $row = $key ? $this->loadItem($key) : null;
            $entry = $this->destinationEntry($destination);
            if ($entry === null) {
                return $this->error('destination_missing');
            }
            if (!$row) {
                return $this->error('item_missing');
            }
            $error = $this->offeringError($row, $entry['row']['offering_id'], $destination['offering_id']);
            if ($error !== null) {
                return $this->error($error);
            }
            $error = $this->physicalError($key, $row, $entry);
            if ($error !== null) {
                return $this->error($error);
            }

            $owner = $this->ownerForItem($key);
            $attachment = $this->attachmentForItem($key);
            if ($attachment && (int)$attachment['destination_id'] === (int)$destination['id']) {
                return $this->success(['attachment' => $attachment]);
            }
            if ($owner) {
                return $this->error('item_already_owns');
            }
            if ($attachment) {
                return $this->error('item_already_attached');
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
        }, function () {
            return $this->error('item_already_attached');
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
