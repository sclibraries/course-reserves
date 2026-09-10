import PropTypes from 'prop-types';
import { Table } from 'reactstrap';
import { formatDate } from '../utils/dateUtils';
import MetadataDisplay from '../common/MetadataDisplay';
import InstructorsDisplay from '../instructors/InstructorsDisplay';
import EventTypeBadge from '../common/EventTypeBadge';
import CollegeBadge from '../common/CollegeBadge';

/**
 * Table displaying event tracking data
 */
const EventsTable = ({ 
  events, 
  sortConfig, 
  onSort 
}) => {
  // Handle sorting column click
  const handleColumnSort = (key) => {
    if (onSort) onSort(key);
  };
  
  // Generate sort indicator for a column
  const getSortIndicator = (columnKey) => {
    if (sortConfig && sortConfig.key === columnKey) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  return (
    <div className="table-responsive">
      <Table striped hover bordered>
        <thead>
          <tr>
            <th onClick={() => handleColumnSort('id')} style={{cursor: 'pointer', width: '70px'}}>
              ID{getSortIndicator('id')}
            </th>
            <th onClick={() => handleColumnSort('college')} style={{cursor: 'pointer', width: '100px'}}>
              College{getSortIndicator('college')}
            </th>
            <th onClick={() => handleColumnSort('event_type')} style={{cursor: 'pointer', width: '120px'}}>
              Event Type{getSortIndicator('event_type')}
            </th>
            <th onClick={() => handleColumnSort('course_name')} style={{cursor: 'pointer'}}>
              Course{getSortIndicator('course_name')}
            </th>
            <th style={{width: '150px'}}>Instructor(s)</th>
            <th style={{width: '200px'}}>Metadata</th>
            <th onClick={() => handleColumnSort('created_at')} style={{cursor: 'pointer', width: '150px'}}>
              Timestamp{getSortIndicator('created_at')}
            </th>
          </tr>
        </thead>
        <tbody>
          {events && events.length > 0 ? (
            events.map(event => (
              <tr key={event.id || `event-${Math.random()}`}>
                <td>{event.id}</td>
                <td>
                  <CollegeBadge college={event.college} />
                </td>
                <td>
                  <EventTypeBadge eventType={event.event_type} />
                </td>
                <td>{event.course_name || 'N/A'}</td>
                <td>
                  <InstructorsDisplay instructors={event.instructor} maxDisplay={2} />
                </td>
                <td>
                  <MetadataDisplay 
                    metadata={event.metadata} 
                    eventType={event.event_type}
                  />
                </td>
                <td>{formatDate(event.created_at)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center py-3">
                No events found
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

EventsTable.propTypes = {
  /**
   * Array of event objects
   */
  events: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      college: PropTypes.string,
      event_type: PropTypes.string,
      course_name: PropTypes.string,
      instructor: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.array,
        PropTypes.object
      ]),
      metadata: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.object
      ]),
      created_at: PropTypes.string
    })
  ).isRequired,
  
  /**
   * Current sort configuration
   */
  sortConfig: PropTypes.shape({
    key: PropTypes.string,
    direction: PropTypes.oneOf(['asc', 'desc'])
  }),
  
  /**
   * Callback for column sorting
   */
  onSort: PropTypes.func
};

export default EventsTable;