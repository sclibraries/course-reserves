import type { ReserveSlice } from './types';

export const createPollingSlice: ReserveSlice<'startPolling' | 'stopPolling' | 'clearAllData'> = (set, get, store) => ({
  startPolling: (intervalMs = 30000) => { // Default 30 seconds
    // Clear existing interval if any
    const currentInterval = get().pollingInterval;
    if (currentInterval) {
      clearInterval(currentInterval);
    }

    console.log('🔄 Starting auto-refresh polling (every', intervalMs / 1000, 'seconds)');

    // Set up new polling interval
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing submissions...');
      get().fetchSubmissions(true); // Silent fetch
    }, intervalMs);

    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const interval = get().pollingInterval;
    if (interval) {
      console.log('⏸️ Stopping auto-refresh polling');
      clearInterval(interval);
      set({ pollingInterval: null });
    }
  },

  clearAllData: () => {
    // Stop polling if active
    const interval = get().pollingInterval;
    if (interval) {
      clearInterval(interval);
    }

    console.log('🗑️ Clearing all course reserves data on logout');

    // Clear everything on logout
    set({
      reserves: [],
      loading: false,
      error: null,
      pollingInterval: null,
      _initialized: true
    });
  }
});
