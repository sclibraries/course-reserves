import PropTypes from 'prop-types';
import { useEffect, useState, useCallback } from 'react';
import { Alert, Spinner } from 'reactstrap';
import { config } from '../config';

// Import the components
import FilterPanel from '../components/reports/FilterPanel';
import OverviewTab from '../components/reports/OverviewTab';
import CoursesTab from '../components/reports/CoursesTab';
import ActionsTab from '../components/reports/ActionsTab';
import RawDataTab from '../components/reports/RawDataTab';

/**
 * TrackingReport component - Analytics dashboard for course reserves usage tracking
 * Can be used as standalone page or embedded in Admin dashboard
 */
const TrackingReport = ({ isEmbedded = false }) => {
  // Base state
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data state
  const [trackingEvents, setTrackingEvents] = useState([]);
  const [analyticsData, setAnalyticsData] = useState({
    collegeData: [],
    eventTypeData: [],
    topCourses: [],
    topActions: [],
    timeSeriesData: [],
    allCourses: [],
    terms: [],
    totalCount: 0
  });
  
  // Filters state
  const [collegeFilter, setCollegeFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [termFilter, setTermFilter] = useState('');

  // Pagination state
  const [serverPagination, setServerPagination] = useState({
    page: 1,
    pageSize: 20,
    totalItems: 0
  });
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

  /**
   * Builds a query string from an object of parameters
   * @param {Object} params - Object containing query parameters
   * @returns {string} Formatted query string
   */
  const buildQueryString = useCallback((params) => {
    return Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  }, []);

  /**
   * Fetches raw tracking data from the API
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: serverPagination.page,
        'per-page': serverPagination.pageSize,
        'sort-by': sortConfig.key,
        'sort-dir': sortConfig.direction
      };
      
      // Add filters if they exist
      if (collegeFilter) params.college = collegeFilter;
      if (eventTypeFilter) params['event-type'] = eventTypeFilter;
      if (termFilter) params.term = termFilter; 
      if (dateRange.start) params['start-date'] = dateRange.start;
      if (dateRange.end) params['end-date'] = dateRange.end;
      if (searchTerm) params.search = searchTerm;
      
      const queryString = buildQueryString(params);
      const url = `${config.api.urls.courseReserves}${config.api.endpoints.admin.reports}?${queryString}`;
      
      // Log API call for debugging
      console.debug('Fetching raw data:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, ${errorText || 'No error details'}`);
      }
      
      // Get total count from headers if available
      const totalCount = response.headers.get('X-Pagination-Total-Count');
      
      const data = await response.json();
      setTrackingEvents(data);
      
      setServerPagination(prev => ({
        ...prev,
        totalItems: totalCount ? parseInt(totalCount, 10) : 0
      }));
    } catch (err) {
      console.error('Error fetching tracking data:', err);
      setError(err.message || 'Failed to fetch tracking data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [
    buildQueryString, 
    collegeFilter, 
    eventTypeFilter, 
    termFilter, 
    dateRange, 
    searchTerm, 
    serverPagination.page, 
    serverPagination.pageSize, 
    sortConfig
  ]);

  /**
   * Fetches analytics data from the API
   */
  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      
      const params = {};
      if (collegeFilter) params.college = collegeFilter;
      if (eventTypeFilter) params['event-type'] = eventTypeFilter;
      if (termFilter) params.term = termFilter;
      if (dateRange.start) params['start-date'] = dateRange.start;
      if (dateRange.end) params['end-date'] = dateRange.end;
      if (searchTerm) params.search = searchTerm;
      
      const queryString = buildQueryString(params);
      const url = `${config.api.urls.courseReserves}${config.api.endpoints.admin.reports}/analytics?${queryString}`;
      
      // Log API call for debugging
      console.debug('Fetching analytics:', url, 'Term filter:', termFilter);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, ${errorText || 'No error details'}`);
      }
      
      const data = await response.json();
      
      // Validate analytics data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid analytics data received from server');
      }
      
      setAnalyticsData({
        collegeData: data.collegeData || [],
        eventTypeData: data.eventTypeData || [],
        topCourses: data.topCourses || [],
        topActions: data.topActions || [],
        timeSeriesData: data.timeSeriesData || [],
        allCourses: data.allCourses || [],
        terms: data.terms || [],
        totalCount: data.totalCount || 0
      });
      
      // Log received data for debugging
      console.debug('Analytics data received:', data);
      
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setAnalyticsError(err.message || 'Failed to fetch analytics data. Please try again later.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [
    buildQueryString, 
    collegeFilter, 
    eventTypeFilter, 
    termFilter, 
    dateRange, 
    searchTerm
  ]);

  // Initial data load
  useEffect(() => {
    fetchData();
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch when pagination or sorting changes for raw data tab
  useEffect(() => {
    if (activeTab === 'rawdata') {
      fetchData();
    }
  }, [fetchData, serverPagination.page, serverPagination.pageSize, sortConfig, activeTab]);

  // Fetch when filters change
  useEffect(() => {
    // Always fetch analytics when filters change
    fetchAnalytics();
    
    // Only fetch raw data if we're on that tab
    if (activeTab === 'rawdata') {
      fetchData();
    }
  }, [fetchData, fetchAnalytics, collegeFilter, eventTypeFilter, termFilter, dateRange, searchTerm, activeTab]);

  /**
   * Clears all filter values
   */
  const clearFilters = useCallback(() => {
    setCollegeFilter('');
    setEventTypeFilter('');
    setTermFilter('');
    setDateRange({ start: '', end: '' });
    setSearchTerm('');
  }, []);

  /**
   * Handles change in rows per page setting
   */
  const handleRowsPerPageChange = useCallback((e) => {
    setServerPagination({
      page: 1, // Reset to first page when changing page size
      pageSize: Number(e.target.value),
      totalItems: serverPagination.totalItems
    });
  }, [serverPagination.totalItems]);

  /**
   * Handles column sorting
   */
  const requestSort = useCallback((key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }, [sortConfig.key, sortConfig.direction]);

  return (
    <div className={isEmbedded ? "" : "p-4"}>
      {!isEmbedded && <h1 className="mb-4">Tracking Analytics Dashboard</h1>}
      
      {isEmbedded && (
        <div className="d-flex justify-content-between align-items-center mb-4 fade-in">
          <h1 className="h3 mb-0">Tracking Analytics</h1>
        </div>
      )}
      
      <FilterPanel 
        collegeFilter={collegeFilter}
        setCollegeFilter={setCollegeFilter}
        eventTypeFilter={eventTypeFilter}
        setEventTypeFilter={setEventTypeFilter}
        termFilter={termFilter}
        setTermFilter={setTermFilter}
        dateRange={dateRange}
        setDateRange={setDateRange}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        analyticsData={analyticsData}
        totalCount={analyticsData.totalCount || serverPagination.totalItems || 0}
        clearFilters={clearFilters}
        className={isEmbedded ? "mb-3" : "mb-4"}
        trackingEvents={trackingEvents}
      />

      {/* Navigation Tabs */}
      <div className={isEmbedded ? "mb-3" : "mb-4"}>
        <ul className="nav nav-tabs modern-tabs">
          {['overview', 'courses', 'actions', 'rawdata'].map(tab => (
            <li className="nav-item" key={tab}>
              <button 
                className={`nav-link ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'rawdata' ? 'Raw Data' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Loading State */}
      {(loading || analyticsLoading) && activeTab !== 'rawdata' && (
        <div className="text-center my-5 fade-in">
          <Spinner color="primary" />
          <p className="mt-2">Loading analytics data...</p>
        </div>
      )}
      
      {/* Error State */}
      {(error || analyticsError) && activeTab !== 'rawdata' && (
        <Alert color="danger" className="fade-in">
          <h4 className="alert-heading">Error Loading Data</h4>
          <p>{error || analyticsError}</p>
          <div className="mt-3">
            <button 
              className="btn btn-outline-danger"
              onClick={() => {
                if (activeTab === 'rawdata') {
                  fetchData();
                } else {
                  fetchAnalytics();
                }
              }}
            >
              Retry
            </button>
          </div>
        </Alert>
      )}

      {/* Tabs Content */}
      {activeTab === 'overview' && !analyticsLoading && !analyticsError && (
        <OverviewTab analyticsData={analyticsData} />
      )}
      
      {activeTab === 'courses' && !analyticsLoading && !analyticsError && (
        <CoursesTab analyticsData={analyticsData} />
      )}
      
      {activeTab === 'actions' && !analyticsLoading && !analyticsError && (
        <ActionsTab analyticsData={analyticsData} />
      )}
      
      {activeTab === 'rawdata' && (
        <RawDataTab 
          trackingEvents={trackingEvents}
          loading={loading}
          error={error}
          serverPagination={serverPagination}
          setServerPagination={setServerPagination}
          sortConfig={sortConfig}
          requestSort={requestSort}
          handleRowsPerPageChange={handleRowsPerPageChange}
          onRetry={fetchData}
        />
      )}
    </div>
  );
};

export default TrackingReport;

TrackingReport.propTypes = {
  isEmbedded: PropTypes.bool
};
TrackingReport.defaultProps = {
  isEmbedded: false
};