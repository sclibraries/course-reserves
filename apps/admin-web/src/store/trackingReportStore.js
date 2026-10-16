import { create } from 'zustand';
import { config } from '../config';
import { authFetch } from '../services/http/authFetch';

/**
 * Zustand store for Tracking Report state management
 * Centralizes all filter states, analytics data, and data fetching logic
 */
export const useTrackingReportStore = create((set, get) => ({
  // Loading states
  loading: false,
  analyticsLoading: false,
  error: null,
  analyticsError: null,

  // Data state
  trackingEvents: [],
  analyticsData: {
    collegeData: [],
    eventTypeData: [],
    topCourses: [],
    topActions: [],
    timeSeriesData: [],
    allCourses: [],
    terms: [],
    totalCount: 0
  },

  // Filter states
  collegeFilter: '',
  eventTypeFilter: '',
  termFilter: '',
  dateRange: { start: '', end: '' },
  searchTerm: '',

  // Pagination state
  serverPagination: {
    page: 1,
    pageSize: 20,
    totalItems: 0
  },

  // Sorting state
  sortConfig: { key: 'id', direction: 'desc' },

  // Active tab state
  activeTab: 'overview',

  // Setters for individual states
  setLoading: (loading) => set({ loading }),
  setAnalyticsLoading: (analyticsLoading) => set({ analyticsLoading }),
  setError: (error) => set({ error }),
  setAnalyticsError: (analyticsError) => set({ analyticsError }),
  setTrackingEvents: (trackingEvents) => set({ trackingEvents }),
  setAnalyticsData: (analyticsData) => set({ analyticsData }),
  setActiveTab: (activeTab) => set({ activeTab }),

  // Filter setters
  setCollegeFilter: (collegeFilter) => set({ collegeFilter }),
  setEventTypeFilter: (eventTypeFilter) => set({ eventTypeFilter }),
  setTermFilter: (termFilter) => set({ termFilter }),
  setDateRange: (dateRange) => set({ dateRange }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),

  // Pagination setters
  setServerPagination: (serverPagination) => set({ serverPagination }),
  setSortConfig: (sortConfig) => set({ sortConfig }),

  /**
   * Clear all filter values
   */
  clearFilters: () => {
    set({
      collegeFilter: '',
      eventTypeFilter: '',
      termFilter: '',
      dateRange: { start: '', end: '' },
      searchTerm: ''
    });
  },

  /**
   * Clear all state (useful when unmounting component)
   */
  clearAllState: () => {
    set({
      loading: false,
      analyticsLoading: false,
      error: null,
      analyticsError: null,
      trackingEvents: [],
      analyticsData: {
        collegeData: [],
        eventTypeData: [],
        topCourses: [],
        topActions: [],
        timeSeriesData: [],
        allCourses: [],
        terms: [],
        totalCount: 0
      },
      collegeFilter: '',
      eventTypeFilter: '',
      termFilter: '',
      dateRange: { start: '', end: '' },
      searchTerm: '',
      serverPagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0
      },
      sortConfig: { key: 'id', direction: 'desc' },
      activeTab: 'overview'
    });
  },

  /**
   * Builds a query string from an object of parameters
   * @param {Object} params - Object containing query parameters
   * @returns {string} Formatted query string
   */
  buildQueryString: (params) => {
    return Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  },

  /**
   * Fetches raw tracking data from the API
   */
  fetchData: async () => {
    const state = get();
    
    try {
      set({ loading: true, error: null });
      
      const params = {
        page: state.serverPagination.page,
        'per-page': state.serverPagination.pageSize,
        'sort-by': state.sortConfig.key,
        'sort-dir': state.sortConfig.direction
      };
      
      // Add filters if they exist
      if (state.collegeFilter) params.college = state.collegeFilter;
      if (state.eventTypeFilter) params['event-type'] = state.eventTypeFilter;
      if (state.termFilter) params.term = state.termFilter;
      if (state.dateRange.start) params['start-date'] = state.dateRange.start;
      if (state.dateRange.end) params['end-date'] = state.dateRange.end;
      if (state.searchTerm) params.search = state.searchTerm;
      
      const queryString = state.buildQueryString(params);
      const url = `${config.api.urls.courseReserves}${config.api.endpoints.admin.reports}?${queryString}`;
      
      const response = await authFetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, ${errorText || 'No error details'}`);
      }
      
      // Get total count from headers if available
      const totalCount = response.headers.get('X-Pagination-Total-Count');
      
      const data = await response.json();
      set({ 
        trackingEvents: data,
        serverPagination: {
          ...state.serverPagination,
          totalItems: totalCount ? parseInt(totalCount, 10) : 0
        }
      });
    } catch (err) {
      console.error('Error fetching tracking data:', err);
      set({ error: err.message || 'Failed to fetch tracking data. Please try again later.' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Fetches analytics data from the API
   */
  fetchAnalytics: async () => {
    const state = get();
    
    try {
      set({ analyticsLoading: true, analyticsError: null });
      
      const params = {};
      if (state.collegeFilter) params.college = state.collegeFilter;
      if (state.eventTypeFilter) params['event-type'] = state.eventTypeFilter;
      if (state.termFilter) params.term = state.termFilter;
      if (state.dateRange.start) params['start-date'] = state.dateRange.start;
      if (state.dateRange.end) params['end-date'] = state.dateRange.end;
      if (state.searchTerm) params.search = state.searchTerm;
      
      const queryString = state.buildQueryString(params);
      const url = `${config.api.urls.courseReserves}${config.api.endpoints.admin.reports}/analytics?${queryString}`;
      
      const response = await authFetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, ${errorText || 'No error details'}`);
      }
      
      const data = await response.json();
      
      // Validate analytics data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid analytics data received from server');
      }
      
      set({
        analyticsData: {
          collegeData: data.collegeData || [],
          eventTypeData: data.eventTypeData || [],
          topCourses: data.topCourses || [],
          topActions: data.topActions || [],
          timeSeriesData: data.timeSeriesData || [],
          allCourses: data.allCourses || [],
          terms: data.terms || [],
          totalCount: data.totalCount || 0
        }
      });
      
      // Log received data for debugging
      console.debug('Analytics data received:', data);
      
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      set({ analyticsError: err.message || 'Failed to fetch analytics data. Please try again later.' });
      throw err;
    } finally {
      set({ analyticsLoading: false });
    }
  },

  /**
   * Handles change in rows per page setting
   */
  handleRowsPerPageChange: (e) => {
    const state = get();
    set({
      serverPagination: {
        page: 1, // Reset to first page when changing page size
        pageSize: Number(e.target.value),
        totalItems: state.serverPagination.totalItems
      }
    });
  },

  /**
   * Handles column sorting
   */
  requestSort: (key) => {
    const state = get();
    let direction = 'asc';
    if (state.sortConfig.key === key && state.sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    set({ sortConfig: { key, direction } });
  }
}));
