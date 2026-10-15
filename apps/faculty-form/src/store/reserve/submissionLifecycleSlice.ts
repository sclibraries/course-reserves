import type { ReserveSlice } from './types';
import { useDraftStore } from '../draftStore';

export const createSubmissionLifecycleSlice: ReserveSlice<'deleteSubmission' | 'applyLockState'> = (set, get, store) => ({
  deleteSubmission: async (submissionId: string) => {
    try {
      // Import dynamically to avoid circular dependencies
      const { getAuthHeaders } = await import('../authStore');
      const { API_ENDPOINTS } = await import('@/config/endpoints');

      const response = await fetch(
        `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_INDEX}/${submissionId}`,
        {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Submission deleted successfully:', result);

      // Remove from local store
      set((state) => ({
        reserves: state.reserves.filter(r => r.id !== submissionId)
      }));

      return true;
    } catch (error) {
      console.error('❌ Failed to delete submission:', error);
      throw error;
    }
  },

  applyLockState: (submissionId, lockData) => {
    useDraftStore.getState().deleteDraft(submissionId);
    set((state) => ({
      reserves: state.reserves.map((r) =>
        r.id === submissionId
          ? {
              ...r,
              isLocked: true,
              canEdit: false,
              lockedBy: lockData.locked_by ?? r.lockedBy ?? null,
              lockedAt: lockData.locked_at ?? r.lockedAt ?? null,
              lockReason: lockData.lock_reason ?? r.lockReason ?? null,
            }
          : r
      ),
    }));
  }
});
