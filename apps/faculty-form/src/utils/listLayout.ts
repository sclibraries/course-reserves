import type { CourseFolder, CourseItem } from '@/store/reserve/types';
import type { ListLayoutState } from './listLayoutTypes';

export type { LayoutEntry, ListLayoutState, MoveTarget } from './listLayoutTypes';
export { canMoveDown, canMoveUp, moveDown, moveTo, moveUp } from './listLayoutMoves';

export function assertLayout(state: ListLayoutState): true {
  const foldersById = new Map(state.folders.map((folder) => [folder.id, folder]));
  const itemsById = new Map(state.items.map((item) => [item.id, item]));
  const seenFolders = new Set<string>();
  const seenItems = new Set<string>();

  state.layout.forEach((entry) => {
    if (entry.kind === 'folder') {
      if (!foldersById.has(entry.id)) throw new Error(`Unknown folder ${entry.id} in layout`);
      if (seenFolders.has(entry.id)) throw new Error(`Duplicate folder ${entry.id} in layout`);
      seenFolders.add(entry.id);
      return;
    }

    const item = itemsById.get(entry.id);
    if (!item) throw new Error(`Unknown item ${entry.id} in layout`);
    if (item.folderId) throw new Error(`Folder item ${entry.id} appears in top-level layout`);
    if (seenItems.has(entry.id)) throw new Error(`Duplicate item ${entry.id} in layout`);
    seenItems.add(entry.id);
  });

  state.folders.forEach((folder) => {
    if (!seenFolders.has(folder.id)) throw new Error(`Missing folder ${folder.id} from layout`);
    folder.itemIds.forEach((itemId) => {
      const item = itemsById.get(itemId);
      if (!item) throw new Error(`Unknown item ${itemId} in folder ${folder.id}`);
      if (item.folderId !== folder.id) throw new Error(`Item ${itemId} has the wrong folder id`);
      if (seenItems.has(itemId)) throw new Error(`Duplicate item ${itemId} in layout`);
      seenItems.add(itemId);
    });
  });

  state.items.forEach((item) => {
    if (!seenItems.has(item.id)) throw new Error(`Missing item ${item.id} from layout`);
  });
  return true;
}

export function addItem(state: ListLayoutState, item: CourseItem, folderId = item.folderId): ListLayoutState {
  if (state.items.some((candidate) => candidate.id === item.id)) return state;
  const folder = folderId && state.folders.find((candidate) => candidate.id === folderId);
  if (folder) {
    return {
      ...state,
      items: [...state.items, { ...item, folderId: folder.id }],
      folders: state.folders.map((candidate) => candidate.id === folder.id
        ? { ...candidate, itemIds: [...candidate.itemIds, item.id] }
        : candidate),
    };
  }
  return {
    ...state,
    items: [...state.items, { ...item, folderId: undefined }],
    layout: [...state.layout, { kind: 'item', id: item.id }],
  };
}

export function removeItem(state: ListLayoutState, id: string): ListLayoutState {
  if (!state.items.some((item) => item.id === id)) return state;
  return {
    ...state,
    items: state.items.filter((item) => item.id !== id),
    layout: state.layout.filter((entry) => entry.id !== id),
    folders: state.folders.map((folder) => ({
      ...folder,
      itemIds: folder.itemIds.filter((itemId) => itemId !== id),
    })),
  };
}

export function moveOutOfFolder(state: ListLayoutState, id: string): ListLayoutState {
  const folder = state.folders.find((candidate) => candidate.itemIds.includes(id));
  if (!folder || !state.items.some((item) => item.id === id)) return state;
  const folderIndex = state.layout.findIndex((entry) => entry.kind === 'folder' && entry.id === folder.id);
  if (folderIndex < 0) return state;
  const layout = state.layout.slice();
  layout.splice(folderIndex + 1, 0, { kind: 'item', id });
  return {
    ...state,
    layout,
    folders: state.folders.map((candidate) => candidate.id === folder.id
      ? { ...candidate, itemIds: candidate.itemIds.filter((itemId) => itemId !== id) }
      : candidate),
    items: state.items.map((candidate) => candidate.id === id
      ? { ...candidate, folderId: undefined }
      : candidate),
  };
}

export function addFolder(state: ListLayoutState, folder: CourseFolder): ListLayoutState {
  if (state.folders.some((candidate) => candidate.id === folder.id)) return state;
  return {
    ...state,
    folders: [{ ...folder, itemIds: [] }, ...state.folders],
    layout: [{ kind: 'folder', id: folder.id }, ...state.layout],
  };
}

export function deleteFolder(state: ListLayoutState, id: string): ListLayoutState {
  const folder = state.folders.find((candidate) => candidate.id === id);
  const index = state.layout.findIndex((entry) => entry.kind === 'folder' && entry.id === id);
  if (!folder || index < 0) return state;
  const layout = state.layout.slice();
  layout.splice(index, 1, ...folder.itemIds.map((itemId) => ({ kind: 'item' as const, id: itemId })));
  const childIds = new Set(folder.itemIds);
  return {
    ...state,
    layout,
    folders: state.folders.filter((candidate) => candidate.id !== id),
    items: state.items.map((item) => childIds.has(item.id) ? { ...item, folderId: undefined } : item),
  };
}

export { fromLegacy, fromServer } from './listLayoutMapping';
export { toPayloadOrder } from './listLayoutPayload';
export type { PayloadOrder } from './listLayoutPayload';
