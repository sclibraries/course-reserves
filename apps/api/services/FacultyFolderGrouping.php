<?php

namespace app\services;

class FacultyFolderGrouping
{
    public function group(array $folders, array $itemsByKind): array
    {
        $nameGroups = [];
        foreach ($folders as $folder) {
            $name = $folder['folder_name'];
            if ($name === null || $name === '') {
                continue;
            }

            $groupIndex = $this->nameGroupIndex($nameGroups, $name);
            if ($groupIndex === false) {
                $nameGroups[] = [
                    'name' => $name,
                    'folder_id' => (int)$folder['folder_id'],
                    'count' => 1,
                ];
                continue;
            }

            $nameGroups[$groupIndex]['count']++;
            $nameGroups[$groupIndex]['folder_id'] = min(
                $nameGroups[$groupIndex]['folder_id'],
                (int)$folder['folder_id']
            );
        }

        $folderItems = [];
        foreach ($folders as $folder) {
            $folderItems[(int)$folder['folder_id']] = [];
        }

        $containers = ['new' => [], 'reuse' => []];
        $rootItems = [];
        $orphanNames = [];
        foreach (['new', 'reuse'] as $kind) {
            foreach ($itemsByKind[$kind] ?? [] as $item) {
                $name = $item['folder_name'];
                $groupIndex = $name === null || $name === ''
                    ? false
                    : $this->nameGroupIndex($nameGroups, $name);
                $folderId = $groupIndex === false ? null : $nameGroups[$groupIndex]['folder_id'];

                if ($name !== null && $name !== '' && $groupIndex === false) {
                    $orphanNames[$name] = true;
                }

                $reference = ['kind' => $kind, 'id' => (int)$item['id']];
                $entry = [
                    'sort_key' => $this->itemSortKey($item, $kind, $folderId !== null),
                    'item' => $reference,
                ];
                if ($folderId === null) {
                    $rootItems[] = $entry;
                } else {
                    $folderItems[$folderId][] = $entry;
                }
                $containers[$kind][(int)$item['id']] = $folderId;
            }
        }

        usort($folders, function ($left, $right) {
            return $this->folderSortKey($left) <=> $this->folderSortKey($right);
        });
        $groupedFolders = [];
        foreach ($folders as $folder) {
            $folderId = (int)$folder['folder_id'];
            $groupIndex = $folder['folder_name'] === null || $folder['folder_name'] === ''
                ? false
                : $this->nameGroupIndex($nameGroups, $folder['folder_name']);
            usort($folderItems[$folderId], function ($left, $right) {
                return $left['sort_key'] <=> $right['sort_key'];
            });
            $groupedFolders[] = [
                'folder_id' => $folderId,
                'ambiguous' => $groupIndex !== false && $nameGroups[$groupIndex]['count'] > 1,
                'items' => array_column($folderItems[$folderId], 'item'),
            ];
        }

        usort($rootItems, function ($left, $right) {
            return $left['sort_key'] <=> $right['sort_key'];
        });
        foreach (['new', 'reuse'] as $kind) {
            ksort($containers[$kind], SORT_NUMERIC);
        }
        $orphanNames = array_map('strval', array_keys($orphanNames));
        sort($orphanNames, SORT_STRING);

        return [
            'folders' => $groupedFolders,
            'root' => array_column($rootItems, 'item'),
            'containers' => $containers,
            'orphan_names' => $orphanNames,
        ];
    }

    private function nameGroupIndex(array $nameGroups, $name)
    {
        foreach ($nameGroups as $index => $group) {
            if ($group['name'] === $name) {
                return $index;
            }
        }

        return false;
    }

    private function folderSortKey(array $folder): array
    {
        return array_merge(
            $this->nullableSortKey($folder['display_order']),
            [(int)$folder['folder_id']]
        );
    }

    private function itemSortKey(array $item, string $kind, bool $insideFolder): array
    {
        $key = array_merge(
            $this->nullableSortKey($item['display_order']),
            [$kind === 'new' ? 0 : 1, (int)$item['id']]
        );

        return $insideFolder
            ? array_merge($this->nullableSortKey($item['position_in_folder']), $key)
            : $key;
    }

    private function nullableSortKey($value): array
    {
        return [$value === null ? 1 : 0, (int)($value ?? 0)];
    }
}
