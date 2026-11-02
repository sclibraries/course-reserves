<?php

namespace app\services;

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
            if (!$this->transactionHasWrites()) {
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
        }, function () {
            return $this->error('destination_occupied');
        });
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
