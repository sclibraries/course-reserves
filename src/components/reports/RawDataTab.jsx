import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Input, Alert } from 'reactstrap';
import EventsTable from './tables/EventsTable';
import PaginationControls from './tables/PaginationControls';

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
  handleRowsPerPageChange
}) => {  
  // Handle page change
  const handlePageChange = (newPage) => {
    setServerPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="bg-light d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Event Log Data</h5>
        <div>
          <Input
            type="select"
            bsSize="sm"
            value={serverPagination.pageSize}
            onChange={handleRowsPerPageChange}
            style={{width: '100px'}}
          >
            <option value="10">10 rows</option>
            <option value="25">25 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
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
          </Alert>
        ) : (
          <>
            <EventsTable 
              events={trackingEvents || []} 
              sortConfig={sortConfig}
              onSort={requestSort}
            />
            
            <PaginationControls
              page={serverPagination.page}
              pageSize={serverPagination.pageSize}
              totalItems={serverPagination.totalItems}
              onPageChange={handlePageChange}
            />
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
  handleRowsPerPageChange: PropTypes.func.isRequired
};

RawDataTab.defaultProps = {
  trackingEvents: [],
  loading: false,
  error: null
};

export default RawDataTab;