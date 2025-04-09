import PropTypes from 'prop-types';
import { FormGroup, Label, Input } from 'reactstrap';

/**
 * ResourceTypeSelector - Component for selecting resource material type
 */
export const ResourceTypeSelector = ({ 
  materialTypes = [], 
  selectedTypeId = '',
  onTypeChange,
  isLoading = false 
}) => {
  return (
    <FormGroup>
      <Label for="material_type_id">Material Type</Label>
      <Input
        id="material_type_id"
        name="material_type_id"
        type="select"
        value={selectedTypeId}
        onChange={onTypeChange}
        disabled={isLoading}
      >
        <option value="">-- Select Material Type --</option>
        {materialTypes.map(type => (
          <option 
            key={type.material_type_id} 
            value={type.material_type_id}
          >
            {type.description || type.name}
          </option>
        ))}
      </Input>
      {isLoading && <small className="text-muted">Loading material types...</small>}
    </FormGroup>
  );
};

ResourceTypeSelector.propTypes = {
  materialTypes: PropTypes.array,
  selectedTypeId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  onTypeChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool
};

export default ResourceTypeSelector;
