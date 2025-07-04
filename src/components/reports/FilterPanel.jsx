import React from 'react';
import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Row, Col, Button, Badge, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

// Import individual filter components
import CollegeFilter from './filters/CollegeFilter';
import EventTypeFilter from './filters/EventTypeFilter';
import TermFilter from './filters/TermFilter';
import DateRangeFilter from './filters/DateRangeFilter';
import SearchFilter from './filters/SearchFilter';

// Import export utilities
import { 
  exportAnalyticsToCSV, 
  exportCoursesToCSV, 
  exportEventsToCSV
} from './utils/csvExportUtils';

/**
 * Complete filter panel with all report filter options
 */
const FilterPanel = ({
  collegeFilter,
  setCollegeFilter, 
  eventTypeFilter,
  setEventTypeFilter,
  termFilter,
  setTermFilter,
  dateRange,
  setDateRange,
  searchTerm,
  setSearchTerm,
  analyticsData,
  totalCount,
  clearFilters,
  title,
  className,
  trackingEvents
}) => {
  const [exportDropdownOpen, setExportDropdownOpen] = React.useState(false);
  
  // Check if any filters are active
  const hasActiveFilters = Boolean(
    collegeFilter || 
    eventTypeFilter || 
    termFilter || 
    dateRange?.start || 
    dateRange?.end || 
    searchTerm
  );

  // Extract colleges from analytics data if needed
  const colleges = React.useMemo(() => {
    if (!analyticsData?.collegeData || !Array.isArray(analyticsData.collegeData)) {
      return [];
    }
    
    return [...new Set(
      analyticsData.collegeData
        .filter(item => item && item.college)
        .map(item => item.college)
    )];
  }, [analyticsData?.collegeData]);

  /**
   * Handle CSV export for different data types
   */
  const handleExport = (type) => {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    switch (type) {
      case 'analytics':
        exportAnalyticsToCSV(analyticsData, `analytics-report-${timestamp}.csv`);
        break;
      case 'courses':
        exportCoursesToCSV(analyticsData?.allCourses || [], `courses-report-${timestamp}.csv`);
        break;
      case 'events':
        if (trackingEvents && trackingEvents.length > 0) {
          exportEventsToCSV(trackingEvents, `events-report-${timestamp}.csv`);
        } else {
          alert('No event data available for export');
        }
        break;
      default:
        console.warn('Unknown export type:', type);
    }
  };

  return (
    <Card className={`${className || 'mb-4 shadow-sm'}`}>
      <CardHeader className="bg-light">
        <h5 className="mb-0">{title || 'Filters'}</h5>
      </CardHeader>
      <CardBody>
        <Row>
          <Col md={2}>
            <CollegeFilter
              value={collegeFilter}
              onChange={setCollegeFilter}
              colleges={colleges}
              useSelect={colleges.length > 0}
            />
          </Col>
          <Col md={2}>
            <EventTypeFilter
              value={eventTypeFilter}
              onChange={setEventTypeFilter}
              eventTypes={analyticsData?.eventTypeData || []}
            />
          </Col>
          <Col md={2}>
            <TermFilter
              value={termFilter}
              onChange={setTermFilter}
              terms={analyticsData?.terms || []}
            />
          </Col>
          <Col md={4}>
            <DateRangeFilter
              startDate={dateRange?.start || ''}
              endDate={dateRange?.end || ''}
              onStartDateChange={(value) => setDateRange(prev => ({ ...prev, start: value }))}
              onEndDateChange={(value) => setDateRange(prev => ({ ...prev, end: value }))}
            />
          </Col>
          <Col md={2}>
            <SearchFilter
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </Col>
        </Row>
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div>
            <Badge color="info" className="me-2">
              {totalCount || 0} events
            </Badge>
            {hasActiveFilters && (
              <Button 
                color="link" 
                size="sm" 
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div>
            <Dropdown isOpen={exportDropdownOpen} toggle={() => setExportDropdownOpen(prev => !prev)}>
              <DropdownToggle caret color="primary" size="sm">
                Export Data
              </DropdownToggle>
              <DropdownMenu>
                <DropdownItem 
                  onClick={() => handleExport('events')}
                >
                  Export Events CSV
                </DropdownItem>
                <DropdownItem 
                  onClick={() => handleExport('analytics')}
                >
                  Export Analytics CSV
                </DropdownItem>
                <DropdownItem 
                  onClick={() => handleExport('courses')}
                >
                  Export Courses CSV
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

FilterPanel.propTypes = {
  /**
   * Current college filter value
   */
  collegeFilter: PropTypes.string,
  
  /**
   * Callback to update college filter
   */
  setCollegeFilter: PropTypes.func.isRequired,
  
  /**
   * Current event type filter value
   */
  eventTypeFilter: PropTypes.string,
  
  /**
   * Callback to update event type filter
   */
  setEventTypeFilter: PropTypes.func.isRequired,
  
  /**
   * Current term filter value
   */
  termFilter: PropTypes.string,
  
  /**
   * Callback to update term filter
   */
  setTermFilter: PropTypes.func.isRequired,
  
  /**
   * Current date range filter object with start and end dates
   */
  dateRange: PropTypes.shape({
    start: PropTypes.string,
    end: PropTypes.string
  }),
  
  /**
   * Callback to update date range filter
   */
  setDateRange: PropTypes.func.isRequired,
  
  /**
   * Current search term
   */
  searchTerm: PropTypes.string,
  
  /**
   * Callback to update search term
   */
  setSearchTerm: PropTypes.func.isRequired,
  
  /**
   * Analytics data containing options for filters
   */
  analyticsData: PropTypes.shape({
    collegeData: PropTypes.arrayOf(PropTypes.shape({
      college: PropTypes.string
    })),
    eventTypeData: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    })),
    terms: PropTypes.arrayOf(PropTypes.string),
    allCourses: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      count: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      college: PropTypes.string,
      term: PropTypes.string
    }))
  }),
  
  /**
   * Total count of events
   */
  totalCount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  
  /**
   * Callback to clear all filters
   */
  clearFilters: PropTypes.func.isRequired,
  
  /**
   * Panel title
   */
  title: PropTypes.string,
  
  /**
   * Additional CSS class for the card
   */
  className: PropTypes.string,
  
  /**
   * Array of tracking events for export
   */
  trackingEvents: PropTypes.arrayOf(PropTypes.object)
};

FilterPanel.defaultProps = {
  collegeFilter: '',
  eventTypeFilter: '',
  termFilter: '',
  dateRange: { start: '', end: '' },
  searchTerm: '',
  analyticsData: {
    collegeData: [],
    eventTypeData: [],
    terms: []
  },
  totalCount: 0,
  title: 'Filters'
};

export default FilterPanel;