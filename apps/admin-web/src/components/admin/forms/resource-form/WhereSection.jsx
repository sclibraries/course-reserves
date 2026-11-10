import PropTypes from 'prop-types';
import { Link2 } from 'lucide-react';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import ProxyToggle from '../common/ProxyToggle';
import ResourceLinks from '../fields/ResourceLinks';
import { ResourceFormSection } from './ResourceFormSection';

export const WhereSection = ({ formData, handleFieldChange, links, setLinks, linkMarker, resourceVisibilityDates }) => (
  <ResourceFormSection id="where-do-students-go" title="Where do students go?" icon={Link2}>
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
    <ResourceLinks
      links={links}
      setLinks={setLinks}
      resourceVisibilityDates={resourceVisibilityDates}
    />
  </ResourceFormSection>
);

WhereSection.propTypes = {
  formData: PropTypes.object.isRequired,
  handleFieldChange: PropTypes.func.isRequired,
  links: PropTypes.array.isRequired,
  setLinks: PropTypes.func.isRequired,
  linkMarker: PropTypes.node,
  resourceVisibilityDates: PropTypes.shape({
    startDate: PropTypes.string,
    endDate: PropTypes.string,
  }),
};

export default WhereSection;
