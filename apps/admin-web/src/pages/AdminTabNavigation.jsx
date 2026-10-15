import PropTypes from 'prop-types';
import { Badge, Dropdown, DropdownItem, DropdownMenu, DropdownToggle, UncontrolledDropdown } from 'reactstrap';
import { FaChevronDown } from 'react-icons/fa';
import { getAdminTab } from './adminTabRegistry';

const tabPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  ariaLabel: PropTypes.string,
  navigationGroup: PropTypes.string,
  canAccess: PropTypes.bool.isRequired,
});

const countsPropType = PropTypes.shape({
  submissions: PropTypes.number.isRequired,
  myWork: PropTypes.number.isRequired,
  mentions: PropTypes.number.isRequired,
});

const countForTab = (key, counts) => ({
  submissions: counts.submissions,
  'my-work': counts.myWork,
  mentions: counts.mentions,
}[key] || 0);

const badgeColor = (key) => (key === 'my-work' ? 'success' : key === 'mentions' ? 'danger' : 'primary');

function WorkflowDropdown({ tabs, activeTab, counts, onTabChange }) {
  const workflowTabs = tabs.filter((tab) => tab.navigationGroup === 'workflow' && tab.canAccess);
  const totalCount = counts.submissions + counts.myWork + counts.mentions;

  return (
    <UncontrolledDropdown nav inNavbar className="d-inline-block">
      <DropdownToggle
        nav
        className={`tab-button workflow-dropdown ${workflowTabs.some((tab) => tab.key === activeTab) ? 'active' : ''}`}
        aria-label="Workflow Management"
      >
        Workflow
        {totalCount > 0 && <Badge color="danger" pill className="ms-2" style={{ fontSize: '0.7rem' }}>{totalCount}</Badge>}
        <FaChevronDown className="ms-2" style={{ fontSize: '0.7rem' }} />
      </DropdownToggle>
      <DropdownMenu>
        {workflowTabs.map((tab) => (
          <DropdownItem
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            active={activeTab === tab.key}
            className="d-flex justify-content-between align-items-center"
          >
            <span>{tab.label}</span>
            {countForTab(tab.key, counts) > 0 && (
              <Badge color={badgeColor(tab.key)} pill>{countForTab(tab.key, counts)}</Badge>
            )}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </UncontrolledDropdown>
  );
}

WorkflowDropdown.propTypes = {
  tabs: PropTypes.arrayOf(tabPropType).isRequired,
  activeTab: PropTypes.string.isRequired,
  counts: countsPropType.isRequired,
  onTabChange: PropTypes.func.isRequired,
};

function DirectTab({ tab, activeTab, onTabChange, mobile = false }) {
  const className = mobile ? '' : `tab-button ${activeTab === tab.key ? 'active' : ''}`;
  return mobile ? (
    <DropdownItem key={tab.key} onClick={() => onTabChange(tab.key)} active={activeTab === tab.key}>
      {tab.label}
    </DropdownItem>
  ) : (
    <button
      key={tab.key}
      className={className}
      onClick={() => onTabChange(tab.key)}
      aria-label={tab.ariaLabel}
    >
      {tab.label}
    </button>
  );
}

DirectTab.propTypes = {
  tab: tabPropType.isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};

function MobileTabLabel({ tab, counts }) {
  if (!tab) return null;
  const count = countForTab(tab.key, counts);
  return (
    <span>
      {tab.label}
      {count > 0 && <Badge color={badgeColor(tab.key)} pill className="ms-2">{count}</Badge>}
    </span>
  );
}

MobileTabLabel.propTypes = {
  tab: tabPropType,
  counts: countsPropType.isRequired,
};

export default function AdminTabNavigation({
  tabs,
  navigationOrder,
  activeTab,
  workflowVisible,
  counts,
  onTabChange,
  dropdownOpen,
  toggleDropdown,
}) {
  const activeDefinition = getAdminTab({ tabs }, activeTab);

  return (
    <div className="bg-white shadow-sm">
      <div className="d-flex align-items-center px-4 py-3">
        <div className="modern-tabs d-none d-md-flex">
          {navigationOrder.map((key) => {
            if (key === 'workflow') {
              return workflowVisible ? (
                <WorkflowDropdown key={key} tabs={tabs} activeTab={activeTab} counts={counts} onTabChange={onTabChange} />
              ) : null;
            }
            const tab = getAdminTab({ tabs }, key);
            return tab?.canAccess ? <DirectTab key={key} tab={tab} activeTab={activeTab} onTabChange={onTabChange} /> : null;
          })}
        </div>

        <div className="d-md-none w-100">
          <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown} className="mobile-tabs-dropdown">
            <DropdownToggle caret className="w-100 text-start d-flex justify-content-between align-items-center">
              <MobileTabLabel tab={activeDefinition} counts={counts} />
            </DropdownToggle>
            <DropdownMenu className="w-100">
              {navigationOrder.flatMap((key) => {
                if (key === 'workflow') {
                  return workflowVisible
                    ? tabs.filter((tab) => tab.navigationGroup === 'workflow' && tab.canAccess)
                      .map((tab) => <DirectTab key={tab.key} tab={tab} activeTab={activeTab} onTabChange={onTabChange} mobile />)
                    : [];
                }
                const tab = getAdminTab({ tabs }, key);
                return tab?.canAccess
                  ? [<DirectTab key={tab.key} tab={tab} activeTab={activeTab} onTabChange={onTabChange} mobile />]
                  : [];
              })}
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    </div>
  );
}

AdminTabNavigation.propTypes = {
  tabs: PropTypes.arrayOf(tabPropType).isRequired,
  navigationOrder: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeTab: PropTypes.string.isRequired,
  workflowVisible: PropTypes.bool.isRequired,
  counts: countsPropType.isRequired,
  onTabChange: PropTypes.func.isRequired,
  dropdownOpen: PropTypes.bool.isRequired,
  toggleDropdown: PropTypes.func.isRequired,
};
