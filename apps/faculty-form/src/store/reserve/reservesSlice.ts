import type { ReserveSlice, CourseReserve } from './types';
import { fromLegacy } from '@/utils/listLayout';
import { getLayoutState } from './layoutState';

const RESERVE_CLONE_OMIT_KEYS = [
  'submissionUuid', 'draftVersion', 'courseAssignmentId', 'academicPeriod',
  'assigneeStaffUserId', 'isLocked', 'lockedAt', 'lockedBy', 'lockReason',
  'canEdit', 'access', 'proxyCanEdit',
] as const satisfies readonly (keyof CourseReserve)[];

const FOLDER_CLONE_OMIT_KEYS = ['backendFolderId', 'ambiguous'] as const;
const ITEM_CLONE_OMIT_KEYS = ['backendItemId', 'backendKind', 'lock', 'capabilities'] as const;

function omitKeys<T extends object, K extends keyof T>(object: T, keys: readonly K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(object).filter(([key]) => !keys.includes(key as K)),
  ) as Omit<T, K>;
}

export const createReservesSlice: ReserveSlice<'initialize' | 'addReserve' | 'findReserveByAssignmentId' | 'updateReserve' | 'deleteReserve' | 'getReserveById' | 'getUserReserves' | 'getTestReserves' | 'cloneReserve' | 'getReserveStats' | 'clearDuplicates'> = (set, get, store) => ({
  initialize: () => {
    // No longer need to inject test data
    // Just ensure structure is valid
    const state = get();
    if (!state._initialized) {
      const migratedReserves = state.reserves.map((reserve) => ({
        ...reserve,
        ...getLayoutState(reserve),
      }));

      set({
        reserves: migratedReserves,
        _initialized: true
      });
    }
  },

  addReserve: (reserve) => {
    const id = `reserve-${Date.now()}`;
    const layoutState = reserve.layout
      ? { layout: reserve.layout, folders: reserve.folders || [], items: reserve.items || [] }
      : fromLegacy(reserve.folders || [], reserve.items || []);
    const newReserve: CourseReserve = {
      ...reserve,
      id,
      ...layoutState,
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
    return { ...reserve, ...getLayoutState(reserve) };
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

    const source = getLayoutState(originalReserve);
    const folderIdMapping: { [oldId: string]: string } = {};
    const itemIdMapping: { [oldId: string]: string } = {};
    source.folders.forEach((folder, index) => {
      folderIdMapping[folder.id] = `folder-${timestamp}-${index}`;
    });
    source.items.forEach((item, index) => {
      itemIdMapping[item.id] = `item-${timestamp}-${index}`;
    });

    const reserveCopy = omitKeys(originalReserve, RESERVE_CLONE_OMIT_KEYS);

    const clonedReserve: CourseReserve = {
      ...reserveCopy,
      ...newCourseData,
      id: newId,
      status: 'draft',
      isTestData: false,
      folders: source.folders.map((folder) => {
        const clonedFolder = {
          ...omitKeys(folder, FOLDER_CLONE_OMIT_KEYS),
          id: folderIdMapping[folder.id],
          itemIds: folder.itemIds.map((itemId) => itemIdMapping[itemId]),
        };
        return clonedFolder;
      }),
      items: source.items.map((item) => {
        const clonedItem = {
          ...omitKeys(item, ITEM_CLONE_OMIT_KEYS),
          id: itemIdMapping[item.id],
          folderId: item.folderId ? folderIdMapping[item.folderId] : undefined,
          status: 'draft' as const,
        };
        return clonedItem;
      }),
      layout: source.layout.map((entry) => ({
        ...entry,
        id: entry.kind === 'folder' ? folderIdMapping[entry.id] : itemIdMapping[entry.id],
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
