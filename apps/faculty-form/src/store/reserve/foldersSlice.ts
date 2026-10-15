import type { ReserveSlice } from './types';

export const createFoldersSlice: ReserveSlice<'createFolder' | 'updateFolder' | 'deleteFolder' | 'addItemToFolder' | 'removeItemFromFolder' | 'toggleFolder' | 'moveItemInFolder' | 'moveFolderPosition'> = (set, get, store) => ({
  createFolder: (reserveId, title, description) => {
    const folderId = `folder-${Date.now()}`;
    set((state) => ({
      reserves: state.reserves.map(reserve => {
        if (reserve.id === reserveId) {
          // Create folder at the very beginning (position 0 or slightly before the first item)
          const folders = reserve.folders || [];
          const items = reserve.items || [];

          // Find the minimum position currently in use
          const ungroupedItems = items.filter(item => !item.folderId);
          const existingPositions = [
            ...folders.map(f => f.position || 0),
            ...ungroupedItems.map((_, index) => index)
          ];

          const minPosition = existingPositions.length > 0 ? Math.min(...existingPositions) : 0;

          // Place new folder before the earliest position (use negative or fractional)
          const newFolderPosition = minPosition <= 0 ? minPosition - 1 : -0.5;

          return {
            ...reserve,
            folders: [...folders, {
              id: folderId,
              title,
              description,
              isOpen: true,
              items: [],
              position: newFolderPosition
            }],
            lastUpdated: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            })
          };
        }
        return reserve;
      })
    }));
    return folderId;
  },

  updateFolder: (reserveId, folderId, updates) => {
    set((state) => ({
      reserves: state.reserves.map(reserve =>
        reserve.id === reserveId
          ? {
              ...reserve,
              folders: (reserve.folders || []).map(folder =>
                folder.id === folderId
                  ? { ...folder, ...updates }
                  : folder
              ),
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : reserve
      )
    }));
  },

  deleteFolder: (reserveId, folderId) => {
    set((state) => ({
      reserves: state.reserves.map(reserve =>
        reserve.id === reserveId
          ? {
              ...reserve,
              folders: (reserve.folders || []).filter(folder => folder.id !== folderId),
              // Remove folderId from items that were in this folder
              items: (reserve.items || []).map(item =>
                item.folderId === folderId
                  ? { ...item, folderId: undefined }
                  : item
              ),
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : reserve
      )
    }));
  },

  addItemToFolder: (reserveId, folderId, itemId) => {
    set((state) => ({
      reserves: state.reserves.map(reserve =>
        reserve.id === reserveId
          ? {
              ...reserve,
              items: (reserve.items || []).map(item =>
                item.id === itemId
                  ? { ...item, folderId }
                  : item
              ),
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : reserve
      )
    }));
  },

  removeItemFromFolder: (reserveId, itemId) => {
    set((state) => ({
      reserves: state.reserves.map(reserve =>
        reserve.id === reserveId
          ? {
              ...reserve,
              items: (reserve.items || []).map(item =>
                item.id === itemId
                  ? { ...item, folderId: undefined }
                  : item
              ),
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : reserve
      )
    }));
  },

  toggleFolder: (reserveId, folderId) => {
    set((state) => ({
      reserves: state.reserves.map(reserve =>
        reserve.id === reserveId
          ? {
              ...reserve,
              folders: (reserve.folders || []).map(folder =>
                folder.id === folderId
                  ? { ...folder, isOpen: !folder.isOpen }
                  : folder
              )
            }
          : reserve
      )
    }));
  },

  moveItemInFolder: (reserveId, folderId, itemId, direction) => {
    set((state) => ({
      reserves: state.reserves.map(reserve => {
        if (reserve.id === reserveId) {
          const items = reserve.items || [];

          // Get items in this folder
          const folderItems = items.filter(item => item.folderId === folderId);
          const currentIndex = folderItems.findIndex(item => item.id === itemId);

          if (currentIndex === -1) return reserve;

          const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

          // Check bounds
          if (newIndex < 0 || newIndex >= folderItems.length) return reserve;

          // Create a new items array with reordered folder items
          const otherItems = items.filter(item => item.folderId !== folderId);
          const reorderedFolderItems = [...folderItems];
          [reorderedFolderItems[currentIndex], reorderedFolderItems[newIndex]] =
          [reorderedFolderItems[newIndex], reorderedFolderItems[currentIndex]];

          return {
            ...reserve,
            items: [...otherItems, ...reorderedFolderItems],
            lastUpdated: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            })
          };
        }
        return reserve;
      })
    }));
  },

  moveFolderPosition: (reserveId, folderId, direction) => {
    set((state) => {
      const reserve = state.reserves.find(r => r.id === reserveId);
      if (!reserve) return state;

      const folders = reserve.folders || [];
      const items = reserve.items || [];
      const ungroupedItems = items.filter(item => !item.folderId);

      // Create the current mixed display order
      const mixedContent = [
        ...folders.map((folder) => ({
          type: 'folder' as const,
          id: folder.id,
          position: folder.position ?? 1000
        })),
        ...ungroupedItems.map((item, index) => ({
          type: 'item' as const,
          id: item.id,
          position: index
        }))
      ];

      // Sort to get current display order
      mixedContent.sort((a, b) => a.position - b.position);

      // Find where this folder currently is in the mixed display
      const currentDisplayIndex = mixedContent.findIndex(item =>
        item.type === 'folder' && item.id === folderId
      );

      if (currentDisplayIndex === -1) return state;

      const newDisplayIndex = direction === 'up' ? currentDisplayIndex - 1 : currentDisplayIndex + 1;

      // Check bounds
      if (newDisplayIndex < 0 || newDisplayIndex >= mixedContent.length) return state;

      // Get what we're swapping with
      const targetItem = mixedContent[newDisplayIndex];

      // Calculate new positions
      let newFolderPosition: number;

      if (targetItem.type === 'folder') {
        // Swapping with another folder - swap their positions
        newFolderPosition = targetItem.position;
      } else {
        // Moving before/after an item - calculate position to insert there
        if (direction === 'up') {
          // Insert before this item
          const prevItem = newDisplayIndex > 0 ? mixedContent[newDisplayIndex - 1] : null;
          newFolderPosition = prevItem ? (prevItem.position + targetItem.position) / 2 : targetItem.position - 1;
        } else {
          // Insert after this item
          const nextItem = newDisplayIndex < mixedContent.length - 1 ? mixedContent[newDisplayIndex + 1] : null;
          newFolderPosition = nextItem ? (targetItem.position + nextItem.position) / 2 : targetItem.position + 1;
        }
      }

      return {
        reserves: state.reserves.map(reserve =>
          reserve.id === reserveId
            ? {
                ...reserve,
                folders: folders.map(folder => {
                  if (folder.id === folderId) {
                    return { ...folder, position: newFolderPosition };
                  }
                  // If we swapped with another folder, update its position too
                  if (targetItem.type === 'folder' && folder.id === targetItem.id) {
                    return { ...folder, position: mixedContent[currentDisplayIndex].position };
                  }
                  return folder;
                }),
                lastUpdated: new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })
              }
            : reserve
        )
      };
    });
  }
});
