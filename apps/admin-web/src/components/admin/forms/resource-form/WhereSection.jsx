import PropTypes from 'prop-types';
import { Link2 } from 'lucide-react';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import ProxyToggle from '../common/ProxyToggle';
import ResourceLinks from '../fields/ResourceLinks';
import { ResourceFormSection } from './ResourceFormSection';

export const WhereSection = ({ formData, handleFieldChange, links, setLinks, linkMarker, readOnly = false }) => (
  <ResourceFormSection id="where-do-students-go" title="Where do students go?" icon={Link2}>
    <fieldset disabled={readOnly} className="tw-m-0 tw-min-w-0 tw-space-y-4 tw-border-0 tw-p-0">
      <legend className="tw-sr-only">Shared resource links</legend>
      <div className="tw-min-w-0 tw-space-y-2">
        <Label htmlFor="link">Primary URL{linkMarker}</Label>
        <Input
          id="link"
          name="link"
          value={formData.link || ''}
          onChange={handleFieldChange}
          placeholder="https://example.com"
        />
      </div>
      <ProxyToggle
        name="use_proxy"
        checked={formData.use_proxy || false}
        onChange={handleFieldChange}
        label="Use proxy for this resource"
      />
      <ResourceLinks links={links} setLinks={setLinks} />
    </fieldset>
  </ResourceFormSection>
);

WhereSection.propTypes = {
  formData: PropTypes.object.isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  links: PropTypes.array.isRequired,
  setLinks: PropTypes.func.isRequired,
  linkMarker: PropTypes.node,
  readOnly: PropTypes.bool,
};

export default WhereSection;
