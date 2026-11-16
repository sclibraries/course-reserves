import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CourseReservesState } from './reserve/types';
import { createFoldersSlice } from './reserve/foldersSlice';
import { createItemsSlice } from './reserve/itemsSlice';
import { createPollingSlice } from './reserve/pollingSlice';
import { createReservesSlice } from './reserve/reservesSlice';
import { createSubmissionFetchSlice } from './reserve/submissionFetchSlice';
import { createSubmissionLifecycleSlice } from './reserve/submissionLifecycleSlice';
import { fromLegacy } from '@/utils/listLayout';
import { mergeUserScopedState, readSessionUsername, stampUserScopedState } from '@/services/session';

const currentUsername = () => readSessionUsername(document.cookie, Math.floor(Date.now() / 1000));

export type {
  CourseFolder,
  CourseItem,
  CourseReserve,
  CourseReserveItem,
  FolioCopiedItem,
  FolioLocation,
} from './reserve/types';

export const useReserveStore = create<CourseReservesState>()(
  devtools(
    persist(
      (set, get, api) => ({
        reserves: [],
        ownerUsername: null,
        _initialized: true,
        loading: false,
        error: null,
        pollingInterval: null,
        ...createReservesSlice(set, get, api),
        ...createSubmissionFetchSlice(set, get, api),
        ...createSubmissionLifecycleSlice(set, get, api),
        ...createPollingSlice(set, get, api),
        ...createItemsSlice(set, get, api),
        ...createFoldersSlice(set, get, api),
      }),
      {
        name: 'course-reserves-storage',
        version: 1,
        partialize: (state) => stampUserScopedState({
          reserves: state.reserves,
          _initialized: state._initialized,
        }, currentUsername()),
        merge: (persistedState, currentState) => {
          const merged = mergeUserScopedState(
            persistedState as Partial<CourseReservesState> & { ownerUsername?: string | null },
            currentState,
            currentUsername() ?? null,
          );
          if (merged) return merged;
          localStorage.removeItem('course-reserves-storage');
          return currentState;
        },
        migrate: (persistedState, version) => {
          if (version >= 1) return persistedState as CourseReservesState;
          const persisted = persistedState as Partial<CourseReservesState>;
          return {
            ...persisted,
            reserves: (persisted.reserves || []).map((reserve) => ({
              ...reserve,
              ...fromLegacy(
                (reserve.folders || []) as unknown as Parameters<typeof fromLegacy>[0],
                reserve.items || []
              ),
            })),
          } as CourseReservesState;
        },
      }
    ),
    { name: 'CourseReservesStore' }
  )
);

export const clearCourseReservesStorage = () => {
  try {
    useReserveStore.getState().clearAllData();
    console.log('🗑️ Cleared all course reserves from memory');
  } catch (error) {
    console.error('Failed to clear course reserves storage:', error);
  }
};
