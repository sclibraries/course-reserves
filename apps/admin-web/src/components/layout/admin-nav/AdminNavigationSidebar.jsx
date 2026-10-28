import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import AdminNavigationSections from './AdminNavigationSections';
import { getTabCount, getTabCountLabel } from './adminNavigationUtils';
import {
  countsPropType,
  groupPropType,
  navigationPropType,
  tabPropType,
} from './navigationPropTypes';
import { ADMIN_HEADER_HEIGHT_STYLE } from '../adminLayoutConstants';

function RailLink({ tab, counts }) {
  const count = getTabCount(tab.key, counts);
  const countLabel = getTabCountLabel(tab.key, count);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={`/admin?tab=${encodeURIComponent(tab.key)}`}
          aria-label={count > 0 ? `${tab.label}, ${countLabel}` : tab.label}
          className="tw-relative tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-md tw-text-foreground hover:tw-bg-accent focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring"
        >
          <tab.icon aria-hidden="true" className="tw-h-5 tw-w-5" />
          {count > 0 && <Badge aria-hidden="true" variant="secondary" className="tw-absolute tw-right-0 tw-top-0 tw-min-w-0 tw-translate-x-1/4 tw--translate-y-1/4 tw-px-1 tw-py-0 tw-text-[10px]">{count}</Badge>}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{tab.label}</TooltipContent>
    </Tooltip>
  );
}
RailLink.propTypes = {
  tab: tabPropType,
  counts: countsPropType,
};

function RailGroup({ group, onExpand }) {
  const Icon = group.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Open ${group.label} section`}
          onClick={() => onExpand(group.key)}
        >
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{group.label}</TooltipContent>
    </Tooltip>
  );
}
RailGroup.propTypes = {
  group: groupPropType,
  onExpand: PropTypes.func.isRequired,
};

export default function AdminNavigationSidebar({ navigation }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [focusGroup, setFocusGroup] = useState('');
  const headingRefs = useRef({});

  useEffect(() => {
    if (!navigation.isCollapsed && focusGroup) {
      headingRefs.current[focusGroup]?.focus();
      setFocusGroup('');
    }
  }, [navigation.isCollapsed, focusGroup]);

  const expandGroup = (key) => {
    setFocusGroup(key);
    navigation.setCollapsed(false);
  };
  const registerHeading = (key, node) => { headingRefs.current[key] = node; };
  const collapseLabel = navigation.isCollapsed ? 'Expand admin navigation' : 'Collapse admin navigation';

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <aside
          aria-label="Admin navigation panel"
          className={`tw-sticky tw-top-[var(--admin-header-height)] tw-hidden tw-h-[calc(100vh-var(--admin-header-height))] tw-shrink-0 tw-flex-col tw-border-r tw-bg-card tw-transition-[width] md:tw-flex ${
            navigation.isCollapsed ? 'tw-w-16' : 'tw-w-72'
          }`}
          style={ADMIN_HEADER_HEIGHT_STYLE}
        >
          {navigation.isCollapsed ? (
            <div className="tw-flex tw-min-h-0 tw-flex-1 tw-flex-col tw-items-center tw-gap-2 tw-overflow-y-auto tw-px-2 tw-py-3">
              {navigation.pinnedTabs.map((tab) => <RailLink key={tab.key} tab={tab} counts={navigation.counts} />)}
              {navigation.visibleGroups.map((group) => (
                <RailGroup key={group.key} group={group} onExpand={expandGroup} />
              ))}
            </div>
          ) : (
            <AdminNavigationSections navigation={navigation} registerHeading={registerHeading} />
          )}
          <div className="tw-border-t tw-p-2">
            <Button
              type="button"
              variant="ghost"
              className="tw-w-full tw-justify-start"
              aria-label={collapseLabel}
              aria-expanded={!navigation.isCollapsed}
              onClick={() => navigation.setCollapsed(!navigation.isCollapsed)}
            >
              {navigation.isCollapsed
                ? <ChevronRight aria-hidden="true" />
                : <ChevronLeft aria-hidden="true" />}
              {!navigation.isCollapsed && <span>Collapse</span>}
            </Button>
          </div>
        </aside>
      </TooltipProvider>

      <div className="tw-flex tw-min-w-0 tw-items-start tw-px-3 tw-py-2 md:tw-hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" aria-label="Open admin navigation">
              <Menu aria-hidden="true" />
              <span>Admin navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="tw-w-[min(18rem,85vw)] tw-p-0">
            <SheetHeader className="tw-sr-only">
              <SheetTitle>Admin navigation</SheetTitle>
              <SheetDescription>Choose an admin page from the navigation list.</SheetDescription>
            </SheetHeader>
            <div className="tw-flex tw-h-full tw-min-h-0 tw-flex-col">
              <AdminNavigationSections
                navigation={navigation}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

AdminNavigationSidebar.propTypes = { navigation: navigationPropType };
