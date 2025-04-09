import PropTypes from 'prop-types';
import { FaInfoCircle } from 'react-icons/fa';

/**
 * FormSection - Consistent section divider for forms
 */
export const FormSection = ({ title, icon: Icon = FaInfoCircle, children }) => {
  return (
    <div className="mt-4 mb-3">
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
        <h4 className="m-0">
          {Icon && <Icon className="me-2" />}
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
};

FormSection.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  children: PropTypes.node
};

export default FormSection;
