import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Input, Alert, Button } from 'reactstrap';
import EventsTable from './tables/EventsTable';
import PaginationControls from './tables/PaginationControls';
import { DEFAULT_PAGE_SIZES } from './constants';
import { exportEventsToCSV, generateTimestampedFilename } from './utils/csvExportUtils';

/**
 * Tab component for displaying raw event data
 */
const RawDataTab = ({ 
  trackingEvents, 
  loading, 
  error, 
  serverPagination, 
  setServerPagination,
  sortConfig,
  requestSort,
  handleRowsPerPageChange,
  onRetry
}) => {  
  // Handle page change
  const handlePageChange = (newPage) => {
    setServerPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Handle CSV export
  const handleExportCSV = () => {
    const filename = generateTimestampedFilename('raw-events-data');
    exportEventsToCSV(trackingEvents || [], filename);
  };

  return (
    <Card className="shadow-sm fade-in">
      <CardHeader className="bg-light d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Event Log Data</h5>
        <div className="d-flex align-items-center gap-2">
          <Button
            color="primary"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || !trackingEvents || trackingEvents.length === 0}
          >
            Export CSV
          </Button>
          <Input
            type="select"
            bsSize="sm"
            value={serverPagination.pageSize}
            onChange={handleRowsPerPageChange}
            style={{width: '100px'}}
            className="form-select"
          >
            {DEFAULT_PAGE_SIZES.map(size => (
              <option key={size} value={size}>{size} rows</option>
            ))}
          </Input>
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="text-center my-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading event data...</p>
          </div>
        ) : error ? (
          <Alert color="danger">
            <strong>Error:</strong> {error}
            {onRetry && (
              <div className="mt-2">
                <Button color="outline-danger" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              </div>
            )}
          </Alert>
        ) : (
          <>
            <EventsTable 
              events={trackingEvents || []} 
              sortConfig={sortConfig}
              onSort={requestSort}
            />
            
            <div className="mt-4">
              <PaginationControls
                page={serverPagination.page}
                pageSize={serverPagination.pageSize}
                totalItems={serverPagination.totalItems}
                onPageChange={handlePageChange}
              />
            </div>

            <div className="mt-4 text-end">
              <Button 
                color="primary" 
                size="sm" 
                onClick={handleExportCSV}
                disabled={loading || error}
              >
                Export to CSV
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};

RawDataTab.propTypes = {
  /**
   * Array of tracking events to display
   */
  trackingEvents: PropTypes.array,
  
  /**
   * Whether data is currently loading
   */
  loading: PropTypes.bool,
  
  /**
   * Error message if data loading failed
   */
  error: PropTypes.string,
  
  /**
   * Server pagination state
   */
  serverPagination: PropTypes.shape({
    page: PropTypes.number.isRequired,
    pageSize: PropTypes.number.isRequired,
    totalItems: PropTypes.number.isRequired
  }).isRequired,
  
  /**
   * Function to update pagination state
   */
  setServerPagination: PropTypes.func.isRequired,
  
  /**
   * Current sort configuration
   */
  sortConfig: PropTypes.shape({
    key: PropTypes.string,
    direction: PropTypes.oneOf(['asc', 'desc'])
  }).isRequired,
  
  /**
   * Function to update sort configuration
   */
  requestSort: PropTypes.func.isRequired,
  
  /**
   * Function to handle rows per page change
   */
  handleRowsPerPageChange: PropTypes.func.isRequired,

  /**
   * Function to retry data loading on error
   */
  onRetry: PropTypes.func
};

RawDataTab.defaultProps = {
  trackingEvents: [],
  loading: false,
  error: null,
  onRetry: null
};

export default RawDataTab;