/**
 * CourseRecordsContainer - Business logic container component
 * 
 * This component handles the business logic and state management for course records,
 * following the Container/Presentational component pattern and SOLID principles.
 * 
 * @description
 * - Separates business logic from presentation (Single Responsibility)
 * - Acts as a container for the CourseRecordsDisplay component
 * - Manages data processing and state logic
 * - Provides a clean interface between parent components and presentation layer
 */

import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useCourseRecords } from '../../hooks/useCourseRecords';
import CourseRecordsDisplay from './CourseRecordsDisplay';

/**
 * CourseRecordsContainer Component
 * 
 * @component
 * @param {Object} props - Component properties
 * @param {Array} props.records - Array of record data objects to display
 * @param {Object} props.availability - Availability information keyed by instance ID
 * @param {Object} props.courseInfo - Information about the associated course
 * @param {Object} props.customization - UI customization settings
 * @param {string} props.collegeParam - College parameter for tracking
 * @param {Object} props.options - Additional configuration options
 * @param {Function} props.onRecordAction - Optional callback for record actions
 * @returns {JSX.Element} The course records container component
 */
const CourseRecordsContainer = ({ 
  records, 
  availability, 
  courseInfo, 
  customization, 
  collegeParam,
  options = {},
  onRecordAction,
}) => {
  // Use the custom hook for records management
  const recordsManager = useCourseRecords(records, {
    enableFiltering: options.enableFiltering,
    filterCriteria: options.filterCriteria,
    groupByInstanceId: options.groupByInstanceId ?? true,
  });

  // Initialize accordion states for print reserves on mount
  useEffect(() => {
    if (recordsManager.recordStats.hasRecords) {
      recordsManager.initializePrintReserveAccordions();
    }
  }, [recordsManager]); // Only run when recordsManager changes

  /**
   * Handle record-specific actions (following Open/Closed Principle)
   * 
   * @param {string} action - The action type
   * @param {Object} record - The record being acted upon
   * @param {Object} additionalData - Any additional data for the action
   */
  const handleRecordAction = (action, record, additionalData = {}) => {
    // Validate record before processing
    if (!recordsManager.isValidRecord(record)) {
      console.error('Invalid record data provided to handleRecordAction:', record);
      return;
    }

    // Call external handler if provided
    if (onRecordAction && typeof onRecordAction === 'function') {
      onRecordAction(action, record, additionalData);
    }

    // Handle internal actions if needed
    switch (action) {
      case 'expand_accordion':
        if (additionalData.instanceId && additionalData.accordionId) {
          recordsManager.openAccordion(additionalData.instanceId, additionalData.accordionId);
        }
        break;
      case 'collapse_accordion':
        if (additionalData.instanceId && additionalData.accordionId) {
          recordsManager.closeAccordion(additionalData.instanceId, additionalData.accordionId);
        }
        break;
      default:
        // No internal action needed
        break;
    }
  };

  // Early return for empty state
  if (recordsManager.recordStats.isEmpty) {
    return (
      <div className="records-container">
        <div className="alert alert-info text-center">
          <h4 className="alert-heading">No Records Found</h4>
          <p className="mb-0">
            There are no course records available at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CourseRecordsDisplay
      records={recordsManager.records}
      recordStats={recordsManager.recordStats}
      availability={availability}
      courseInfo={courseInfo}
      customization={customization}
      collegeParam={collegeParam}
      accordionManager={{
        openAccordions: recordsManager.openAccordions,
        toggleAccordion: recordsManager.toggleAccordion,
        isAccordionOpen: recordsManager.isAccordionOpen,
      }}
      onRecordAction={handleRecordAction}
      options={options}
    />
  );
};

// Comprehensive PropTypes validation
CourseRecordsContainer.propTypes = {
  /**
   * Array of record data objects to display
   */
  records: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      copiedItem: PropTypes.shape({
        instanceId: PropTypes.string,
        title: PropTypes.string,
        contributors: PropTypes.array,
        publication: PropTypes.array,
      }).isRequired,
      isElectronic: PropTypes.bool,
      resource: PropTypes.object,
    })
  ).isRequired,

  /**
   * Availability information keyed by instance ID
   */
  availability: PropTypes.objectOf(
    PropTypes.shape({
      holdings: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          location: PropTypes.string,
          status: PropTypes.string,
          temporaryLoanType: PropTypes.string,
          permanentLoanType: PropTypes.string,
          library: PropTypes.shape({
            name: PropTypes.string,
          }),
        })
      ),
    })
  ).isRequired,

  /**
   * Information about the associated course
   */
  courseInfo: PropTypes.shape({
    name: PropTypes.string,
    courseNumber: PropTypes.string,
    courseListingId: PropTypes.string,
    courseListingObject: PropTypes.shape({
      termObject: PropTypes.shape({
        name: PropTypes.string,
      }),
      instructorObjects: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
        })
      ),
    }),
  }).isRequired,

  /**
   * UI customization settings
   */
  customization: PropTypes.shape({
    recordsCardTitleTextColor: PropTypes.string,
    recordsCardTextColor: PropTypes.string,
    recordsDiscoverLinkText: PropTypes.string,
    recordsDiscoverLinkBgColor: PropTypes.string,
    recordsDiscoverLinkBaseUrl: PropTypes.string,
    accordionHeaderBgColor: PropTypes.string,
    accordionHeaderTextColor: PropTypes.string,
  }).isRequired,

  /**
   * College parameter for tracking
   */
  collegeParam: PropTypes.string.isRequired,

  /**
   * Additional configuration options
   */
  options: PropTypes.shape({
    enableFiltering: PropTypes.bool,
    filterCriteria: PropTypes.func,
    groupByInstanceId: PropTypes.bool,
    showDebugInfo: PropTypes.bool,
  }),

  /**
   * Optional callback for record actions
   */
  onRecordAction: PropTypes.func,
};

// Default props
CourseRecordsContainer.defaultProps = {
  options: {},
  onRecordAction: null,
};

export default CourseRecordsContainer;
