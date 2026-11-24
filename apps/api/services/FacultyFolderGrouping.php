<?php

namespace app\services;

class FacultyFolderGrouping
{
    public function group(array $folders, array $itemsByKind): array
    {
        $idsByName = [];
        $folderItems = [];
        foreach ($folders as $folder) {
            if ($folder['folder_name'] !== null && $folder['folder_name'] !== '') {
                $idsByName[$folder['folder_name']][] = (int)$folder['folder_id'];
            }
            $folderItems[(int)$folder['folder_id']] = [];
        }

        $items = [];
        $orphanNames = [];
        foreach (['new', 'reuse'] as $kind) {
            foreach ($itemsByKind[$kind] ?? [] as $item) {
                $name = $item['folder_name'];
                $ids = $idsByName[$name] ?? [];
                $folderId = $ids ? min($ids) : null;
                if (isset($item['folder_name']) && !$ids) {
                    $orphanNames[$name] = true;
                }
                $items[] = [
                    'kind' => $kind,
                    'id' => (int)$item['id'],
                    'folder_id' => $folderId,
                    'sort_key' => $this->itemSortKey($item, $kind, $folderId !== null),
                ];
            }
        }

        usort($items, function ($left, $right) {
            return $left['sort_key'] <=> $right['sort_key'];
        });
        $root = [];
        $containers = ['new' => [], 'reuse' => []];
        foreach ($items as $item) {
            $reference = ['kind' => $item['kind'], 'id' => $item['id']];
            $containers[$item['kind']][$item['id']] = $item['folder_id'];
            if ($item['folder_id'] === null) {
                $root[] = $reference;
            } else {
                $folderItems[$item['folder_id']][] = $reference;
            }
        }
        unset($orphanNames['']);
        ksort($containers['new'], SORT_NUMERIC);
        ksort($containers['reuse'], SORT_NUMERIC);
        $orphanNames = array_map('strval', array_keys($orphanNames));
        sort($orphanNames, SORT_STRING);

        usort($folders, function ($left, $right) {
            return $this->folderSortKey($left) <=> $this->folderSortKey($right);
        });
        $groupedFolders = [];
        foreach ($folders as $folder) {
            $ids = $idsByName[$folder['folder_name']] ?? [];
            $folderId = (int)$folder['folder_id'];
            $groupedFolders[] = [
                'folder_id' => $folderId,
                'ambiguous' => count($ids) > 1,
                'items' => $folderItems[$folderId],
            ];
        }

        return [
            'folders' => $groupedFolders,
            'root' => $root,
            'containers' => $containers,
            'orphan_names' => $orphanNames,
        ];
    }

    private function folderSortKey(array $folder): array
    {
        return [...$this->nullableSortKey($folder['display_order']), (int)$folder['folder_id']];
    }

    private function itemSortKey(array $item, string $kind, bool $insideFolder): array
    {
        $position = $insideFolder ? $item['position_in_folder'] : 0;
        return [
            ...$this->nullableSortKey($position),
            ...$this->nullableSortKey($item['display_order']),
            $kind === 'new' ? 0 : 1,
            (int)$item['id'],
        ];
    }

    private function nullableSortKey($value): array
    {
        return [$value === null, (int)($value ?? 0)];
    }
}
