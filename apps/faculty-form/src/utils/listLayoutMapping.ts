import type { CourseFolder, CourseItem } from '@/store/reserve/types';
import type { LayoutEntry, ListLayoutState } from './listLayoutTypes';

type LegacyFolder = Omit<CourseFolder, 'itemIds'> & {
  itemIds?: string[];
  position?: number;
  items?: unknown[];
};

type ServerFolder = CourseFolder & { displayOrder: number };

export function fromLegacy(folders: LegacyFolder[], items: CourseItem[]): ListLayoutState {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const normalizedItems = items.map((item) => item.folderId && !folderIds.has(item.folderId)
    ? { ...item, folderId: undefined }
    : item);
  const normalizedFolders: CourseFolder[] = folders.map(({ position: _position, items: _items, itemIds: _itemIds, ...folder }) => ({
    ...folder,
    itemIds: normalizedItems.filter((item) => item.folderId === folder.id).map((item) => item.id),
  }));

  const entries = [
    ...folders.map((folder, index) => ({
      order: folder.position ?? 1000 + index,
      stableOrder: index,
      entry: { kind: 'folder' as const, id: folder.id },
    })),
    ...normalizedItems.flatMap((item, index) => item.folderId ? [] : [{
      order: index,
      stableOrder: folders.length + index,
      entry: { kind: 'item' as const, id: item.id },
    }]),
  ];

  return {
    layout: entries.sort(compareOrder).map((item) => item.entry),
    folders: normalizedFolders,
    items: normalizedItems,
  };
}

export function fromServer(folders: ServerFolder[], items: CourseItem[]): ListLayoutState {
  const folderEntries = folders.map((folder, index) => ({
    order: folder.displayOrder,
    stableOrder: index,
    entry: { kind: 'folder' as const, id: folder.id },
  }));
  const itemEntries = items.flatMap((item, index) => item.folderId ? [] : [{
    order: item.displayOrder ?? index,
    stableOrder: folders.length + index,
    entry: { kind: 'item' as const, id: item.id },
  }]);
  const normalizedFolders: CourseFolder[] = folders.map(({ displayOrder: _displayOrder, ...folder }) => ({
    ...folder,
    itemIds: folder.itemIds.filter((id) => items.some((item) => item.id === id && item.folderId === folder.id)),
  }));

  return {
    layout: [...folderEntries, ...itemEntries].sort(compareOrder).map((item) => item.entry),
    folders: normalizedFolders,
    items,
  };
}

function compareOrder<T extends { order: number; stableOrder: number; entry: LayoutEntry }>(
  left: T,
  right: T
): number {
  return left.order - right.order || left.stableOrder - right.stableOrder;
}
