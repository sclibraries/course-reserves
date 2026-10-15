import type { ReserveSlice, CourseReserve } from './types';

export const createReservesSlice: ReserveSlice<'initialize' | 'addReserve' | 'findReserveByAssignmentId' | 'updateReserve' | 'deleteReserve' | 'getReserveById' | 'getUserReserves' | 'getTestReserves' | 'cloneReserve' | 'getReserveStats' | 'clearDuplicates'> = (set, get, store) => ({
  initialize: () => {
    // No longer need to inject test data
    // Just ensure structure is valid
    const state = get();
    if (!state._initialized) {
      const migratedReserves = state.reserves.map(reserve => ({
        ...reserve,
        folders: reserve.folders || [],
        items: reserve.items || []
      }));

      set({
        reserves: migratedReserves,
        _initialized: true
      });
    }
  },

  addReserve: (reserve) => {
    const id = `reserve-${Date.now()}`;
    const newReserve: CourseReserve = {
      ...reserve,
      id,
      items: reserve.items || [],
      folders: reserve.folders || [],
      lastUpdated: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
      isTestData: false // Explicitly mark as user data
    };

    set((state) => {
      // Ensure we don't overwrite test data
      const updatedReserves = [newReserve, ...state.reserves];
      console.log('Adding new reserve. Total reserves:', updatedReserves.length,
                 'User reserves:', updatedReserves.filter(r => !r.isTestData).length,
                 'Test reserves:', updatedReserves.filter(r => r.isTestData).length);
      return { reserves: updatedReserves };
    });

    return id;
  },

  findReserveByAssignmentId: (courseAssignmentId) => {
    const state = get();
    return state.reserves.find(r => r.courseAssignmentId === courseAssignmentId);
  },

  updateReserve: (id, updates) => {
    set((state) => ({
      reserves: state.reserves.map((reserve) =>
        reserve.id === id
          ? {
              ...reserve,
              ...updates,
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

  deleteReserve: (id) => {
    set((state) => ({
      reserves: state.reserves.filter((reserve) => reserve.id !== id)
    }));
  },

  getReserveById: (id) => {
    const reserve = get().reserves.find((reserve) => reserve.id === id);
    if (!reserve) return undefined;

    // Ensure folders property exists (backwards compatibility)
    return {
      ...reserve,
      folders: reserve.folders || [],
      items: reserve.items || []
    };
  },

  getUserReserves: () => {
    return get().reserves.filter((reserve) => !reserve.isTestData);
  },

  getTestReserves: () => {
    return get().reserves.filter((reserve) => reserve.isTestData);
  },

  cloneReserve: (id, newCourseData) => {
    const originalReserve = get().getReserveById(id);
    if (!originalReserve) return '';

    const newId = `reserve-${Date.now()}`;
    const timestamp = Date.now();

    // Create folder mapping for updating item folderIds
    const folderIdMapping: { [oldId: string]: string } = {};

    const clonedReserve: CourseReserve = {
      ...originalReserve,
      ...newCourseData,
      id: newId,
      status: 'draft',
      isTestData: false,
      folders: (originalReserve.folders || []).map((folder, index) => {
        const newFolderId = `folder-${timestamp}-${index}`;
        folderIdMapping[folder.id] = newFolderId;
        return {
          ...folder,
          id: newFolderId,
          items: [] // Items will be populated separately
        };
      }),
      items: (originalReserve.items || []).map((item, index) => ({
        ...item,
        id: `item-${timestamp}-${index}`,
        folderId: item.folderId ? folderIdMapping[item.folderId] : undefined,
        status: 'draft'
      })),
      lastUpdated: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    };

    set((state) => ({
      reserves: [clonedReserve, ...state.reserves]
    }));

    return newId;
  },

  getReserveStats: (id) => {
    const reserve = get().getReserveById(id);
    if (!reserve) {
      return {
        totalItems: 0,
        completeItems: 0,
        inProgressItems: 0,
        needsReviewItems: 0,
        draftItems: 0
      };
    }

    return {
      totalItems: reserve.items.length,
      completeItems: reserve.items.filter(item => item.status === 'complete').length,
      inProgressItems: reserve.items.filter(item => item.status === 'in-progress').length,
      needsReviewItems: reserve.items.filter(item => item.status === 'needs-review').length,
      draftItems: reserve.items.filter(item => item.status === 'draft').length,
    };
  },

  clearDuplicates: () => {
    set((state) => {
      const uniqueReserves = state.reserves.filter((reserve, index, self) =>
        index === self.findIndex(r => r.id === reserve.id)
      );
      return { reserves: uniqueReserves };
    });
  }
});
