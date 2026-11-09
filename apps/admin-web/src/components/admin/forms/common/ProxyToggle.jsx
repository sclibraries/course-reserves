import PropTypes from 'prop-types';
import { Label } from '../../../ui/label';

export const ProxyToggle = ({ name = 'use_proxy', checked = false, onChange, label = 'Use proxy for this resource' }) => (
  <div className="tw-flex tw-items-center tw-gap-2">
    <input
      id={name}
      name={name}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="tw-size-6 tw-rounded tw-border-input tw-accent-primary focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring focus-visible:tw-ring-offset-2"
    />
    <Label htmlFor={name}>{label}</Label>
  </div>
);

ProxyToggle.propTypes = {
  name: PropTypes.string,
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
};

export default ProxyToggle;
