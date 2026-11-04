<?php

namespace app\services;

/** Owns destination and attachment history without changing publication state. */
class PublicationDestinationRegistry extends PublicationDestinationRegistryLifecycle
{
    public function registerOwned(array $item, array $destination)
    {
        $key = $this->itemKey($item);
        $pointer = $this->pointerKey($destination);
        return PublicationDestinationTransaction::run(function ($attempt) use ($key, $pointer) {
            $registry = $pointer ? $this->destinationForPointer($pointer) : null;
            $this->lockFirst($attempt, $this->discoverCourse($registry, $pointer, $key), $this->itemAnchor($key));

            $entry = $pointer ? $this->loadPointer($pointer) : null;
            if ($entry === null) {
                return $this->error('destination_missing');
            }
            $row = $key ? $this->loadItem($key) : null;
            if (!$row) {
                return $this->error('item_missing');
            }
            $registry = $this->destinationForPointer($pointer, true);
            if ($registry && $this->isRetired($registry)) {
                return $this->error('destination_retired');
            }
            $offering = $entry['row']['offering_id'];
            $error = $this->offeringError($row, $offering, $registry['offering_id'] ?? $offering)
                ?? $this->physicalError([$key + ['row' => $row]], $entry);
            if ($error !== null) {
                return $this->error($error);
            }
            $owner = $this->ownerForItem($key, true);
            if ($owner && $registry && (int)$owner['id'] === (int)$registry['id']) {
                return $this->success(['destination' => $registry]);
            }
            $error = $owner ? 'item_already_owns' : ($this->attachmentForItem($key, true) ? 'item_already_attached' : null);
            if ($error === null && $registry) {
                $error = (int)$registry['owner_live'] === 1 ? 'destination_already_owned'
                    : ($this->liveAttachments($registry['id']) ? 'destination_has_attachments' : 'destination_occupied');
            }
            if ($error !== null) {
                return $this->error($error);
            }

            $this->probe->checkpoint('before_insert', $attempt, ['table' => 'publication_destinations']);
            return $this->success(['destination' => $this->insertDestination($pointer, $entry, $key, 'published')]);
        }, $this->probe);
    }

    public function attach(array $item, $destinationId)
    {
        $key = $this->itemKey($item);
        $pointer = is_array($destinationId) ? $this->pointerKey($destinationId) : null;
        return PublicationDestinationTransaction::run(function ($attempt) use ($key, $destinationId, $pointer) {
            $destination = $pointer ? $this->destinationForPointer($pointer) : $this->destination($destinationId);
            $anchor = is_array($destinationId) ? [] : ['destination_ids' => [$destinationId]];
            $this->lockFirst($attempt, $this->discoverCourse($destination, $pointer), $anchor);

            $destination = $pointer ? $this->destinationForPointer($pointer, true) : $this->destination($destinationId, true);
            if (!$destination && !$pointer) {
                return $this->error('destination_missing');
            }
            if ($destination && $this->isRetired($destination)) {
                return $this->error('destination_retired');
            }
            $entry = $pointer ? $this->loadPointer($pointer) : $this->destinationEntry($destination);
            if ($entry === null) {
                return $this->error('destination_missing');
            }
            $row = $key ? $this->loadItem($key) : null;
            if (!$row) {
                return $this->error('item_missing');
            }
            $offering = $entry['row']['offering_id'];
            $error = $this->offeringError($row, $offering, $destination['offering_id'] ?? $offering)
                ?? $this->physicalError([$key + ['row' => $row]], $entry);
            if ($error !== null) {
                return $this->error($error);
            }
            $owner = $this->ownerForItem($key, true);
            $attachment = $this->attachmentForItem($key, true);
            if ($destination && $attachment && (int)$attachment['destination_id'] === (int)$destination['id']) {
                return $this->success(['attachment' => $attachment]);
            }
            if ($owner || $attachment) {
                return $this->error($owner ? 'item_already_owns' : 'item_already_attached');
            }

            if (!$destination) {
                $this->probe->checkpoint('before_insert', $attempt, ['table' => 'publication_destinations']);
                $destination = $this->insertDestination($pointer, $entry);
            }
            $this->probe->checkpoint('before_insert', $attempt, ['table' => 'publication_attachments']);
            $this->db->createCommand()->insert('publication_attachments', [
                'destination_id' => $destination['id'],
                'item_kind' => $key['kind'],
                'item_id' => $key['id'],
                'attached_snapshot_json' => $this->snapshotJson($entry['snapshot']),
                'live' => 1,
            ])->execute();
            return $this->success(['attachment' => $this->attachment((int)$this->db->getLastInsertID())]);
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
        return $this->destination((int)$this->db->getLastInsertID());
    }
}
