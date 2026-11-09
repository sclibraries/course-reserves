import PropTypes from 'prop-types';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';

export const ResourceBasicFields = ({ formData, handleFieldChange }) => (
  <div className="tw-space-y-2">
    <Label htmlFor="title">
      Resource Name <span aria-hidden="true" className="tw-text-destructive">*</span>
    </Label>
    <Input
      id="title"
      name="title"
      value={formData.title || ''}
      onChange={handleFieldChange}
      placeholder="Enter resource name"
      required
    />
  </div>
);

ResourceBasicFields.propTypes = {
  formData: PropTypes.shape({
    title: PropTypes.string,
  }).isRequired,
  handleFieldChange: PropTypes.func.isRequired,
};

export default ResourceBasicFields;
