<?php

namespace app\services;

/** Parses the pure faculty full-save operation envelope. */
class FacultySaveOperations
{
    const OPERATION_KEYS = [
        'create_item' => ['op', 'client_key', 'folder', 'data'],
        'change_item' => ['op', 'kind', 'id', 'changes'],
        'move_item' => ['op', 'kind', 'id', 'to_folder'],
        'delete_item' => ['op', 'kind', 'id'],
        'create_folder' => ['op', 'client_key', 'name'],
        'rename_folder' => ['op', 'id', 'name'],
        'delete_folder' => ['op', 'id'],
        'reorder_folder' => ['op', 'folder', 'order'],
        'reorder_root' => ['op', 'order'],
    ];

    public static function parse(array $payload)
    {
        try {
            return self::parsePayload($payload);
        } catch (\DomainException $error) {
            return ['error_code' => $error->getMessage()];
        } catch (\Throwable $error) {
            return ['error_code' => 'payload_format'];
        }
    }

    private static function parsePayload(array $payload)
    {
        $topKeys = ['format', 'operations'];
        if (array_key_exists('submission', $payload)) {
            $topKeys[] = 'submission';
        }
        self::ensure(self::hasExactKeys($payload, $topKeys)
            && ($payload['format'] ?? null) === 'faculty-save-operations-v1'
            && isset($payload['operations']) && is_array($payload['operations'])
            && array_values($payload['operations']) === $payload['operations']);

        $submission = [];
        if (array_key_exists('submission', $payload)) {
            self::ensure(is_array($payload['submission']));
            $submission = FacultySaveFields::submission($payload['submission']);
            self::ensure($submission !== false);
        }

        $operations = [];
        $createKeys = [];
        $folderCreates = [];
        $itemCreates = [];
        $folderReferences = [];
        $itemActions = [];
        $folderActions = [];
        $deletedItems = [];
        $deletedFolders = [];
        $reorders = [];
        $orders = [];
        $readOnlyChange = false;

        foreach ($payload['operations'] as $operation) {
            self::ensure(is_array($operation) && isset($operation['op']) && is_string($operation['op'])
                && isset(self::OPERATION_KEYS[$operation['op']])
                && self::hasExactKeys($operation, self::OPERATION_KEYS[$operation['op']]));

            $op = $operation['op'];
            if ($op === 'create_item') {
                self::ensure(self::validClientKey($operation['client_key']) && is_array($operation['data']));
                $folder = self::folderReference($operation['folder']);
                $data = FacultySaveFields::item($operation['data'], true);
                self::ensure($folder !== false && $data !== false);
                $createKeys[] = $operation['client_key'];
                $itemCreates[] = $operation['client_key'];
                if ($folder !== null) {
                    $folderReferences[] = $folder;
                }
                $operation['data'] = $data;
            } elseif ($op === 'change_item' || $op === 'move_item' || $op === 'delete_item') {
                $reference = self::itemReference(['kind' => $operation['kind'], 'id' => $operation['id']]);
                self::ensure($reference !== false);
                $identity = self::itemIdentity($reference);
                if ($op === 'change_item') {
                    self::ensure(is_array($operation['changes']) && $operation['changes']);
                    $changes = FacultySaveFields::item($operation['changes'], false);
                    self::ensure($changes !== false);
                    $operation['changes'] = $changes;
                    $readOnlyChange = $readOnlyChange || $operation['kind'] === 'reuse';
                } elseif ($op === 'move_item') {
                    $folder = self::folderReference($operation['to_folder']);
                    self::ensure($folder !== false);
                    if ($folder !== null) {
                        $folderReferences[] = $folder;
                    }
                } else {
                    $deletedItems[$identity] = true;
                }
                $itemActions[$identity][$op] = ($itemActions[$identity][$op] ?? 0) + 1;
            } elseif ($op === 'create_folder') {
                self::ensure(self::validClientKey($operation['client_key'])
                    && FacultySaveFields::folderName($operation['name']) !== false);
                $createKeys[] = $operation['client_key'];
                $folderCreates[] = $operation['client_key'];
            } elseif ($op === 'rename_folder' || $op === 'delete_folder') {
                self::ensure(self::positiveId($operation['id']));
                self::ensure($op !== 'rename_folder' || FacultySaveFields::folderName($operation['name']) !== false);
                $identity = 'id:' . $operation['id'];
                $folderActions[$identity][$op] = ($folderActions[$identity][$op] ?? 0) + 1;
                if ($op === 'delete_folder') {
                    $deletedFolders[$identity] = true;
                }
            } else {
                if ($op === 'reorder_folder') {
                    $folder = self::folderReference($operation['folder']);
                    self::ensure($folder !== false && $folder !== null);
                    $folderReferences[] = $folder;
                    $reorders[] = 'folder:' . self::folderIdentity($folder);
                } else {
                    $reorders[] = 'root';
                }
                $entries = self::parseOrder($operation['order'], $op === 'reorder_root');
                $orders[] = $entries;
                foreach ($entries as $entry) {
                    if ($entry['type'] === 'folder') {
                        $folderReferences[] = $entry['reference'];
                    }
                }
            }
            $operations[] = $operation;
        }

        if (count($createKeys) !== count(array_unique($createKeys))) {
            self::reject('duplicate_reference');
        }
        foreach ($itemActions as $actions) {
            if (max($actions) > 1 || (isset($actions['delete_item']) && array_sum($actions) > 1)) {
                self::reject('duplicate_reference');
            }
        }
        foreach ($folderActions as $actions) {
            if (max($actions) > 1 || (isset($actions['delete_folder']) && array_sum($actions) > 1)) {
                self::reject('duplicate_reference');
            }
        }
        if (count($reorders) !== count(array_unique($reorders))) {
            self::reject('duplicate_reference');
        }

        $itemOrderCounts = [];
        foreach ($orders as $entries) {
            $seen = [];
            foreach ($entries as $entry) {
                $identity = $entry['type'] . ':' . ($entry['type'] === 'item'
                    ? self::itemIdentity($entry['reference'])
                    : self::folderIdentity($entry['reference']));
                if (isset($seen[$identity])) {
                    self::reject('duplicate_reference');
                }
                $seen[$identity] = true;
                if ($entry['type'] === 'item') {
                    $itemIdentity = self::itemIdentity($entry['reference']);
                    $itemOrderCounts[$itemIdentity] = ($itemOrderCounts[$itemIdentity] ?? 0) + 1;
                    if (isset($deletedItems[$itemIdentity])) {
                        self::reject('duplicate_reference');
                    }
                }
            }
        }
        if (max(array_merge([0], array_values($itemOrderCounts))) > 1) {
            self::reject('duplicate_reference');
        }

        $folderCreates = array_fill_keys($folderCreates, true);
        $itemCreates = array_fill_keys($itemCreates, true);
        foreach ($folderReferences as $reference) {
            self::ensure(!isset($reference['client_key']) || isset($folderCreates[$reference['client_key']]), 'unknown_folder');
            self::ensure(!isset($reference['id']) || !isset($deletedFolders['id:' . $reference['id']]), 'unknown_folder');
        }
        foreach ($orders as $entries) {
            foreach ($entries as $entry) {
                $reference = $entry['reference'];
                self::ensure($entry['type'] !== 'item' || !isset($reference['client_key'])
                    || isset($itemCreates[$reference['client_key']]));
            }
        }
        if ($readOnlyChange) {
            self::reject('item_read_only');
        }
        return ['submission' => $submission, 'operations' => $operations];
    }

