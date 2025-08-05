/**
 * RecordStats - Component for displaying record statistics
 * 
 * This component provides a reusable way to display statistics about course records,
 * following the Single Responsibility Principle.
 * 
 * @description
 * - Displays record counts and statistics
 * - Reusable across different views
 * - Customizable styling and layout
 */

import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';

/**
 * RecordStats Component
 * 
 * @component
 * @param {Object} props - Component properties
 * @param {Object} props.stats - Statistics object
 * @param {boolean} props.compact - Whether to show compact view
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} The record statistics component
 */
const RecordStats = ({ stats, compact = false, className = '' }) => {
  if (!stats || !stats.hasRecords) {
    return null;
  }

  const { total, electronic, print } = stats;

  if (compact) {
    return (
      <div className={`record-stats-compact ${className}`}>
        <Badge color="primary" pill className="me-2">
          {total} total
        </Badge>
        {electronic > 0 && (
          <Badge color="info" pill className="me-2">
            {electronic} digital
          </Badge>
        )}
        {print > 0 && (
          <Badge color="success" pill>
            {print} physical
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={`record-stats ${className}`}>
      <div className="stats-grid d-flex gap-3">
        <div className="stat-item">
          <span className="stat-value text-primary fw-bold">{total}</span>
          <span className="stat-label text-muted ms-1">
            {total === 1 ? 'item' : 'items'}
          </span>
        </div>
        
        {electronic > 0 && (
          <div className="stat-item">
            <span className="stat-value text-info fw-bold">{electronic}</span>
            <span className="stat-label text-muted ms-1">digital</span>
          </div>
        )}
        
        {print > 0 && (
          <div className="stat-item">
            <span className="stat-value text-success fw-bold">{print}</span>
            <span className="stat-label text-muted ms-1">physical</span>
          </div>
        )}
      </div>
    </div>
  );
};

// PropTypes validation
RecordStats.propTypes = {
  /**
   * Statistics object containing record counts
   */
  stats: PropTypes.shape({
    total: PropTypes.number.isRequired,
    electronic: PropTypes.number.isRequired,
    print: PropTypes.number.isRequired,
    hasRecords: PropTypes.bool.isRequired,
    isEmpty: PropTypes.bool.isRequired,
  }),

  /**
   * Whether to show compact view
   */
  compact: PropTypes.bool,

  /**
   * Additional CSS classes
   */
  className: PropTypes.string,
};

// Default props
RecordStats.defaultProps = {
  stats: null,
  compact: false,
  className: '',
};

export default RecordStats;
