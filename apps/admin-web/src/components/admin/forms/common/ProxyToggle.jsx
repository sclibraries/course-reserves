import PropTypes from 'prop-types';
import { FormGroup, Label } from 'reactstrap';

/**
 * ProxyToggle - Common component for toggling proxy settings
 */
export const ProxyToggle = ({ name = "use_proxy", checked = false, onChange, label = "Use proxy for this resource" }) => {
  return (
    <FormGroup className="mb-4">
      <div className="form-check form-switch">
        <input
          id={name}
          name={name}
          type="checkbox"
          className="form-check-input"
          checked={checked}
          onChange={onChange}
        />
        <Label htmlFor={name} className="form-check-label">
          {label}
        </Label>
      </div>
    </FormGroup>
  );
};

ProxyToggle.propTypes = {
  name: PropTypes.string,
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string
};

export default ProxyToggle;
