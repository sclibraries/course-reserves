import PropTypes from 'prop-types';
import { Row, Col, Alert } from 'reactstrap';
import CollegePieChart from './charts/CollegePieChart';
import EventTypesPieChart from './charts/EventTypesPieChart';
import EventsTimeSeriesChart from './charts/EventsTimeSeriesChart';

/**
 * Overview tab showing analytics summary charts
 */
const OverviewTab = ({ analyticsData, loading, error }) => {
  if (loading) {
    return (
      <div className="text-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading analytics data...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <Alert color="danger">
        <strong>Error loading analytics:</strong> {error}
      </Alert>
    );
  }
  
  // Check if we have any data
  const hasData = analyticsData && (
    (analyticsData.collegeData && analyticsData.collegeData.length) ||
    (analyticsData.eventTypeData && analyticsData.eventTypeData.length) ||
    (analyticsData.timeSeriesData && analyticsData.timeSeriesData.length)
  );
  
  if (!hasData) {
    return (
      <Alert color="info">
        No analytics data available. Try adjusting your filters or date range.
      </Alert>
    );
  }

  return (
    <div>
      <Row>
        <Col lg={6} className="mb-4">
          <CollegePieChart 
            collegeData={analyticsData.collegeData || []} 
          />
        </Col>
        
        <Col lg={6} className="mb-4">
          <EventTypesPieChart 
            eventTypeData={analyticsData.eventTypeData || []} 
          />
        </Col>
      </Row>
      
      <EventsTimeSeriesChart 
        timeSeriesData={analyticsData.timeSeriesData || []}
      />
    </div>
  );
};

OverviewTab.propTypes = {
  /**
   * Analytics data for charts
   */
  analyticsData: PropTypes.shape({
    collegeData: PropTypes.arrayOf(
      PropTypes.shape({
        college: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      })
    ),
    eventTypeData: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      })
    ),
    timeSeriesData: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string,
        count: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      })
    )
  }),
  
  /**
   * Whether data is loading
   */
  loading: PropTypes.bool,
  
  /**
   * Error message if data failed to load
   */
  error: PropTypes.string
};

OverviewTab.defaultProps = {
  analyticsData: {
    collegeData: [],
    eventTypeData: [],
    timeSeriesData: []
  },
  loading: false,
  error: null
};

export default OverviewTab;