/**
 * @file useSubmissionWorkflow.js
 * @description Custom hook for managing submission workflow operations
 */

import { useCallback } from 'react';
import useSubmissionWorkflowStore from '../store/submissionWorkflowStore';

/**
 * Custom hook for submission workflow operations
 * Provides convenient methods for working with submissions
 * 
 * @returns {Object} Submission workflow methods and state
 */
export const useSubmissionWorkflow = () => {
  const {
    submissions,
    selectedSubmission,
    loading,
    error,
    pagination,
    fetchPendingSubmissions,
    fetchSubmissionDetail,
    lockSubmission,
    unlockSubmission,
    setPage,
    clearSelectedSubmission,
    clearError,
    reset
  } = useSubmissionWorkflowStore();

  /**
   * Refresh the current page of submissions
   */
  const refreshSubmissions = useCallback(() => {
    fetchPendingSubmissions(pagination.currentPage, pagination.perPage);
  }, [fetchPendingSubmissions, pagination.currentPage, pagination.perPage]);

  /**
   * Refresh the current submission detail
   */
  const refreshSubmissionDetail = useCallback(() => {
    if (selectedSubmission) {
      fetchSubmissionDetail(selectedSubmission.submission.id);
    }
  }, [fetchSubmissionDetail, selectedSubmission]);

  /**
   * Get submission by ID from current list
   */
  const getSubmissionById = useCallback((submissionId) => {
    return submissions.find(sub => sub.submissionId === submissionId);
  }, [submissions]);

  /**
   * Check if a submission is locked
   */
  const isSubmissionLocked = useCallback((submissionId) => {
    const submission = getSubmissionById(submissionId);
    return submission?.isLocked || false;
  }, [getSubmissionById]);

  /**
   * Get statistics for all submissions
   */
  const getOverallStatistics = useCallback(() => {
    return submissions.reduce((acc, sub) => {
      acc.totalSubmissions += 1;
      acc.totalItems += sub.totalItems;
      acc.pendingItems += sub.pendingItems;
      acc.inProgressItems += sub.inProgressItems;
      acc.completeItems += sub.completeItems;
      acc.unavailableItems += sub.unavailableItems;
      
      if (sub.priority === 'urgent') acc.urgentSubmissions += 1;
      if (sub.priority === 'high') acc.highPrioritySubmissions += 1;
      if (sub.isLocked) acc.lockedSubmissions += 1;
      
      return acc;
    }, {
      totalSubmissions: 0,
      totalItems: 0,
      pendingItems: 0,
      inProgressItems: 0,
      completeItems: 0,
      unavailableItems: 0,
      urgentSubmissions: 0,
      highPrioritySubmissions: 0,
      lockedSubmissions: 0
    });
  }, [submissions]);

  /**
   * Filter submissions by status
   */
  const filterByStatus = useCallback((status) => {
    return submissions.filter(sub => sub.status === status);
  }, [submissions]);

  /**
   * Filter submissions by priority
   */
  const filterByPriority = useCallback((priority) => {
    return submissions.filter(sub => sub.priority === priority);
  }, [submissions]);

  /**
   * Get submissions sorted by days since submission
   */
  const getSortedByAge = useCallback((descending = true) => {
    return [...submissions].sort((a, b) => {
      return descending 
        ? b.daysSinceSubmission - a.daysSinceSubmission
        : a.daysSinceSubmission - b.daysSinceSubmission;
    });
  }, [submissions]);

  return {
    // State
    submissions,
    selectedSubmission,
    loading,
    error,
    pagination,
    
    // Actions
    fetchPendingSubmissions,
    fetchSubmissionDetail,
    lockSubmission,
    unlockSubmission,
    setPage,
    clearSelectedSubmission,
    clearError,
    reset,
    
    // Convenience methods
    refreshSubmissions,
    refreshSubmissionDetail,
    getSubmissionById,
    isSubmissionLocked,
    getOverallStatistics,
    filterByStatus,
    filterByPriority,
    getSortedByAge
  };
};

export default useSubmissionWorkflow;
