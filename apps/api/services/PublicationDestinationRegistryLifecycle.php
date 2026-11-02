<?php

namespace app\services;

/** Handles registry lifecycle transitions. */
class PublicationDestinationRegistryLifecycle extends PublicationDestinationRegistryStore
{
    public function release(array $item)
    {
        return Transactional::run(function () use ($item) {
            $key = $this->itemKey($item);
            $row = $key ? $this->loadItem($key) : null;
            $owner = $key ? $this->ownerForItem($key) : null;
            $destination = $owner ? $this->destination($owner['id']) : null;
            $entry = $destination ? $this->destinationEntry($destination) : null;
            $this->lockContext([$this->itemContext($key, $row)], [$destination], [$entry]);
            $owner = $key ? $this->ownerForItem($key) : null;
            if ($owner) {
                $this->db->createCommand()->update('publication_destinations', [
                    'owner_live' => null,
                    'ownership_source' => 'released',
                ], ['id' => $owner['id'], 'owner_live' => 1])->execute();
            }
            return $this->success(['released' => (bool)$owner]);
        });
    }

    public function retire($destinationId)
    {
        return Transactional::run(function () use ($destinationId) {
            $destination = $this->destination($destinationId);
            if (!$destination) {
                return $this->error('destination_missing');
            }
            if ($this->isRetired($destination)) {
                return $this->success(['destination' => $destination]);
            }
            $entry = $this->destinationEntry($destination);
            $attachments = $this->attachmentsForDestination($destinationId);
            $items = $this->contextsForAttachments($attachments);
            $owner = $this->ownerContext($destination);
            $this->lockContext(array_merge($items, [$owner]), [$destination], [$entry], $attachments);

            $destination = $this->destination($destinationId);
            if (!$destination) {
                return $this->error('destination_missing');
            }
            if ($this->isRetired($destination)) {
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
            $this->db->createCommand()->update('publication_destinations', $values, ['id' => $destinationId])->execute();
            $this->db->createCommand()->update('publication_attachments', [
                'live' => null,
                'detached_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
            ], ['destination_id' => $destinationId, 'live' => 1])->execute();
            return $this->success(['destination' => $this->destination($destinationId)]);
        });
    }

    public function detach(array $item)
    {
        return Transactional::run(function () use ($item) {
            $key = $this->itemKey($item);
            $row = $key ? $this->loadItem($key) : null;
            $attachment = $key ? $this->attachmentForItem($key) : null;
            $destination = $attachment ? $this->destination($attachment['destination_id']) : null;
            $entry = $destination ? $this->destinationEntry($destination) : null;
            $this->lockContext([$this->itemContext($key, $row)], [$destination], [$entry], [$attachment]);
            $attachment = $key ? $this->attachmentForItem($key) : null;
            if ($attachment) {
                $this->db->createCommand()->update('publication_attachments', [
                    'live' => null,
                    'detached_at' => new \yii\db\Expression('CURRENT_TIMESTAMP'),
                ], ['id' => $attachment['id'], 'live' => 1])->execute();
            }
            return $this->success(['detached' => (bool)$attachment]);
        });
    }

    public function follow($destinationId, array $newPointer)
    {
        return Transactional::run(function () use ($destinationId, $newPointer) {
            $destination = $this->destination($destinationId);
            $pointer = $this->pointerKey($newPointer);
            $entry = $pointer ? $this->loadPointer($pointer) : null;
            if (!$destination) {
                return $this->error('destination_missing');
            }
            if ($this->isRetired($destination)) {
                return $this->error('destination_retired');
            }
            $attachments = $this->attachmentsForDestination($destinationId);
            $items = $this->contextsForAttachments($attachments);
            $owner = $this->ownerContext($destination);
            $items[] = $owner;
            $this->lockContext($items, [$destination], [$this->destinationEntry($destination), $entry], $attachments);

            $destination = $this->destination($destinationId);
            if (!$destination) {
                return $this->error('destination_missing');
            }
            if ($this->isRetired($destination)) {
                return $this->error('destination_retired');
            }
            $entry = $pointer ? $this->loadPointer($pointer) : null;
            if ($entry === null) {
                return $this->error('destination_missing');
            }
            $rowItems = $this->loadContextItems($items);
            foreach ($rowItems as $context) {
                $error = $this->offeringError($context['row'], $entry['row']['offering_id'], $destination['offering_id']);
                if ($error !== null) {
                    return $this->error($error);
                }
                $error = $this->physicalError(['kind' => $context['kind'], 'id' => $context['id']], $context['row'], $entry);
                if ($error !== null) {
                    return $this->error($error);
                }
            }
            if ($this->samePointer($destination, $pointer)) {
                return $this->success(['destination' => $destination]);
            }
            $conflict = $this->destinationForPointer($pointer);
            if ($conflict && (int)$conflict['id'] !== (int)$destinationId) {
                return $this->error('destination_occupied');
            }
            $json = $this->snapshotJson($entry['snapshot']);
            $values = [
                'destination_kind' => $pointer['kind'],
                'course_resource_id' => $pointer['kind'] === 'electronic' ? $pointer['id'] : null,
                'physical_reference_id' => $pointer['kind'] === 'physical' ? $pointer['id'] : null,
                'offering_id' => $entry['row']['offering_id'],
            ];
            $this->db->createCommand()->update('publication_destinations', $values, ['id' => $destinationId])->execute();
            foreach ($attachments as $attachment) {
                $this->db->createCommand()->update('publication_attachments', [
                    'attached_snapshot_json' => $json,
                ], ['id' => $attachment['id'], 'live' => 1])->execute();
            }
            return $this->success(['destination' => $this->destination($destinationId)]);
        }, function () {
            return $this->error('destination_occupied');
        });
    }
}
