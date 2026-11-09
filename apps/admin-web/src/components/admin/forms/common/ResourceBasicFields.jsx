import PropTypes from 'prop-types';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';

export const ResourceBasicFields = ({ formData, handleFieldChange }) => (
  <div className="tw-space-y-4">
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

    <div className="tw-space-y-2">
      <Label htmlFor="link">Primary URL</Label>
      <Input
        id="link"
        name="link"
        value={formData.link || ''}
        onChange={handleFieldChange}
        placeholder="https://example.com"
      />
      <p className="tw-text-sm tw-text-muted-foreground">
        The main link for this resource. Visibility settings can be configured below.
      </p>
    </div>

    <div className="tw-flex tw-items-center tw-gap-2">
      <input
        id="use_proxy"
        name="use_proxy"
        type="checkbox"
        checked={formData.use_proxy || false}
        onChange={handleFieldChange}
        className="tw-size-6 tw-rounded tw-border-input tw-accent-primary focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring focus-visible:tw-ring-offset-2"
      />
      <Label htmlFor="use_proxy">Use proxy for this resource</Label>
    </div>
  </div>
);

ResourceBasicFields.propTypes = {
  formData: PropTypes.shape({
    title: PropTypes.string,
    link: PropTypes.string,
    use_proxy: PropTypes.bool,
  }).isRequired,
  handleFieldChange: PropTypes.func.isRequired,
};

export default ResourceBasicFields;
