import PropTypes from 'prop-types';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';

export const ResourceBasicFields = ({ formData, handleFieldChange, titleError }) => (
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
      aria-invalid={titleError ? 'true' : undefined}
      aria-describedby={titleError ? 'title-error' : undefined}
    />
    {titleError && <p id="title-error" className="tw-text-sm tw-text-destructive">{titleError}</p>}
  </div>
);

ResourceBasicFields.propTypes = {
  formData: PropTypes.shape({
    title: PropTypes.string,
  }).isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  titleError: PropTypes.string,
};

export default ResourceBasicFields;
