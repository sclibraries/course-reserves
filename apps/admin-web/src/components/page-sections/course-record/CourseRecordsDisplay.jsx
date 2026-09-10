/**
 * CourseRecordsDisplay - Presentation component for course records
 * 
 * This component handles the pure presentation logic for course records,
 * following the Container/Presentational pattern and SOLID principles.
 * 
 * @description
 * - Pure presentational component (no business logic)
 * - Receives all data and handlers as props
 * - Focuses solely on rendering the UI
 * - Highly reusable and testable
 */

import PropTypes from 'prop-types';
import RecordCard from './RecordCard';
import RecordStats from './RecordStats';

/**
 * CourseRecordsDisplay Component
 * 
 * @component
 * @param {Object} props - Component properties
 * @param {Array} props.records - Processed array of record data objects
 * @param {Object} props.recordStats - Statistics about the records
 * @param {Object} props.availability - Availability information keyed by instance ID
 * @param {Object} props.courseInfo - Information about the associated course
 * @param {Object} props.customization - UI customization settings
 * @param {string} props.collegeParam - College parameter for tracking
 * @param {Object} props.accordionManager - Accordion management utilities
 * @param {Function} props.onRecordAction - Callback for record actions
 * @param {Object} props.options - Display options
 * @returns {JSX.Element} The course records display component
 */
const CourseRecordsDisplay = ({ 
  records, 
  recordStats,
  availability, 
  courseInfo, 
  customization, 
  collegeParam,
  accordionManager,
  onRecordAction,
  options = {},
}) => {
  const {
    showStats = false,
    showHeader = true,
    className = 'records-container',
  } = options;

  /**
   * Handle record card actions
   * 
   * @param {string} action - The action type
   * @param {Object} record - The record being acted upon
   * @param {Object} additionalData - Any additional data
   */
  const handleCardAction = (action, record, additionalData = {}) => {
    if (onRecordAction) {
      onRecordAction(action, record, additionalData);
    }
  };

  return (
    <div className={className}>
      {/* Optional header section */}
      {showHeader && (
        <div className="records-header mb-3">
          <h2 className="h4 mb-0">Course Materials</h2>
          {showStats && recordStats && (
            <RecordStats stats={recordStats} />
          )}
        </div>
      )}

      {/* Records list */}
      <div className="records-list">
        {records.map((record) => (
          <RecordCard
            key={record.id}
            recordItem={record}
            availability={availability}
            openAccordions={accordionManager.openAccordions}
            toggleAccordion={accordionManager.toggleAccordion}
            customization={customization}
            courseInfo={courseInfo}
            collegeParam={collegeParam}
            onAction={(action, additionalData) => 
              handleCardAction(action, record, additionalData)
            }
          />
        ))}
      </div>

      {/* Empty state fallback (shouldn't normally render due to container logic) */}
      {records.length === 0 && (
        <div className="alert alert-info text-center">
          <p className="mb-0">No records to display.</p>
        </div>
      )}
    </div>
  );
};

// Comprehensive PropTypes validation
CourseRecordsDisplay.propTypes = {
  /**
   * Processed array of record data objects
   */
  records: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      copiedItem: PropTypes.object.isRequired,
      isElectronic: PropTypes.bool,
      resource: PropTypes.object,
    })
  ).isRequired,

  /**
   * Statistics about the records
   */
  recordStats: PropTypes.shape({
    total: PropTypes.number.isRequired,
    electronic: PropTypes.number.isRequired,
    print: PropTypes.number.isRequired,
    hasRecords: PropTypes.bool.isRequired,
    isEmpty: PropTypes.bool.isRequired,
  }),

  /**
   * Availability information keyed by instance ID
   */
  availability: PropTypes.object.isRequired,

  /**
   * Information about the associated course
   */
  courseInfo: PropTypes.object.isRequired,

  /**
   * UI customization settings
   */
  customization: PropTypes.object.isRequired,

  /**
   * College parameter for tracking
   */
  collegeParam: PropTypes.string.isRequired,

  /**
   * Accordion management utilities
   */
  accordionManager: PropTypes.shape({
    openAccordions: PropTypes.object.isRequired,
    toggleAccordion: PropTypes.func.isRequired,
    isAccordionOpen: PropTypes.func.isRequired,
  }).isRequired,

  /**
   * Callback for record actions
   */
  onRecordAction: PropTypes.func,

  /**
   * Display options
   */
  options: PropTypes.shape({
    showStats: PropTypes.bool,
    showHeader: PropTypes.bool,
    className: PropTypes.string,
  }),
};

// Default props
CourseRecordsDisplay.defaultProps = {
  recordStats: null,
  onRecordAction: null,
  options: {},
};

export default CourseRecordsDisplay;
