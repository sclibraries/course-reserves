/**
 * CourseRecords component (Refactored)
 * 
 * @component
 * @description This component has been refactored to follow SOLID principles and DRY patterns.
 * It now serves as a wrapper that delegates to the new CourseRecordsContainer for better
 * separation of concerns and maintainability.
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Separated business logic into custom hooks and container
 * - Open/Closed: Extensible through options and callbacks
 * - Liskov Substitution: Maintains the same interface as before
 * - Interface Segregation: Clean, focused prop interfaces
 * - Dependency Inversion: Depends on abstractions (hooks) rather than concrete implementations
 * 
 * DRY Improvements:
 * - Extracted accordion management into reusable useAccordionManager hook
 * - Centralized record processing logic in useCourseRecords hook
 * - Separated presentation logic into CourseRecordsDisplay component
 * 
 * @param {Object} props - Component properties
 * @param {Array} props.records - Array of record data objects to display
 * @param {Object} props.availability - Availability information keyed by instance ID
 * @param {Object} props.courseInfo - Information about the associated course
 * @param {Object} props.customization - UI customization settings
 * @param {string} props.collegeParam - College parameter for tracking
 * @returns {JSX.Element} The course records component
 */

import PropTypes from 'prop-types';
import CourseRecordsContainer from './CourseRecordsContainer';

const CourseRecords = ({ records, availability, courseInfo, customization, collegeParam }) => {
  return (
    <CourseRecordsContainer
      records={records}
      availability={availability}
      courseInfo={courseInfo}
      customization={customization}
      collegeParam={collegeParam}
      options={{
        groupByInstanceId: true,
        showHeader: false, // Maintain existing behavior
      }}
    />
  );
};

// PropTypes validation
CourseRecords.propTypes = {
  records: PropTypes.array.isRequired,
  availability: PropTypes.object.isRequired,
  courseInfo: PropTypes.object.isRequired,
  customization: PropTypes.object.isRequired,
  collegeParam: PropTypes.string.isRequired
};

export default CourseRecords;