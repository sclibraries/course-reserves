import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

/**
 * Quick sort options for the unified resource table
 */
function ResourceSortDropdown({ 
  currentSort, 
  onSortChange, 
  isDropdownOpen, 
  setDropdownOpen 
}) {
  const sortOptions = [
    { 
      value: 'manual', 
      label: 'Default Order', 
      icon: 'fa-solid fa-list-ol',
      description: 'Backend-provided order (custom order + creation order)'
    },
    { 
      value: 'alphabetical-asc', 
      label: 'Alphabetical (A-Z)', 
      icon: 'fa-solid fa-arrow-down-a-z',
      description: 'Sort by title A to Z'
    },
    { 
      value: 'alphabetical-desc', 
      label: 'Alphabetical (Z-A)', 
      icon: 'fa-solid fa-arrow-up-z-a',
      description: 'Sort by title Z to A'
    },
    { 
      value: 'electronic-first-alpha-asc', 
      label: 'Electronic First, then A-Z', 
      icon: 'fa-solid fa-laptop',
      description: 'Electronic resources first, then alphabetical A-Z'
    },
    { 
      value: 'electronic-first-alpha-desc', 
      label: 'Electronic First, then Z-A', 
      icon: 'fa-solid fa-laptop',
      description: 'Electronic resources first, then alphabetical Z-A'
    },
    { 
      value: 'print-first-alpha-asc', 
      label: 'Print First, then A-Z', 
      icon: 'fa-solid fa-book',
      description: 'Print resources first, then alphabetical A-Z'
    },
    { 
      value: 'print-first-alpha-desc', 
      label: 'Print First, then Z-A', 
      icon: 'fa-solid fa-book',
      description: 'Print resources first, then alphabetical Z-A'
    },
    { 
      value: 'date-newest', 
      label: 'Date Added (Newest)', 
      icon: 'fa-solid fa-arrow-down-9-1',
      description: 'Most recently added first'
    },
    { 
      value: 'date-oldest', 
      label: 'Date Added (Oldest)', 
      icon: 'fa-solid fa-arrow-up-1-9',
      description: 'Oldest additions first'
    },
    { 
      value: 'material-type', 
      label: 'Material Type', 
      icon: 'fa-solid fa-layer-group',
      description: 'Group by material type (books, articles, etc.)'
    }
  ];

  const getCurrentSortLabel = () => {
    const option = sortOptions.find(opt => opt.value === currentSort);
    return option ? option.label : 'Default Order';
  };

  const getCurrentSortIcon = () => {
    const option = sortOptions.find(opt => opt.value === currentSort);
    return option ? option.icon : 'fa-solid fa-list-ol';
  };

  return (
    <div className="resource-sort-dropdown mb-3">
      <div className="d-flex align-items-center">
        <label className="me-2 mb-0 fw-bold">Sort by:</label>
        <Dropdown isOpen={isDropdownOpen} toggle={() => setDropdownOpen(!isDropdownOpen)}>
          <DropdownToggle caret color="outline-secondary" className="d-flex align-items-center">
            <FontAwesomeIcon icon={getCurrentSortIcon()} className="me-2" />
            {getCurrentSortLabel()}
          </DropdownToggle>
          <DropdownMenu>
            {sortOptions.map((option) => (
              <DropdownItem
                key={option.value}
                onClick={() => onSortChange(option.value)}
                active={currentSort === option.value}
                className="d-flex align-items-start"
              >
                <FontAwesomeIcon icon={option.icon} className="me-3 mt-1" style={{ width: '16px' }} />
                <div>
                  <div className="fw-bold">{option.label}</div>
                  <small className="text-muted">{option.description}</small>
                </div>
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      </div>
    </div>
  );
}

ResourceSortDropdown.propTypes = {
  currentSort: PropTypes.string.isRequired,
  onSortChange: PropTypes.func.isRequired,
  isDropdownOpen: PropTypes.bool.isRequired,
  setDropdownOpen: PropTypes.func.isRequired
};

export default ResourceSortDropdown;