    private static function parseOrder($order, $allowFolders)
    {
        self::ensure(is_array($order) && array_values($order) === $order);
        $entries = [];
        foreach ($order as $entry) {
            self::ensure(is_array($entry));
            if (self::hasExactKeys($entry, ['item'])) {
                $reference = self::itemReference($entry['item']);
                self::ensure($reference !== false);
                $entries[] = ['type' => 'item', 'reference' => $reference];
            } elseif ($allowFolders && self::hasExactKeys($entry, ['folder'])) {
                $reference = self::folderReference($entry['folder']);
                self::ensure($reference !== false && $reference !== null);
                $entries[] = ['type' => 'folder', 'reference' => $reference];
            } else {
                self::reject();
            }
        }
        return $entries;
    }

    private static function folderReference($reference)
    {
        if ($reference === null) {
            return null;
        }
        if (!is_array($reference)) {
            return false;
        }
        if (self::hasExactKeys($reference, ['id']) && self::positiveId($reference['id'])) {
            return $reference;
        }
        if (self::hasExactKeys($reference, ['client_key']) && self::validClientKey($reference['client_key'])) {
            return $reference;
        }
        return false;
    }

    private static function itemReference($reference)
    {
        if (!is_array($reference)) {
            return false;
        }
        if (self::hasExactKeys($reference, ['client_key']) && self::validClientKey($reference['client_key'])) {
            return $reference;
        }
        if (self::hasExactKeys($reference, ['kind', 'id'])
            && in_array($reference['kind'], ['new', 'reuse'], true) && self::positiveId($reference['id'])) {
            return $reference;
        }
        return false;
    }

    private static function hasExactKeys(array $value, array $keys)
    {
        if (count($value) !== count($keys)) {
            return false;
        }
        foreach ($keys as $key) {
            if (!array_key_exists($key, $value)) {
                return false;
            }
        }
        return true;
    }

    private static function validClientKey($key)
    {
        return is_string($key) && preg_match('/\A[A-Za-z0-9][A-Za-z0-9_-]{0,63}\z/', $key) === 1;
    }

    private static function positiveId($id)
    {
        return is_int($id) && $id > 0;
    }

    private static function itemIdentity(array $reference)
    {
        return isset($reference['client_key'])
            ? 'client:' . $reference['client_key']
            : $reference['kind'] . ':' . $reference['id'];
    }

    private static function folderIdentity(array $reference)
    {
        return isset($reference['client_key']) ? 'client:' . $reference['client_key'] : 'id:' . $reference['id'];
    }

    private static function ensure($condition, $code = 'payload_format')
    {
        if (!$condition) {
            self::reject($code);
        }
    }

    private static function reject($code = 'payload_format')
    {
        throw new \DomainException($code);
    }
}
