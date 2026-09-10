import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { Alert, Spinner } from 'reactstrap';
import { useTrackingReportStore } from '../store/trackingReportStore';

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
  // Get all state and actions from the store
  const {
    loading,
    analyticsLoading,
    error,
    analyticsError,
    activeTab,
    trackingEvents,
    analyticsData,
    serverPagination,
    sortConfig,
    collegeFilter,
    eventTypeFilter,
    termFilter,
    dateRange,
    searchTerm,
    fetchData,
    fetchAnalytics,
    setActiveTab,
    setServerPagination,
    requestSort,
    handleRowsPerPageChange,
    clearAllState
  } = useTrackingReportStore();

  // Initial data load
  useEffect(() => {
    fetchData();
    fetchAnalytics();
    
    // Cleanup on unmount
    return () => {
      clearAllState();
    };
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
  }, [fetchAnalytics, fetchData, collegeFilter, eventTypeFilter, termFilter, dateRange, searchTerm, activeTab]);

  return (
    <div className={isEmbedded ? "" : "p-4"}>
      {!isEmbedded && <h1 className="mb-4">Tracking Analytics Dashboard</h1>}
      
      {isEmbedded && (
        <div className="d-flex justify-content-between align-items-center mb-4 fade-in">
          <h1 className="h3 mb-0">Tracking Analytics</h1>
        </div>
      )}
      
      <FilterPanel className={isEmbedded ? "mb-3" : "mb-4"} />

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