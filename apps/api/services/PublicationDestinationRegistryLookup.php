<?php

namespace app\services;

/** Reads owner rows without locking uncovered earlier-ranked destinations. */
class PublicationDestinationRegistryLookup
{
    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function destinationForPointer(array $pointer, $forUpdate = false, $destinationId = null)
    {
        $column = $pointer['kind'] === 'electronic' ? 'course_resource_id' : 'physical_reference_id';
        $where = '`' . $column . '` = :id';
        $params = [':id' => $pointer['id']];
        if ($destinationId !== null) {
            $where .= ' AND id = :destination_id';
            $params[':destination_id'] = (int)$destinationId;
        }
        return $this->db->createCommand(
            'SELECT * FROM publication_destinations WHERE ' . $where . ($forUpdate ? ' FOR UPDATE' : ''),
            $params
        )->queryOne();
    }

    public function ownerForItem(array $key, $forUpdate, ?callable $guard)
    {
        if ($guard !== null) {
            call_user_func($guard, $key['kind'] === 'new' ? 'new_item_ids' : 'reuse_item_ids', $key['id']);
        }
        return $this->byPredicate(
            'owner_item_kind = :kind AND owner_item_id = :id AND owner_live = 1',
            [':kind' => $key['kind'], ':id' => $key['id']], $forUpdate, $guard
        );
    }

    private function byPredicate($where, array $params, $forUpdate, ?callable $guard)
    {
        if ($forUpdate && $guard !== null) {
            $id = $this->db->createCommand(
                'SELECT id FROM publication_destinations WHERE ' . $where . ' ORDER BY id LIMIT 1', $params
            )->queryScalar();
            if (!$id) {
                return null;
            }
            call_user_func($guard, 'destination_ids', $id);
            $params[':destination_id'] = (int)$id;
            return $this->db->createCommand(
                'SELECT * FROM publication_destinations WHERE id = :destination_id AND ' . $where . ' FOR UPDATE',
                $params
            )->queryOne();
        }

        $row = $this->db->createCommand(
            'SELECT * FROM publication_destinations WHERE ' . $where
            . ($forUpdate ? ' FOR UPDATE' : ''), $params
        )->queryOne();
        if ($row && $guard !== null) {
            call_user_func($guard, 'destination_ids', $row['id']);
        }
        return $row;
    }
}
