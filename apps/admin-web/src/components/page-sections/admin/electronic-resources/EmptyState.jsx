import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * Reusable empty state component used across different sections
 */
function EmptyState({ 
  icon, 
  title, 
  message, 
  buttonText, 
  buttonAction, 
  buttonIcon,
  linkText,
  linkUrl,
  linkIcon,
  isExternalLink
}) {
  return (
    <div className="empty-state">
      <FontAwesomeIcon icon={icon} className="empty-state-icon" />
      <h5>{title}</h5>
      <p className="text-muted mb-3">{message}</p>
      
      {buttonText && buttonAction && (
        <Button color="primary" className="custom-action-btn primary" onClick={buttonAction}>
          {buttonIcon && <FontAwesomeIcon icon={buttonIcon} className="me-1" />}
          {buttonText}
        </Button>
      )}
      
      {linkText && linkUrl && (
        <a 
          href={linkUrl} 
          target={isExternalLink ? "_blank" : undefined}
          rel={isExternalLink ? "noopener noreferrer" : undefined}
          className="folio-action-btn"
        >
          {linkIcon && <FontAwesomeIcon icon={linkIcon} className="me-1" />}
          {linkText}
        </a>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  buttonText: PropTypes.string,
  buttonAction: PropTypes.func,
  buttonIcon: PropTypes.string,
  linkText: PropTypes.string,
  linkUrl: PropTypes.string,
  linkIcon: PropTypes.string,
  isExternalLink: PropTypes.bool
};

export default EmptyState;
