import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';

/**
 * Component for filtering by college/campus
 */
const CollegeFilter = ({ value, onChange, colleges, label, useSelect }) => {
  // Ensure we have valid colleges data
  const validColleges = React.useMemo(() => {
    if (!colleges || !Array.isArray(colleges)) return [];
    return colleges
      .filter(college => college && typeof college === 'string' && college.trim() !== '')
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