import PropTypes from 'prop-types';
import { Label } from '../../../ui/label';
import NativeSelect from '../../../ui/native-select';

export const ResourceTypeSelector = ({
  materialTypes = [],
  selectedTypeId = '',
  onTypeChange,
  isLoading = false,
}) => (
  <div className="tw-space-y-2">
    <Label htmlFor="material_type_id">Material Type</Label>
    <NativeSelect
      id="material_type_id"
      name="material_type_id"
      value={selectedTypeId}
      onChange={onTypeChange}
      disabled={isLoading}
    >
      <option value="">-- Select Material Type --</option>
      {materialTypes.map(type => (
        <option key={type.material_type_id} value={type.material_type_id}>
          {type.description || type.name}
        </option>
      ))}
    </NativeSelect>
    {isLoading && <p role="status" className="tw-text-sm tw-text-muted-foreground">Loading material types...</p>}
  </div>
);

ResourceTypeSelector.propTypes = {
  materialTypes: PropTypes.array,
  selectedTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onTypeChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default ResourceTypeSelector;
