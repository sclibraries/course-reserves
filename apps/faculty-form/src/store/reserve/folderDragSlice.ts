import type { ReserveSlice } from './types';
import { moveTo } from '@/utils/listLayout';
import { updateReserveLayout } from './layoutState';

export const createFolderDragSlice: ReserveSlice<'moveFolderToPosition'> = (set) => ({
  moveFolderToPosition: (reserveId, folderId, targetContentId) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => moveTo(current, folderId, {
      before: targetContentId,
    })));
  },
});
