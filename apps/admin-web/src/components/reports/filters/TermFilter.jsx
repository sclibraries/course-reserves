import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';
import { filterValidTerms, sortTerms } from '../utils/filterUtils';

/**
 * Component for filtering by academic term
 */
const TermFilter = ({ value, onChange, terms, label }) => {
  const validTerms = sortTerms(filterValidTerms(terms || []));

  return (
    <FormGroup>
      <Label for="termFilter">{label}</Label>
      <Input
        type="select"
        id="termFilter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All Terms</option>
        {validTerms.map(term => (
          <option key={term} value={term}>{term}</option>
        ))}
      </Input>
    </FormGroup>
  );
};

TermFilter.propTypes = {
  /**
   * Currently selected term value
   */
  value: PropTypes.string,
  
  /**
   * Callback for when selection changes
   */
  onChange: PropTypes.func.isRequired,
  
  /**
   * Array of available terms
   */
  terms: PropTypes.arrayOf(PropTypes.string),
  
  /**
   * Field label
   */
  label: PropTypes.string
};

TermFilter.defaultProps = {
  value: '',
  terms: [],
  label: 'Term'
};

export default TermFilter;