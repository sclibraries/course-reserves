/**
 * @file useUnreadMessages.js
 * @description Custom hook for polling unread message counts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { submissionWorkflowService } from '../services/admin/submissionWorkflowService';

/**
 * Poll for unread message count
 * @param {number} pollInterval - Interval in milliseconds (default: 30000 = 30 seconds)
 * @param {boolean} enabled - Whether to enable polling (default: true)
 * @returns {Object} { unreadCount, loading, error, refresh }
 */
export const useUnreadMessages = (pollInterval = 30000, enabled = true) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      const response = await submissionWorkflowService.getUnreadCount();
      setUnreadCount(response.unread_count || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching unread count:', err);
      setError(err.message || 'Failed to fetch unread count');
      // Don't reset count on error, keep showing last known value
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!enabled) {
      // Clear interval and reset state if disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setUnreadCount(0);
      return;
    }

    // Fetch immediately on mount
    fetchUnreadCount();

    // Then poll at specified interval
    intervalRef.current = setInterval(fetchUnreadCount, pollInterval);

    // Cleanup on unmount or when interval changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchUnreadCount, pollInterval, enabled]);

  return { 
    unreadCount, 
    loading, 
    error, 
    refresh 
  };
};

export default useUnreadMessages;
