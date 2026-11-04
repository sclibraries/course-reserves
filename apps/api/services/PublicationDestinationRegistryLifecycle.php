<?php

namespace app\services;

use yii\db\Expression;

/** Handles ownership, attachment and destination lifecycle transitions. */
class PublicationDestinationRegistryLifecycle extends PublicationDestinationRegistryStore
{
    public function release(array $item)
    {
        $key = $this->itemKey($item);
        return PublicationDestinationTransaction::run(function ($attempt) use ($key) {
            $owner = $key ? $this->ownerForItem($key) : null;
            $anchor = $owner ? ['destination_ids' => [$owner['id']]] : $this->itemAnchor($key);
            $this->lockFirst($attempt, $this->discoverCourse($owner), $anchor);
            $released = $key && $this->db->createCommand()->update('publication_destinations', [
                'owner_live' => null,
                'ownership_source' => 'released',
            ], ['owner_item_kind' => $key['kind'], 'owner_item_id' => $key['id'], 'owner_live' => 1])->execute() > 0;
            return $this->success(['released' => $released]);
        }, $this->probe);
    }

    public function retire($destinationId)
    {
        return PublicationDestinationTransaction::run(function ($attempt) use ($destinationId) {
            $course = $this->discoverCourse($this->destination($destinationId));
            $this->lockFirst($attempt, $course, ['destination_ids' => [$destinationId]]);
            $destination = $this->destination($destinationId, true);
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
                'retired_at' => new Expression('CURRENT_TIMESTAMP'),
            ];
            if ($destination['owner_item_kind'] !== null && $destination['owner_item_id'] !== null) {
                $values['ownership_source'] = 'released';
            }
            $this->db->createCommand()->update('publication_destinations', $values, ['id' => $destination['id']])
                ->execute();
            $this->detachWhere(['destination_id' => $destination['id']]);
            return $this->success(['destination' => $this->destination($destination['id'])]);
        }, $this->probe);
    }

    public function detach(array $item)
    {
        $key = $this->itemKey($item);
        return PublicationDestinationTransaction::run(function ($attempt) use ($key) {
            $attachment = $key ? $this->attachmentForItem($key) : null;
            $destination = $attachment ? $this->destination($attachment['destination_id']) : null;
            $anchor = $attachment ? ['destination_ids' => [$attachment['destination_id']]] : $this->itemAnchor($key);
            $this->lockFirst($attempt, $this->discoverCourse($destination), $anchor);
            $detached = $key && $this->detachWhere(['item_kind' => $key['kind'], 'item_id' => $key['id']]) > 0;
            return $this->success(['detached' => $detached]);
        }, $this->probe);
    }

    public function follow($destinationId, array $newPointer)
    {
        $pointer = $this->pointerKey($newPointer);
        return PublicationDestinationTransaction::run(function ($attempt) use ($destinationId, $pointer) {
            $course = $this->discoverCourse($this->destination($destinationId), $pointer);
            $this->lockFirst($attempt, $course, ['destination_ids' => [$destinationId]]);
            $destination = $this->destination($destinationId, true);
            $entry = $pointer ? $this->loadPointer($pointer) : null;
            if (!$destination || !$entry) {
                return $this->error('destination_missing');
            }
            if ($this->isRetired($destination)) {
                return $this->error('destination_retired');
            }
            $attachments = $this->liveAttachments($destination['id']);
            $error = $this->followError($destination, $entry, $attachments);
            if ($error !== null) {
                return $this->error($error);
            }
            if ($this->samePointer($destination, $pointer)) {
                return $this->success(['destination' => $destination]);
            }
            $conflict = $this->destinationForPointer($pointer, true);
            if ($conflict && (int)$conflict['id'] !== (int)$destination['id']) {
                return $this->error('destination_occupied');
            }

            $this->probe->checkpoint('before_insert', $attempt, ['table' => 'publication_destinations']);
            $this->db->createCommand()->update('publication_destinations', [
                'destination_kind' => $pointer['kind'],
                'course_resource_id' => $pointer['kind'] === 'electronic' ? $pointer['id'] : null,
                'physical_reference_id' => $pointer['kind'] === 'physical' ? $pointer['id'] : null,
                'offering_id' => $entry['row']['offering_id'],
            ], ['id' => $destination['id']])->execute();
            if ($attachments) {
                $this->db->createCommand()->update('publication_attachments', [
                    'attached_snapshot_json' => $this->snapshotJson($entry['snapshot']),
                ], ['destination_id' => $destination['id'], 'live' => 1])->execute();
            }
            return $this->success(['destination' => $this->destination($destination['id'])]);
        }, $this->probe);
    }

    /** Attached items and the live owner, offering across all of them first, then physical identity. */
    private function followError(array $destination, array $entry, array $attachments)
    {
        $offering = $entry['row']['offering_id'];
        if (empty($destination['offering_id']) || empty($offering) || (int)$destination['offering_id'] !== (int)$offering) {
            return 'offering_mismatch';
        }
        $keys = array_map(function ($attachment) {
            return ['kind' => $attachment['item_kind'], 'id' => (int)$attachment['item_id']];
        }, $attachments);
        $ownerKey = $this->ownerKey($destination);
        $items = $this->loadItems($ownerKey ? array_merge($keys, [$ownerKey]) : $keys);
        foreach ($items as $item) {
            $error = $this->offeringError($item['row'], $offering, $destination['offering_id']);
            if ($error !== null) {
                return $error;
            }
        }
        $error = $this->physicalError($items, $entry);
        if ($error !== null) {
            return $error;
        }
        foreach ($keys as $key) {
            if ($this->ownerForItem($key, true)) {
                return 'item_already_owns';
            }
        }
        return $ownerKey && $this->attachmentForItem($ownerKey, true) ? 'item_already_attached' : null;
    }

    private function detachWhere(array $condition)
    {
        return $this->db->createCommand()->update('publication_attachments', [
            'live' => null,
            'detached_at' => new Expression('CURRENT_TIMESTAMP'),
        ], $condition + ['live' => 1])->execute();
    }
}
