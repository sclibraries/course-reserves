import PropTypes from 'prop-types';
import { Card, CardBody, Nav, NavItem, NavLink } from 'reactstrap';
import { FaInfoCircle, FaFolder, FaLink, FaEye, FaCog } from 'react-icons/fa';

/**
 * FormNavigationAnchor - Provides anchor links to jump to different form sections
 */
export const FormNavigationAnchor = ({ 
  hasMaterialTypeFields = false,
  hasAdditionalLinks = false,
  className = ''
}) => {
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest' 
      });
    }
  };

  return (
    <Card className={`form-navigation-anchor mb-4 ${className}`}>
      <CardBody className="py-3">
        <div className="d-flex align-items-center mb-2">
          <FaCog className="text-muted me-2" size={16} />
          <h6 className="mb-0 text-muted">Quick Navigation</h6>
        </div>
        
        <Nav className="flex-wrap">
          <NavItem className="me-3 mb-1">
            <NavLink 
              href="#basic-information" 
              onClick={(e) => { e.preventDefault(); scrollToSection('basic-information'); }}
              className="p-2 text-decoration-none small"
            >
              <FaInfoCircle className="me-1" size={14} />
              Basic Info
            </NavLink>
          </NavItem>
          
          <NavItem className="me-3 mb-1">
            <NavLink 
              href="#classification-organization" 
              onClick={(e) => { e.preventDefault(); scrollToSection('classification-organization'); }}
              className="p-2 text-decoration-none small"
            >
              <FaFolder className="me-1" size={14} />
              Classification
            </NavLink>
          </NavItem>
          
          {hasMaterialTypeFields && (
            <NavItem className="me-3 mb-1">
              <NavLink 
                href="#type-specific-details" 
                onClick={(e) => { e.preventDefault(); scrollToSection('type-specific-details'); }}
                className="p-2 text-decoration-none small"
              >
                <FaCog className="me-1" size={14} />
                Type Details
              </NavLink>
            </NavItem>
          )}
          
          <NavItem className="me-3 mb-1">
            <NavLink 
              href="#additional-links" 
              onClick={(e) => { e.preventDefault(); scrollToSection('additional-links'); }}
              className="p-2 text-decoration-none small"
            >
              <FaLink className="me-1" size={14} />
              Links {hasAdditionalLinks && <span className="badge bg-primary ms-1">+</span>}
            </NavLink>
          </NavItem>
          
          <NavItem className="me-3 mb-1">
            <NavLink 
              href="#visibility-settings" 
              onClick={(e) => { e.preventDefault(); scrollToSection('visibility-settings'); }}
              className="p-2 text-decoration-none small"
            >
              <FaEye className="me-1" size={14} />
              Visibility
            </NavLink>
          </NavItem>
        </Nav>
      </CardBody>
    </Card>
  );
};

FormNavigationAnchor.propTypes = {
  hasMaterialTypeFields: PropTypes.bool,
  hasAdditionalLinks: PropTypes.bool,
  className: PropTypes.string
};

export default FormNavigationAnchor;
