import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { CourseReservesState } from './reserve/types';
import { createFoldersSlice } from './reserve/foldersSlice';
import { createItemsSlice } from './reserve/itemsSlice';
import { createPollingSlice } from './reserve/pollingSlice';
import { createReservesSlice } from './reserve/reservesSlice';
import { createSubmissionFetchSlice } from './reserve/submissionFetchSlice';
import { createSubmissionLifecycleSlice } from './reserve/submissionLifecycleSlice';

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
        partialize: (state) => ({
          reserves: state.reserves,
          _initialized: state._initialized,
        }),
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
