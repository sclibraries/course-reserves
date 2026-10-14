import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

const LinksExpandButton = ({ itemId, isExpanded, color, label, onToggle }) => (
  <Button
    color="link"
    size="sm"
    className="p-0"
    onClick={() => onToggle(itemId)}
    aria-expanded={isExpanded}
    style={{ color }}
  >
    <span className="badge bg-secondary">{label}</span>
    <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="ms-1" />
  </Button>
);

LinksExpandButton.propTypes = {
  itemId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  isExpanded: PropTypes.bool,
  color: PropTypes.string,
  label: PropTypes.string,
  onToggle: PropTypes.func.isRequired,
};

export default LinksExpandButton;
