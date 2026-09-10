import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';

/**
 * Component for filtering by event type
 */
const EventTypeFilter = ({ value, onChange, eventTypes, label }) => {
  // Ensure we have valid event types data
  const validEventTypes = React.useMemo(() => {
    if (!eventTypes || !Array.isArray(eventTypes)) return [];
    return eventTypes.filter(type => type && type.name);
  }, [eventTypes]);

  return (
    <FormGroup>
      <Label for="eventTypeFilter">{label}</Label>
      <Input
        type="select"
        id="eventTypeFilter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All Event Types</option>
        {validEventTypes.map(type => (
          <option key={type.name} value={type.name}>
            {type.name}
          </option>
        ))}
      </Input>
    </FormGroup>
  );
};

EventTypeFilter.propTypes = {
  /**
   * Currently selected event type
   */
  value: PropTypes.string,
  
  /**
   * Callback for when selection changes
   */
  onChange: PropTypes.func.isRequired,
  
  /**
   * Array of available event types
   */
  eventTypes: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    })
  ),
  
  /**
   * Field label
   */
  label: PropTypes.string
};

EventTypeFilter.defaultProps = {
  value: '',
  eventTypes: [],
  label: 'Event Type'
};

export default EventTypeFilter;