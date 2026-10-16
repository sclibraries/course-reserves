import type { CourseReserve, ReserveSlice, SubmissionRefetchOptions } from './types';
import { mergeRefetchedSubmission } from './submissionRefetchMerge';
import {
  mapSubmissionDetailItem,
  mapSubmissionIndexItem,
  type BackendSubmission,
} from './submissionMapping';

export const createSubmissionFetchSlice: ReserveSlice<
  'fetchSubmissions' | 'fetchSubmissionDetails'
> = (set, get) => ({
  fetchSubmissions: async (silent = false) => {
    if (!silent) set({ loading: true, error: null });

    try {
      const { getAuthHeaders } = await import('../authStore');
      const { API_ENDPOINTS } = await import('@/config/endpoints');
      const response = await fetch(
        `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_INDEX}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json', ...getAuthHeaders() },
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      console.log('📦 Fetched submissions from backend:', data);
      const backendReserves: CourseReserve[] = (data.items || [])
        .map((item: BackendSubmission) => mapSubmissionIndexItem(item));

      set((state) => {
        const localDrafts = (state.reserves || []).filter((reserve) => reserve.id.startsWith('reserve-'));
        const merged = [...localDrafts, ...backendReserves];
        const hasChanged = JSON.stringify(state.reserves) !== JSON.stringify(merged);
        if (!hasChanged && silent) return state;
        return { reserves: merged, loading: false, error: null };
      });

      if (!silent) console.log('✅ Updated reserves from backend:', { count: backendReserves.length });
    } catch (error) {
      console.error('❌ Failed to fetch submissions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!silent) set({ loading: false, error: errorMessage });
    }
  },

  fetchSubmissionDetails: async (
    submissionId: string,
    silent = false,
    refetchOptions?: SubmissionRefetchOptions
  ) => {
    try {
      if (submissionId.startsWith('reserve-')) {
        return get().reserves.find((item) => item.id === submissionId) || null;
      }

      const { getAuthHeaders } = await import('../authStore');
      const { API_ENDPOINTS } = await import('@/config/endpoints');
      const response = await fetch(
        `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_INDEX}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json', ...getAuthHeaders() },
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json();
      const submission = (data.items || []).find((item: BackendSubmission) => (
        item.submission_uuid === submissionId
      ));
      if (!submission) {
        console.error('Submission not found:', submissionId);
        return null;
      }

      console.log('📦 Fetched submission details:', submission);
      const serverReserve = mapSubmissionDetailItem(submission);
      let mergedReserve = serverReserve;
      let hasRemoteItemsChanged = false;
      set((state) => {
        const existingIndex = state.reserves.findIndex((item) => item.id === submissionId);
        const existingReserve = existingIndex >= 0 ? state.reserves[existingIndex] : undefined;
        const result = mergeRefetchedSubmission(
          existingReserve,
          serverReserve,
          refetchOptions?.previousServerReserve
        );
        mergedReserve = result.reserve;
        hasRemoteItemsChanged = result.hasRemoteItemsChanged;
        if (existingReserve && JSON.stringify(existingReserve) === JSON.stringify(mergedReserve) && silent) {
          return state;
        }
        if (existingIndex >= 0) {
          return { reserves: state.reserves.map((item) => item.id === submissionId ? mergedReserve : item) };
        }
        return { reserves: [...state.reserves, mergedReserve] };
      });
      refetchOptions?.onServerReserveFetched?.(serverReserve);
      refetchOptions?.onRemoteItemsChanged?.(hasRemoteItemsChanged);
      return mergedReserve;
    } catch (error) {
      console.error('❌ Failed to fetch submission details:', error);
      return null;
    }
  },
});
