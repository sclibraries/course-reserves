import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';
import { getEventBadgeColor, formatEventType } from '../utils/eventUtils';

/**
 * Display an event type with appropriate formatting and coloring
 */
const EventTypeBadge = ({ eventType, showLabel = true }) => {
  if (!eventType) return null;
  
  const badgeColor = getEventBadgeColor(eventType);
  const formattedType = showLabel ? formatEventType(eventType) : eventType;
  
  return (
    <Badge 
      color={badgeColor} 
      className="text-white"
      title={formatEventType(eventType)}
    >
      {formattedType}
    </Badge>
  );
};

EventTypeBadge.propTypes = {
  /**
   * Event type string (e.g., "course_access")
   */
  eventType: PropTypes.string,
  
  /**
   * Whether to show formatted label (Title Case) or raw value
   */
  showLabel: PropTypes.bool
};

export default EventTypeBadge;