/**
 * @file submissionWorkflowStore.js
 * @description Zustand store for managing submission workflow state
 */

import { create } from 'zustand';
import { submissionWorkflowService } from '../services/admin/submissionWorkflowService';

const useSubmissionWorkflowStore = create((set, get) => ({
  // State
  submissions: [],
  selectedSubmission: null,
  claimedItems: null,
  loading: false,
  error: null,
  pagination: {
    currentPage: 1,
    perPage: 20,
    totalCount: 0,
    pageCount: 1
  },

  // Actions
  /**
   * Fetch pending submissions with pagination
   */
  fetchPendingSubmissions: async (page = 1, perPage = 20) => {
    set({ loading: true, error: null });
    try {
      const response = await submissionWorkflowService.getPendingSubmissions(page, perPage);
      
      // Format all submissions for display
      const formattedSubmissions = response.items.map(
        submission => submissionWorkflowService.formatSubmissionForDisplay(submission)
      );

      set({
        submissions: formattedSubmissions,
        pagination: {
          currentPage: response._meta.currentPage,
          perPage: response._meta.perPage,
          totalCount: response._meta.totalCount,
          pageCount: response._meta.pageCount
        },
        loading: false
      });
    } catch (error) {
      set({ 
        error: error.message || 'Failed to fetch submissions',
        loading: false 
      });
    }
  },

  /**
   * Fetch detailed information for a specific submission
   */
  fetchSubmissionDetail: async (submissionId) => {
    set({ loading: true, error: null });
    try {
      const response = await submissionWorkflowService.getSubmissionDetail(submissionId);
      const formattedDetail = submissionWorkflowService.formatSubmissionDetail(response);
      
      set({
        selectedSubmission: formattedDetail,
        loading: false
      });
    } catch (error) {
      set({ 
        error: error.message || 'Failed to fetch submission detail',
        loading: false 
      });
    }
  },

  /**
   * Fetch items claimed by the current user (based on auth token)
   */
  fetchClaimedItems: async () => {
    set({ loading: true, error: null });
    try {
      // Use backend endpoint that determines user from auth token
      const items = await submissionWorkflowService.getMyClaimedItems();
      
      set({
        claimedItems: items,
        loading: false
      });
    } catch (error) {
      set({ 
        error: error.message || 'Failed to fetch claimed items',
        loading: false 
      });
    }
  },

  /**
   * Lock a submission for processing
   */
  lockSubmission: async (submissionUuid, lockReason) => {
    try {
      await submissionWorkflowService.lockSubmission(submissionUuid, lockReason);
      
      // Refresh the current submission detail if it's loaded
      const { selectedSubmission } = get();
      if (selectedSubmission?.submission.uuid === submissionUuid) {
        await get().fetchSubmissionDetail(selectedSubmission.submission.id);
      }
      
      return { success: true };
    } catch (error) {
      set({ error: error.message || 'Failed to lock submission' });
      return { success: false, error: error.message };
    }
  },

  /**
   * Unlock a submission
   */
  unlockSubmission: async (submissionUuid) => {
    try {
      await submissionWorkflowService.unlockSubmission(submissionUuid);
      
      // Refresh the current submission detail if it's loaded
      const { selectedSubmission } = get();
      if (selectedSubmission?.submission.uuid === submissionUuid) {
        await get().fetchSubmissionDetail(selectedSubmission.submission.id);
      }
      
      return { success: true };
    } catch (error) {
      set({ error: error.message || 'Failed to unlock submission' });
      return { success: false, error: error.message };
    }
  },

  /**
   * Update an individual item's status and notes
   * @param {number} itemId - Item ID
   * @param {Object} updates - Fields to update (item_status, staff_notes, priority, faculty_notes)
   * @returns {Promise<Object>} Result with success flag
   */
  updateItem: async (itemId, updates) => {
    try {
      const result = await submissionWorkflowService.updateItem(itemId, updates);
      
      // Refresh the current submission detail to reflect changes
      const { selectedSubmission } = get();
      if (selectedSubmission) {
        await get().fetchSubmissionDetail(selectedSubmission.submission.id);
      }
      
      return { success: true, item: result.item };
    } catch (error) {
      set({ error: error.message || 'Failed to update item' });
      return { success: false, error: error.message };
    }
  },

  /**
   * Claim an item for processing
   * @param {number} itemId - Item ID
   * @returns {Promise<Object>} Result with success flag
   */
  claimItem: async (itemId) => {
    try {
      const result = await submissionWorkflowService.claimItem(itemId);
      
      // Refresh the current submission detail
      const { selectedSubmission } = get();
      if (selectedSubmission) {
        await get().fetchSubmissionDetail(selectedSubmission.submission.id);
      }
      
      return { success: true, item: result.item };
    } catch (error) {
      set({ error: error.message || 'Failed to claim item' });
      return { success: false, error: error.message };
    }
  },

  /**
   * Unclaim an item
   * @param {number} itemId - Item ID
   * @returns {Promise<Object>} Result with success flag
   */
  unclaimItem: async (itemId) => {
    try {
      const result = await submissionWorkflowService.unclaimItem(itemId);
      
      // Refresh the current submission detail
      const { selectedSubmission } = get();
      if (selectedSubmission) {
        await get().fetchSubmissionDetail(selectedSubmission.submission.id);
      }
      
      return { success: true, item: result.item };
    } catch (error) {
      set({ error: error.message || 'Failed to unclaim item' });
      return { success: false, error: error.message };
    }
  },

  /**
   * Assign item to another staff member
   * @param {number} itemId - Item ID
   * @param {number} userId - User ID to assign to
   * @param {string} reason - Optional reason
   * @returns {Promise<Object>} Result with success flag
   */
  assignItem: async (itemId, userId, reason = '') => {
    try {
      const result = await submissionWorkflowService.assignItem(itemId, userId, reason);
      
      // Refresh the current submission detail
      const { selectedSubmission } = get();
      if (selectedSubmission) {
        await get().fetchSubmissionDetail(selectedSubmission.submission.id);
      }
      
      return { success: true, item: result.item };
    } catch (error) {
      set({ error: error.message || 'Failed to assign item' });
      return { success: false, error: error.message };
    }
  },

  /**
   * Quick status update
   * @param {number} itemId - Item ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Result with success flag
   */
  updateItemStatus: async (itemId, status) => {
    try {
      const result = await submissionWorkflowService.updateItemStatus(itemId, status);
      
      // Refresh the current submission detail
      const { selectedSubmission } = get();
      if (selectedSubmission) {
        await get().fetchSubmissionDetail(selectedSubmission.submission.id);
      }
      
      return { success: true, item: result.item };
    } catch (error) {
      set({ error: error.message || 'Failed to update status' });
      return { success: false, error: error.message };
    }
  },

  /**
   * Change page in pagination
   */
  setPage: async (page) => {
    const { pagination } = get();
    await get().fetchPendingSubmissions(page, pagination.perPage);
  },

  /**
   * Clear selected submission
   */
  clearSelectedSubmission: () => {
    set({ selectedSubmission: null });
  },

  /**
   * Clear error
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Reset store to initial state
   */
  reset: () => {
    set({
      submissions: [],
      selectedSubmission: null,
      loading: false,
      error: null,
      pagination: {
        currentPage: 1,
        perPage: 20,
        totalCount: 0,
        pageCount: 1
      }
    });
  }
}));

export default useSubmissionWorkflowStore;
