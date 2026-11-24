<?php

namespace app\services;

/** Parses the pure faculty full-save operation envelope. */
class FacultySaveOperations
{
    const OPERATION_KEYS = [
        'create_item' => ['op', 'client_key', 'folder', 'data'], 'change_item' => ['op', 'kind', 'id', 'changes'],
        'move_item' => ['op', 'kind', 'id', 'to_folder'], 'delete_item' => ['op', 'kind', 'id'],
        'create_folder' => ['op', 'client_key', 'name'], 'rename_folder' => ['op', 'id', 'name'],
        'delete_folder' => ['op', 'id'], 'reorder_folder' => ['op', 'folder', 'order'],
        'reorder_root' => ['op', 'order'],
    ];

    public static function parse(array $payload)
    {
        try {
            return self::parsePayload($payload);
        } catch (\DomainException $error) {
            return ['error_code' => $error->getMessage()];
        }
    }

    private static function parsePayload(array $payload)
    {
        $keys = ['format', 'operations'];
        if (array_key_exists('submission', $payload)) {
            $keys[] = 'submission';
        }
        self::ensure(self::hasExactKeys($payload, $keys) && ($payload['format'] ?? null) === 'faculty-save-operations-v1'
            && isset($payload['operations']) && is_array($payload['operations'])
            && array_values($payload['operations']) === $payload['operations']);

        self::ensure(!array_key_exists('submission', $payload) || is_array($payload['submission']));
        $submission = isset($payload['submission']) ? FacultySaveFields::submission($payload['submission']) : [];
        $operations = [];
        foreach ($payload['operations'] as $operation) {
            self::ensure(is_array($operation) && isset($operation['op']) && is_string($operation['op'])
                && isset(self::OPERATION_KEYS[$operation['op']])
                && self::hasExactKeys($operation, self::OPERATION_KEYS[$operation['op']]));
            if (in_array($operation['op'], ['create_item', 'change_item', 'move_item', 'delete_item'], true)) {
                $operation = self::readItemOperation($operation);
            } elseif (in_array($operation['op'], ['create_folder', 'rename_folder', 'delete_folder'], true)) {
                $operation = self::readFolderOperation($operation);
            } else {
                $operation = self::readOrderOperation($operation);
            }
            $operations[] = $operation;
        }

        self::checkDuplicates($operations);
        self::checkUnknownReferences($operations);
        foreach ($operations as $operation) {
            self::ensure($operation['op'] !== 'change_item' || $operation['kind'] !== 'reuse', 'item_read_only');
        }
        return ['submission' => $submission, 'operations' => $operations];
    }

    private static function readItemOperation(array $operation)
    {
        if ($operation['op'] === 'create_item') {
            self::ensure(self::validClientKey($operation['client_key']) && is_array($operation['data']));
            $operation['folder'] = self::reference($operation['folder'], 'folder');
            $operation['data'] = FacultySaveFields::item($operation['data'], true);
        } else {
            self::reference(['kind' => $operation['kind'], 'id' => $operation['id']], 'item');
            if ($operation['op'] === 'change_item') {
                self::ensure(is_array($operation['changes']) && $operation['changes']);
                $operation['changes'] = FacultySaveFields::item($operation['changes'], false);
            } elseif ($operation['op'] === 'move_item') {
                $operation['to_folder'] = self::reference($operation['to_folder'], 'folder');
            }
        }
        return $operation;
    }

    private static function readFolderOperation(array $operation)
    {
        self::ensure($operation['op'] === 'create_folder' ? self::validClientKey($operation['client_key'])
            : self::positiveId($operation['id']));
        if ($operation['op'] !== 'delete_folder') {
            $operation['name'] = FacultySaveFields::folderName($operation['name']);
        }
        return $operation;
    }

    private static function readOrderOperation(array $operation)
    {
        if ($operation['op'] === 'reorder_folder') {
            $operation['folder'] = self::reference($operation['folder'], 'folder');
            self::ensure($operation['folder'] !== null);
        }
        $operation['order'] = self::parseOrder($operation['order'], $operation['op'] === 'reorder_root');
        return $operation;
    }

