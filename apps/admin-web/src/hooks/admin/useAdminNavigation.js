import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadMessages } from '../useUnreadMessages';
import useSubmissionWorkflowStore from '../../store/submissionWorkflowStore';
import { MAX_NAV_PINS, navPinsService } from '../../services/admin/navPinsService';
import {
  canAccessProxyTab,
  createAdminTabRegistry,
  getAdminTab,
  getAdminTabForPath,
  getDefaultAdminTab,
  getVisibleAdminGroups,
  hasAdminTabAccess,
} from '../../pages/adminTabRegistry';

export const NAV_COLLAPSED_KEY = 'admin-navigation-collapsed';
export const ELECTRONIC_NAV_COLLAPSED_KEY = 'admin-navigation-electronic-collapsed';
export const SUBMISSION_NAV_COLLAPSED_KEY = 'admin-navigation-submissions-collapsed';
const SAVE_ERROR = 'Could not save your pinned pages. Your previous pins were restored.';
const ROUTE_COLLAPSE_SETTINGS = [
  { routePrefix: '/admin/electronic/', key: ELECTRONIC_NAV_COLLAPSED_KEY, defaultCollapsed: true },
  { routePrefix: '/admin/submissions/', key: SUBMISSION_NAV_COLLAPSED_KEY, defaultCollapsed: true },
];

function getRouteCollapseSettings(pathname) {
  return ROUTE_COLLAPSE_SETTINGS.find(({ routePrefix }) => pathname.startsWith(routePrefix))
    || { key: NAV_COLLAPSED_KEY, defaultCollapsed: false };
}

function readCollapsed(key, defaultValue) {
  try {
    const value = globalThis.localStorage.getItem(key);
    return value === null ? defaultValue : value === 'true';
  } catch {
    return defaultValue;
  }
}

function writeCollapsed(key, value) {
  try {
    globalThis.localStorage.setItem(key, String(value));
  } catch {
    // Navigation remains usable when browser storage is disabled.
  }
}

export function useAdminNavigation() {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const workflow = useSubmissionWorkflowStore();
  const { fetchPendingSubmissions, fetchClaimedItems } = workflow;
  const { unreadCount } = useUnreadMessages(30000, isAuthenticated);
  const [pins, setPins] = useState([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const collapseSettings = getRouteCollapseSettings(location.pathname);
  const { key: collapsedKey, defaultCollapsed } = collapseSettings;
  const [isCollapsed, setIsCollapsed] = useState(() => readCollapsed(collapsedKey, defaultCollapsed));
  const previousCollapsedKey = useRef(collapsedKey);

  const permissions = user?.permissions || [];
  const canManageCourses = isAdmin || permissions.includes('manage_courses');
  const canManageResources = isAdmin || permissions.includes('manage_resources');
  const canManageSubmissions = isAdmin || permissions.includes('manage_submissions');
  const canViewReports = isAdmin || permissions.includes('view_reports');
  const canCustomize = isAdmin || permissions.some((permission) => permission.startsWith('customize_'));
  const tabRegistry = useMemo(() => createAdminTabRegistry({
    canManageCourses,
    canManageResources,
    canManageSubmissions,
    canViewReports,
    canManageWorkflows: isAdmin,
    canCustomize,
    isAdmin,
    canManageProxyAccess: canAccessProxyTab(user?.role),
  }), [
    canManageCourses, canManageResources, canManageSubmissions, canViewReports,
    canCustomize, isAdmin, user?.role,
  ]);

  const counts = {
    'my-work': workflow.claimedItems?.length || 0,
    submissions: workflow.pagination?.totalCount || 0,
    mentions: unreadCount || 0,
  };
  const visibleGroups = getVisibleAdminGroups(tabRegistry);
  const pinnedTabs = pins.map((key) => getAdminTab(tabRegistry, key))
    .filter((tab) => tab?.canAccess);
  const isPinLimitReached = pins.length >= MAX_NAV_PINS;
  const routeTab = getAdminTabForPath(location.pathname);
  const requestedTab = searchParams.get('tab');
  const requestedDefinition = getAdminTab(tabRegistry, requestedTab);
  const fallbackTab = getDefaultAdminTab(tabRegistry);
  const activeTab = routeTab || (requestedDefinition?.canAccess ? requestedTab : fallbackTab);

  useEffect(() => {
    if (canManageSubmissions) {
      fetchPendingSubmissions(1, 20);
      fetchClaimedItems();
    }
  }, [canManageSubmissions, fetchPendingSubmissions, fetchClaimedItems]);

  useEffect(() => {
    let mounted = true;
    navPinsService.getPins()
      .then((response) => {
        if (mounted) setPins(response.pins);
      })
      .catch(() => {
        if (mounted) setSaveError('Could not load your pinned pages.');
      })
      .finally(() => {
        if (mounted) setPinsLoaded(true);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (previousCollapsedKey.current !== collapsedKey) {
      previousCollapsedKey.current = collapsedKey;
      setIsCollapsed(readCollapsed(collapsedKey, defaultCollapsed));
      return;
    }
    writeCollapsed(collapsedKey, isCollapsed);
  }, [collapsedKey, defaultCollapsed, isCollapsed]);

  useEffect(() => {
    if (location.pathname !== '/admin') return;
    if (!requestedTab || requestedDefinition?.canAccess) return;
    const next = new URLSearchParams(searchParams);
    if (fallbackTab) next.set('tab', fallbackTab);
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [
    location.pathname, requestedTab, requestedDefinition?.canAccess,
    fallbackTab, searchParams, setSearchParams,
  ]);

  const savePins = useCallback(async (request, successMessage) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError('');
    setStatusMessage('');
    try {
      const response = await request();
      setPins(response.pins);
      setStatusMessage(successMessage);
      return true;
    } catch {
      setPins(pins);
      setStatusMessage('');
      setSaveError(SAVE_ERROR);
      return false;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [pins]);

  const togglePin = useCallback((key) => {
    const isPinned = pins.includes(key);
    if (!isPinned && isPinLimitReached) return Promise.resolve(false);
    const nextPins = isPinned ? pins.filter((pin) => pin !== key) : [...pins, key];
    setPins(nextPins);
    const label = getAdminTab(tabRegistry, key)?.label || 'Page';
    return savePins(() => navPinsService.savePins(nextPins), `${label} ${isPinned ? 'unpinned' : 'pinned'}.`);
  }, [pins, isPinLimitReached, tabRegistry, savePins]);

  const resetPins = useCallback(
    () => savePins(() => navPinsService.resetPins(), 'Pins reset to defaults.'),
    [savePins],
  );

  return {
    activeTab,
    counts,
    hasAccess: hasAdminTabAccess(tabRegistry),
    isCollapsed,
    isPinLimitReached,
    isSaving,
    pins,
    pinsLoaded,
    pinnedTabs,
    resetPins,
    saveError,
    setCollapsed: setIsCollapsed,
    statusMessage,
    tabRegistry,
    togglePin,
    visibleGroups,
  };
}
