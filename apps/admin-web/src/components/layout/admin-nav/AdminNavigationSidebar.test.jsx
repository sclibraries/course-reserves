import { act, useState } from 'react';
import PropTypes from 'prop-types';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';
import { createAdminTabRegistry, getVisibleAdminGroups } from '../../../pages/adminTabRegistry';
import AdminNavigationSidebar from './AdminNavigationSidebar';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const registry = createAdminTabRegistry({
  canManageCourses: true,
  canManageResources: true,
  canManageSubmissions: true,
  canViewReports: true,
  canManageWorkflows: true,
  canCustomize: true,
  isAdmin: true,
  canManageProxyAccess: true,
});

let container;
let root;
let navigation;

function Harness({ collapsed = false, pins = ['my-work'], statusMessage = '', saveError = '' }) {
  const [isCollapsed, setCollapsed] = useState(collapsed);
  navigation = {
    activeTab: 'my-work',
    counts: { 'my-work': 2, submissions: 3, mentions: 4 },
    isCollapsed,
    isPinLimitReached: pins.length >= 10,
    isSaving: false,
    pins,
    pinsLoaded: true,
    pinnedTabs: pins.map((key) => registry.tabs.find((tab) => tab.key === key)).filter(Boolean),
    resetPins: vi.fn(),
    saveError,
    setCollapsed,
    statusMessage,
    tabRegistry: registry,
    togglePin: vi.fn(),
    visibleGroups: getVisibleAdminGroups(registry),
  };
  return <AdminNavigationSidebar navigation={navigation} />;
}
Harness.propTypes = {
  collapsed: PropTypes.bool,
  pins: PropTypes.arrayOf(PropTypes.string),
  statusMessage: PropTypes.string,
  saveError: PropTypes.string,
};

async function render(props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <MemoryRouter initialEntries={['/admin?tab=my-work']}>
      <Harness {...props} />
    </MemoryRouter>,
  ));
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('AdminNavigationSidebar', () => {
  it('shows grouped links, a current-page state, text badges, and named pin toggles', async () => {
    await render({ pins: [] });
    const nav = getByRole(container, 'navigation', { name: 'Admin' });

    expect(getByRole(nav, 'heading', { name: 'My work' })).toBeTruthy();
    expect(getByRole(nav, 'link', { name: /My Work Queue/ }).getAttribute('aria-current')).toBe('page');
    expect(getByRole(nav, 'link', { name: /Submissions Queue, 3 items/ }).textContent).toContain('3');
    expect(getByRole(nav, 'button', { name: 'Pin My Work Queue' }).getAttribute('aria-pressed')).toBe('false');
    expect(queryByRole(nav, 'heading', { name: 'Settings' })).toBeTruthy();
    await act(async () => fireEvent.click(getByRole(nav, 'button', { name: 'Reset to defaults' })));
    expect(navigation.resetPins).toHaveBeenCalledOnce();

    await act(async () => fireEvent.click(getByRole(nav, 'button', { name: 'Pin My Work Queue' })));
    expect(navigation.togglePin).toHaveBeenCalledWith('my-work');
  });

  it('announces pin changes and save failures with live regions', async () => {
    await render({ statusMessage: 'My Items pinned.', saveError: 'Could not save your pinned pages. Your previous pins were restored.' });

    expect(getByRole(container, 'status').textContent).toBe('My Items pinned.');
    expect(getByRole(container, 'alert').textContent).toBe('Could not save your pinned pages. Your previous pins were restored.');
  });

  it('disables additional pinning at ten and provides the limit reason', async () => {
    await render({ pins: Array.from({ length: 10 }, (_, index) => `unknown-${index}`) });
    const button = getByRole(container, 'button', { name: 'Pin My Work Queue' });

    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain('You can pin up to 10 pages.');
  });

  it('expands from a rail group icon and moves focus to that group heading', async () => {
    await render({ collapsed: true });
    const groupButton = getByRole(container, 'button', { name: 'Open Team queues section' });

    await act(async () => fireEvent.click(groupButton));

    expect(navigation.isCollapsed).toBe(false);
    expect(document.activeElement.id).toBe('admin-nav-group-team-queues');
  });
});
