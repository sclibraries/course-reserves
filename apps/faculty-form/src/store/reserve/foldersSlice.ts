import type { ReserveSlice } from './types';
import { addFolder, move, moveTo, moveOutOfFolder, deleteFolder } from '@/utils/listLayout';
import { updateReserveLayout } from './layoutState';
import { createFolderDragSlice } from './folderDragSlice';

export const createFoldersSlice: ReserveSlice<
  'createFolder' | 'updateFolder' | 'deleteFolder' | 'addItemToFolder' |
  'removeItemFromFolder' | 'toggleFolder' | 'moveItemInFolder' |
  'moveFolderToPosition' | 'moveFolderPosition'
> = (set, get, store) => ({
  ...createFolderDragSlice(set, get, store),
  createFolder: (reserveId, title, description) => {
    const reserve = get().getReserveById(reserveId);
    if (!reserve) return '';
    const existingIds = new Set(reserve.folders.map((folder) => folder.id));
    const timestamp = Date.now();
    let folderId = `folder-${timestamp}`;
    let suffix = 1;
    while (existingIds.has(folderId)) folderId = `folder-${timestamp}-${suffix++}`;

    set((state) => updateReserveLayout(state, reserveId, (current) => addFolder(current, {
      id: folderId,
      title,
      description,
      isOpen: true,
      itemIds: [],
    })));
    return folderId;
  },

  updateFolder: (reserveId, folderId, updates) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === folderId
        ? { ...folder, ...updates }
        : folder),
    })));
  },

  deleteFolder: (reserveId, folderId) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => deleteFolder(current, folderId)));
  },

  addItemToFolder: (reserveId, folderId, itemId) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => moveTo(current, itemId, {
      intoFolder: folderId,
    })));
  },

  removeItemFromFolder: (reserveId, itemId) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => moveOutOfFolder(current, itemId)));
  },

  toggleFolder: (reserveId, folderId) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === folderId
        ? { ...folder, isOpen: !folder.isOpen }
        : folder),
    })));
  },

  moveItemInFolder: (reserveId, folderId, itemId, direction) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => {
      if (!current.folders.some((folder) => folder.id === folderId && folder.itemIds.includes(itemId))) {
        return current;
      }
      return move(current, itemId, direction);
    }));
  },

  moveFolderPosition: (reserveId, folderId, direction) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => {
      const index = current.layout.findIndex((entry) => entry.kind === 'folder' && entry.id === folderId);
      const targetIndex = index + (direction === 'up' ? -1 : 1);
      const target = current.layout[targetIndex];
      if (!target) return current;
      return direction === 'up'
        ? moveTo(current, folderId, { before: target.id })
        : moveTo(current, folderId, { after: target.id });
    }));
  },
});
