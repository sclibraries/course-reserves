import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Badge } from 'reactstrap';
import InstructorsDisplay from './InstructorsDisplay';

/**
 * Panel component for displaying instructors with a formatted header
 * and optional count badge
 */
const InstructorsPanel = ({ 
  title, 
  instructors, 
  maxDisplay, 
  showCount, 
  className,
  headerClassName,
  bodyClassName 
}) => {
  // Calculate instructor count for badge
  const instructorCount = calculateInstructorCount(instructors);

  return (
    <Card className={className}>
      <CardHeader className={`d-flex justify-content-between align-items-center ${headerClassName}`}>
        <h5 className="mb-0">{title}</h5>
        {showCount && instructorCount > 0 && (
          <Badge color="secondary">{instructorCount}</Badge>
        )}
      </CardHeader>
      <CardBody className={bodyClassName}>
        <InstructorsDisplay 
          instructors={instructors} 
          maxDisplay={maxDisplay} 
        />
      </CardBody>
    </Card>
  );
};

/**
 * Calculate number of instructors from different data formats
 */
const calculateInstructorCount = (instructors) => {
  if (!instructors) return 0;
  
  try {
    // Handle JSON string format
    if (typeof instructors === 'string') {
      try {
        const parsed = JSON.parse(instructors);
        return Array.isArray(parsed) ? parsed.length : 1;
      } catch (e) {
        // If not valid JSON, treat as single instructor name]
        console.debug("Error parsing JSON instructor data:", e);
        return 1;
      }
    }
    
    // Handle array
    if (Array.isArray(instructors)) {
      return instructors.length;
    }
    
    // Handle object (single instructor)
    if (typeof instructors === 'object') {
      return 1;
    }
    
    return 0;
  } catch (e) {
    console.error("Error calculating instructor count:", e);
    return 0;
  }
};

InstructorsPanel.propTypes = {
  /**
   * Panel title displayed in header
   */
  title: PropTypes.string,
  
  /**
   * Instructor data - supports various formats
   */
  instructors: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({
          name: PropTypes.string,
          id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          email: PropTypes.string
        })
      ])
    ),
    PropTypes.shape({
      name: PropTypes.string,
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      email: PropTypes.string
    })
  ]),
  
  /**
   * Maximum instructors to display before showing "+X more"
   */
  maxDisplay: PropTypes.number,
  
  /**
   * Whether to show count badge in header
   */
  showCount: PropTypes.bool,
  
  /**
   * Additional CSS class for the card
   */
  className: PropTypes.string,
  
  /**
   * Additional CSS class for the card header
   */
  headerClassName: PropTypes.string,
  
  /**
   * Additional CSS class for the card body
   */
  bodyClassName: PropTypes.string
};

InstructorsPanel.defaultProps = {
  title: 'Instructors',
  instructors: null,
  maxDisplay: 0,
  showCount: true,
  className: 'shadow-sm mb-3',
  headerClassName: 'bg-light',
  bodyClassName: ''
};

export default InstructorsPanel;