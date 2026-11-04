<?php

namespace app\services;

/**
 * Reads destination rows by pointer or owner item.
 *
 * Under the ordered locks these are locking reads: a snapshot read would miss a winner committed after discovery.
 * They are keyed by a pointer or item that is already locked, and every writer locks that key before touching
 * such a row, so the read cannot wait on a holder of a later-ranked lock.
 */
class PublicationDestinationRegistryLookup
{
    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function destinationForPointer(array $pointer, $forUpdate = false)
    {
        $column = $pointer['kind'] === 'electronic' ? 'course_resource_id' : 'physical_reference_id';
        return $this->db->createCommand(
            'SELECT * FROM publication_destinations WHERE `' . $column . '` = :id' . ($forUpdate ? ' FOR UPDATE' : ''),
            [':id' => $pointer['id']]
        )->queryOne();
    }

    public function ownerForItem(array $key, $forUpdate, ?callable $guard)
    {
        if ($guard !== null) {
            call_user_func($guard, $key['kind'] === 'new' ? 'new_item_ids' : 'reuse_item_ids', $key['id']);
        }
        $owner = $this->db->createCommand(
            'SELECT * FROM publication_destinations WHERE owner_item_kind = :kind AND owner_item_id = :id '
            . 'AND owner_live = 1 LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : ''),
            [':kind' => $key['kind'], ':id' => $key['id']]
        )->queryOne();
        if ($owner && $guard !== null) {
            call_user_func($guard, 'destination_ids', $owner['id']);
        }
        return $owner;
    }
}
