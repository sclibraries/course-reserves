import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';

/**
 * Component for general text search filtering
 */
const SearchFilter = ({ value, onChange, label, placeholder }) => {
  return (
    <FormGroup>
      <Label for="searchFilter">{label}</Label>
      <Input
        type="text"
        id="searchFilter"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </FormGroup>
  );
};

SearchFilter.propTypes = {
  /**
   * Current search term
   */
  value: PropTypes.string,
  
  /**
   * Callback for when value changes
   */
  onChange: PropTypes.func.isRequired,
  
  /**
   * Field label
   */
  label: PropTypes.string,
  
  /**
   * Placeholder text
   */
  placeholder: PropTypes.string
};

SearchFilter.defaultProps = {
  value: '',
  label: 'Search',
  placeholder: 'Search all fields'
};

export default SearchFilter;