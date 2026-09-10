import PropTypes from 'prop-types';
import { Badge, UncontrolledTooltip } from 'reactstrap';

const InstructorBadge = ({ instructor }) => {
  const instructorInfo = getInstructorInfo(instructor);
  const badgeId = `instructor-${instructorInfo.key}`;
  
  return (
    <>
      <Badge 
        id={badgeId}
        color="light" 
        className="me-1 mb-1 text-dark"
      >
        {instructorInfo.name}
      </Badge>
      
      {(instructorInfo.email || instructorInfo.title) && (
        <UncontrolledTooltip target={badgeId} placement="top">
          <div className="text-start">
            <strong>{instructorInfo.name}</strong>
            {instructorInfo.title && <div>{instructorInfo.title}</div>}
            {instructorInfo.email && <div>{instructorInfo.email}</div>}
          </div>
        </UncontrolledTooltip>
      )}
    </>
  );
};

const getInstructorInfo = (instructor) => {
  if (typeof instructor === 'string') {
    return {
      name: instructor,
      email: null,
      title: null,
      key: instructor.replace(/\s+/g, '-').toLowerCase()
    };
  }
  
  // Extract from object
  const info = {
    name: instructor.name || instructor.fullName || 'Unknown',
    email: instructor.email || null,
    title: instructor.title || instructor.position || null,
    key: instructor.id || instructor.email || 
         (instructor.name && instructor.name.replace(/\s+/g, '-').toLowerCase())
  };
  
  // Add random suffix if key might not be unique
  if (!info.key || info.key === 'unknown') {
    info.key = `unknown-${Math.random().toString(36).substring(2, 10)}`;
  }
  
  return info;
};

InstructorBadge.propTypes = {
  instructor: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      name: PropTypes.string,
      fullName: PropTypes.string,
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      email: PropTypes.string,
      title: PropTypes.string,
      position: PropTypes.string
    })
  ]).isRequired
};

export default InstructorBadge;