    private static function checkDuplicates(array $operations)
    {
        $creates = [];
        $actions = [];
        $reorders = [];
        $orders = [];
        foreach ($operations as $operation) {
            $op = $operation['op'];
            if (isset($operation['order'])) {
                $orders[] = $operation['order'];
            }
            if (isset($operation['client_key'])) {
                $creates[] = $operation['client_key'];
            } elseif (isset($operation['id'])) {
                $identity = self::referenceIdentity($operation);
                $actions[$identity][$op] = ($actions[$identity][$op] ?? 0) + 1;
            } elseif ($op === 'reorder_root') {
                $reorders[] = 'root';
            } else {
                $reorders[] = self::referenceIdentity($operation['folder']);
            }
        }
        self::ensure(count($creates) === count(array_unique($creates)), 'duplicate_reference');
        foreach ($actions as $counts) {
            $deletes = isset($counts['delete_item']) || isset($counts['delete_folder']);
            self::ensure(max($counts) === 1 && (!$deletes || array_sum($counts) === 1), 'duplicate_reference');
        }
        self::ensure(count($reorders) === count(array_unique($reorders)), 'duplicate_reference');

        $itemsOrdered = [];
        foreach ($orders as $entries) {
            $seen = [];
            foreach ($entries as $entry) {
                if (isset($entry['item'])) {
                    $identity = self::referenceIdentity($entry['item']);
                    self::ensure(!isset($itemsOrdered[$identity])
                        && !isset($actions[$identity]['delete_item']), 'duplicate_reference');
                    $itemsOrdered[$identity] = true;
                } else {
                    $identity = self::referenceIdentity($entry['folder']);
                    self::ensure(!isset($seen[$identity]), 'duplicate_reference');
                    $seen[$identity] = true;
                }
            }
        }
    }

    private static function checkUnknownReferences(array $operations)
    {
        $creates = [];
        $deletedFolders = [];
        $folderReferences = [];
        $itemReferences = [];
        foreach ($operations as $operation) {
            if (isset($operation['client_key'])) {
                $creates[$operation['client_key']] = $operation['op'];
            } elseif ($operation['op'] === 'delete_folder') {
                $deletedFolders[$operation['id']] = true;
            }
            $folder = $operation['folder'] ?? $operation['to_folder'] ?? null;
            if ($folder !== null) {
                $folderReferences[] = $folder;
            }
            foreach ($operation['order'] ?? [] as $entry) {
                if (isset($entry['folder'])) {
                    $folderReferences[] = $entry['folder'];
                } elseif (isset($entry['item']['client_key'])) {
                    $itemReferences[] = $entry['item']['client_key'];
                }
            }
        }
        foreach ($folderReferences as $reference) {
            self::ensure((!isset($reference['client_key'])
                || ($creates[$reference['client_key']] ?? null) === 'create_folder')
                && (!isset($reference['id']) || !isset($deletedFolders[$reference['id']])), 'unknown_folder');
        }
        foreach ($itemReferences as $key) {
            self::ensure(($creates[$key] ?? null) === 'create_item');
        }
    }

    private static function parseOrder($order, $allowFolders)
    {
        self::ensure(is_array($order) && array_values($order) === $order);
        foreach ($order as $entry) {
            self::ensure(is_array($entry));
            $type = isset($entry['item']) ? 'item' : 'folder';
            self::ensure(self::hasExactKeys($entry, [$type]) && ($type === 'item' || $allowFolders));
            $reference = self::reference($entry[$type], $type);
            self::ensure($type === 'item' || $reference !== null);
        }
        return $order;
    }

    private static function reference($reference, $type)
    {
        if ($type === 'folder' && $reference === null) {
            return null;
        }
        self::ensure(is_array($reference));
        if (self::hasExactKeys($reference, ['client_key'])) {
            self::ensure(self::validClientKey($reference['client_key']));
            return $reference;
        }
        $keys = $type === 'folder' ? ['id'] : ['kind', 'id'];
        self::ensure(self::hasExactKeys($reference, $keys)
            && ($type === 'folder' ? self::positiveId($reference['id'] ?? null)
                : in_array($reference['kind'] ?? null, ['new', 'reuse'], true)
                    && self::positiveId($reference['id'] ?? null)));
        return $reference;
    }

    private static function referenceIdentity(array $reference)
    {
        return isset($reference['client_key']) ? 'client:' . $reference['client_key'] : (isset($reference['kind'])
            ? $reference['kind'] . ':' . $reference['id'] : 'id:' . $reference['id']);
    }

    private static function hasExactKeys(array $value, array $keys)
    {
        return count($value) === count($keys) && !array_diff($keys, array_keys($value));
    }

    private static function validClientKey($key)
    {
        return is_string($key) && preg_match('/\A[A-Za-z0-9][A-Za-z0-9_-]{0,63}\z/', $key) === 1;
    }

    private static function positiveId($id)
    {
        return is_int($id) && $id > 0;
    }

    private static function ensure($condition, $code = 'payload_format')
    {
        if (!$condition) { throw new \DomainException($code); }
    }
}
