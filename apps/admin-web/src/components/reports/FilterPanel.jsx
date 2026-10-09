import React from 'react';
import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Row, Col, Button, Badge, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { useTrackingReportStore } from '../../store/trackingReportStore';

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
 * Now uses Zustand store directly instead of props
 */
const FilterPanel = ({ title, className }) => {
  const [exportDropdownOpen, setExportDropdownOpen] = React.useState(false);
  
  // Get all state from store
  const {
    collegeFilter,
    eventTypeFilter,
    termFilter,
    dateRange,
    searchTerm,
    analyticsData,
    serverPagination,
    trackingEvents,
    setCollegeFilter,
    setEventTypeFilter,
    setTermFilter,
    setDateRange,
    setSearchTerm,
    clearFilters
  } = useTrackingReportStore();
  
  // Calculate total count
  const totalCount = analyticsData.totalCount || serverPagination.totalItems || 0;
  
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
   * Panel title
   */
  title: PropTypes.string,
  
  /**
   * Additional CSS class for the card
   */
  className: PropTypes.string
};

FilterPanel.defaultProps = {
  title: 'Filters'
};

export default FilterPanel;