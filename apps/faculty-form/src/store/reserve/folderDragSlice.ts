import type { ReserveSlice } from './types';
import { moveFolderInMixedList } from '@/utils/moveFolderInMixedList';

export const createFolderDragSlice: ReserveSlice<'moveFolderToPosition'> = (set) => ({
  moveFolderToPosition: (reserveId, folderId, targetContentId) => {
    set((state) => {
      const reserve = state.reserves.find((entry) => entry.id === reserveId);
      if (!reserve) return state;

      const folders = reserve.folders || [];
      const reorderedFolders = moveFolderInMixedList(
        folders,
        reserve.items || [],
        folderId,
        targetContentId
      );
      if (reorderedFolders === folders) return state;

      return {
        reserves: state.reserves.map((entry) => entry.id === reserveId
          ? {
              ...entry,
              folders: reorderedFolders,
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : entry
        )
      };
    });
  },
});
