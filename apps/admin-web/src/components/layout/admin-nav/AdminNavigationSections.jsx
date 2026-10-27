import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Pin, RotateCcw } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Separator } from '../../ui/separator';
import { MAX_NAV_PINS } from '../../../services/admin/navPinsService';
import { getTabCount, getTabCountLabel } from './adminNavigationUtils';
import { groupPropType, navigationPropType, tabPropType } from './navigationPropTypes';

function PageLink({ tab, navigation, onNavigate }) {
  const count = getTabCount(tab.key, navigation.counts);
  const countLabel = getTabCountLabel(tab.key, count);
  return (
    <Link
      to={`/admin?tab=${encodeURIComponent(tab.key)}`}
      onClick={onNavigate}
      aria-label={count > 0 ? `${tab.label}, ${countLabel}` : tab.label}
      aria-current={navigation.activeTab === tab.key ? 'page' : undefined}
      className={`tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-3 tw-rounded-md tw-px-2 tw-py-2 tw-text-sm tw-font-medium tw-no-underline focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring ${
        navigation.activeTab === tab.key
          ? 'tw-bg-accent tw-text-accent-foreground'
          : 'tw-text-foreground hover:tw-bg-accent/70'
      }`}
    >
      <tab.icon aria-hidden="true" className="tw-h-4 tw-w-4 tw-shrink-0" />
      <span className="tw-min-w-0 tw-flex-1 tw-break-words">{tab.label}</span>
      {count > 0 && <Badge variant="secondary" className="tw-min-w-6 tw-justify-center">{count}</Badge>}
    </Link>
  );
}
PageLink.propTypes = {
  tab: tabPropType,
  navigation: navigationPropType,
  onNavigate: PropTypes.func,
};

function PinButton({ tab, navigation }) {
  const isPinned = navigation.pins.includes(tab.key);
  const atLimit = !isPinned && navigation.isPinLimitReached;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${tab.label}`}
      aria-pressed={isPinned}
      aria-describedby={atLimit ? 'admin-nav-pin-limit' : undefined}
      title={atLimit ? `You can pin up to ${MAX_NAV_PINS} pages.` : undefined}
      disabled={!navigation.pinsLoaded || navigation.isSaving || atLimit}
      onClick={() => navigation.togglePin(tab.key)}
      className="tw-h-10 tw-w-10 tw-shrink-0 tw-text-muted-foreground"
    >
      <Pin aria-hidden="true" />
    </Button>
  );
}
PinButton.propTypes = { tab: tabPropType, navigation: navigationPropType };

function PageEntry({ tab, navigation, onNavigate }) {
  return (
    <li className="tw-flex tw-min-w-0 tw-items-center tw-gap-1">
      <PageLink tab={tab} navigation={navigation} onNavigate={onNavigate} />
      <PinButton tab={tab} navigation={navigation} />
    </li>
  );
}
PageEntry.propTypes = {
  tab: tabPropType,
  navigation: navigationPropType,
  onNavigate: PropTypes.func,
};

function GroupSection({ group, navigation, onNavigate, registerHeading }) {
  return (
    <section aria-labelledby={`admin-nav-group-${group.key}`} className="tw-py-3">
      <h2
        id={`admin-nav-group-${group.key}`}
        tabIndex={-1}
        ref={(node) => registerHeading(group.key, node)}
        className="tw-mb-2 tw-px-2 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-muted-foreground focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring"
      >
        {group.label}
      </h2>
      <ul className="tw-m-0 tw-list-none tw-space-y-1 tw-p-0">
        {group.tabs.map((tab) => (
          <PageEntry key={tab.key} tab={tab} navigation={navigation} onNavigate={onNavigate} />
        ))}
      </ul>
    </section>
  );
}
GroupSection.propTypes = {
  group: groupPropType,
  navigation: navigationPropType,
  onNavigate: PropTypes.func,
  registerHeading: PropTypes.func.isRequired,
};

export default function AdminNavigationSections({
  navigation,
  onNavigate,
  registerHeading = () => {},
}) {
  return (
    <nav aria-label="Admin" className="tw-flex tw-min-h-0 tw-flex-1 tw-flex-col">
      <div className="tw-px-3 tw-pb-2 tw-pt-4">
        <div className="tw-flex tw-min-w-0 tw-items-center tw-justify-between tw-gap-2">
          <h2 id="admin-nav-pinned" className="tw-m-0 tw-text-sm tw-font-semibold">Pinned</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={navigation.resetPins}
            disabled={!navigation.pinsLoaded || navigation.isSaving}
          >
            <RotateCcw aria-hidden="true" />
            Reset to defaults
          </Button>
        </div>
        {navigation.pinnedTabs.length ? (
          <ul aria-labelledby="admin-nav-pinned" className="tw-mt-2 tw-list-none tw-space-y-1 tw-p-0">
            {navigation.pinnedTabs.map((tab) => (
              <li key={tab.key} className="tw-flex tw-min-w-0">
                <PageLink tab={tab} navigation={navigation} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="tw-mb-0 tw-mt-2 tw-px-2 tw-text-sm tw-text-muted-foreground">No pinned pages.</p>
        )}
      </div>

      {navigation.isPinLimitReached && <span id="admin-nav-pin-limit" className="tw-sr-only">You can pin up to {MAX_NAV_PINS} pages.</span>}
      {navigation.statusMessage && <p role="status" className="tw-sr-only">{navigation.statusMessage}</p>}
      {navigation.saveError && <p role="alert" className="tw-mx-3 tw-my-2 tw-rounded-md tw-bg-destructive/10 tw-p-2 tw-text-sm tw-text-destructive">{navigation.saveError}</p>}
      <Separator className="tw-mt-2" />
      <div className="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3 tw-pb-4">
        {navigation.visibleGroups.map((group) => (
          <GroupSection
            key={group.key}
            group={group}
            navigation={navigation}
            onNavigate={onNavigate}
            registerHeading={registerHeading}
          />
        ))}
      </div>
    </nav>
  );
}

AdminNavigationSections.propTypes = {
  navigation: navigationPropType,
  onNavigate: PropTypes.func,
  registerHeading: PropTypes.func,
};
