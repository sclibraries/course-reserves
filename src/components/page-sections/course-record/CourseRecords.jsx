import { useState } from 'react';
import PropTypes from 'prop-types';
import RecordCard from './RecordCard';
import { groupRecordsByInstanceId } from '../../../utils/recordUtils';

/**
 * CourseRecords component
 * 
 * @component
 * @description Renders a list of course record items, grouped by instance ID to avoid duplicates.
 * Each record is displayed using the RecordCard component, with accordion functionality for availability details.
 * 
 * @param {Object} props - Component properties
 * @param {Array} props.records - Array of record data objects to display
 * @param {Object} props.availability - Availability information keyed by instance ID
 * @param {Object} props.courseInfo - Information about the associated course
 * @param {Object} props.customization - UI customization settings
 * @param {string} props.collegeParam - College parameter for tracking
 * @returns {JSX.Element} The course records component
 */
const CourseRecords = ({ records, availability, courseInfo, customization, collegeParam }) => {
  const [openAccordions, setOpenAccordions] = useState({});

  // Group records by instanceId to avoid duplicates
  const groupedRecords = groupRecordsByInstanceId(records);

  const toggleAccordion = (instanceId, accordionId) => {
    setOpenAccordions({
      ...openAccordions,
      [instanceId]: openAccordions[instanceId] === accordionId ? null : accordionId
    });
  };

  return (
    <div className="records-container">
      {groupedRecords.map((record) => (
        <RecordCard
          key={record.id}
          recordItem={record}
          availability={availability}
          openAccordions={openAccordions}
          toggleAccordion={toggleAccordion}
          customization={customization}
          courseInfo={courseInfo}
          collegeParam={collegeParam}
        />
      ))}
    </div>
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