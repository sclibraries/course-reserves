import PropTypes from 'prop-types';

export const tabPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
}).isRequired;

export const groupPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  tabs: PropTypes.arrayOf(tabPropType).isRequired,
}).isRequired;

export const countsPropType = PropTypes.shape({
  'my-work': PropTypes.number.isRequired,
  submissions: PropTypes.number.isRequired,
  mentions: PropTypes.number.isRequired,
}).isRequired;

export const navigationPropType = PropTypes.shape({
  activeTab: PropTypes.string.isRequired,
  counts: countsPropType,
  isCollapsed: PropTypes.bool.isRequired,
  setCollapsed: PropTypes.func.isRequired,
  isPinLimitReached: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  pins: PropTypes.arrayOf(PropTypes.string).isRequired,
  pinsLoaded: PropTypes.bool.isRequired,
  pinnedTabs: PropTypes.arrayOf(tabPropType).isRequired,
  resetPins: PropTypes.func.isRequired,
  saveError: PropTypes.string.isRequired,
  statusMessage: PropTypes.string.isRequired,
  togglePin: PropTypes.func.isRequired,
  visibleGroups: PropTypes.arrayOf(groupPropType).isRequired,
}).isRequired;
