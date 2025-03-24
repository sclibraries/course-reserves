// filepath: /Users/roconnell/Projects/course-reserves/src/components/reports/instructors/InstructorsDisplay.jsx
import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';
import InstructorBadge from './InstructorBadge';

const InstructorsDisplay = ({ instructors, maxDisplay }) => {
  // If no instructors data
  if (!instructors) {
    return <span className="text-muted">None</span>;
  }
  
  // Handle different formats of instructor data
  let instructorList = [];
  try {
    if (typeof instructors === 'string') {
      try {
        instructorList = JSON.parse(instructors);
      } catch (jsonError) {
        // Not valid JSON, treat as a single instructor
        instructorList = [instructors];
        console.debug("Error parsing JSON instructor data:", jsonError);
      }
    } else if (Array.isArray(instructors)) {
      instructorList = instructors;
    } else if (typeof instructors === 'object') {
      instructorList = [instructors];
    }
  } catch (e) {
    console.error("Error processing instructor data:", e);
    return <span className="text-muted">Error displaying instructors</span>;
  }
  
  if (!instructorList || !instructorList.length) {
    return <span className="text-muted">None</span>;
  }
  
  // Limit display if maxDisplay is specified
  const displayList = maxDisplay && maxDisplay > 0 && instructorList.length > maxDisplay
    ? instructorList.slice(0, maxDisplay)
    : instructorList;
    
  const hasMore = maxDisplay && maxDisplay > 0 && instructorList.length > maxDisplay;
  
  return (
    <>
      {displayList.map((instructor, index) => (
        <InstructorBadge 
          key={getInstructorKey(instructor, index)} 
          instructor={instructor}
        />
      ))}
      
      {hasMore && (
        <Badge color="secondary" className="ms-1">
          +{instructorList.length - maxDisplay} more
        </Badge>
      )}
    </>
  );
};

// Helper function to generate keys
const getInstructorKey = (instructor, index) => {
  if (typeof instructor === 'string') {
    return `instructor-${instructor}-${index}`;
  }
  
  if (instructor.id) return `instructor-${instructor.id}`;
  if (instructor.email) return `instructor-${instructor.email}`;
  if (instructor.name) return `instructor-${instructor.name}-${index}`;
  
  return `instructor-${index}`;
};

InstructorsDisplay.propTypes = {
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
  maxDisplay: PropTypes.number
};

InstructorsDisplay.defaultProps = {
  instructors: null,
  maxDisplay: 0 // 0 means show all
};

export default InstructorsDisplay;