import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';

/**
 * Component for filtering by college/campus
 */
const CollegeFilter = ({ value, onChange, colleges, label, useSelect }) => {
  // Ensure we have valid colleges data - filter out invalid/empty values
  const validColleges = React.useMemo(() => {
    if (!colleges || !Array.isArray(colleges)) return [];
    
    // Values to exclude (case-insensitive)
    const invalidValues = ['n/a', 'null', 'unknown', 'default', ''];
    
    return colleges
      .filter(college => {
        // Must be a string that's not empty
        if (!college || typeof college !== 'string') return false;
        
        // Check for invalid values (case-insensitive)
        const normalizedCollege = college.trim().toLowerCase();
        return !invalidValues.includes(normalizedCollege);
      })
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [colleges]);

  return (
    <FormGroup>
      <Label for="collegeFilter">{label}</Label>
      {useSelect && validColleges.length > 0 ? (
        <Input
          type="select"
          id="collegeFilter"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">All Colleges</option>
          {validColleges.map(college => (
            <option key={college} value={college}>{college}</option>
          ))}
        </Input>
      ) : (
        <Input
          type="text"
          id="collegeFilter"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Filter by college"
        />
      )}
    </FormGroup>
  );
};

CollegeFilter.propTypes = {
  /**
   * Currently entered/selected college
   */
  value: PropTypes.string,
  
  /**
   * Callback for when value changes
   */
  onChange: PropTypes.func.isRequired,
  
  /**
   * Array of available colleges (optional - only used in select mode)
   */
  colleges: PropTypes.arrayOf(PropTypes.string),
  
  /**
   * Field label
   */
  label: PropTypes.string,
  
  /**
   * Whether to use a select dropdown instead of text input
   */
  useSelect: PropTypes.bool
};

CollegeFilter.defaultProps = {
  value: '',
  colleges: [],
  label: 'College',
  useSelect: false
};

export default CollegeFilter;