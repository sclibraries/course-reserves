import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { page } from '@vitest/browser/context';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../../test/browser';
import Layout from '../../../layout/Layout';
import '../../../../css/App.css';

const mocks = vi.hoisted(() => ({
  setCollege: vi.fn(),
  navigation: {
    counts: {},
    isCollapsed: true,
    pinnedTabs: [],
    setCollapsed: vi.fn(),
    visibleGroups: [],
  },
}));

vi.mock('../../../layout/AppRoutes', async () => {
  const { createElement } = await import('react');
  const { Route, Routes } = await import('react-router-dom');
  const { default: AdminLayout } = await import('../../../layout/AdminLayout');

  return {
    default: function TestRoutes() {
      return createElement(
        Routes,
        null,
        createElement(
          Route,
          { path: '/admin', element: createElement(AdminLayout) },
          createElement(Route, {
            path: 'submissions/:submissionId',
            element: createElement('div', null, 'Submission details'),
          }),
        ),
        createElement(Route, {
          path: '/search',
          element: createElement('div', null, 'Search results'),
        }),
      );
    },
  };
});
vi.mock('../../../layout/Searchbar', async () => {
  const { createElement } = await import('react');
  return { default: () => createElement('div', { 'data-testid': 'searchbar' }) };
});
vi.mock('../../../ui/LoginButton', () => ({ default: () => null }));
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
vi.mock('../../../../hooks/useUnreadMessages', () => {
  const useUnreadMessages = () => ({ unreadCount: 0 });
  return { default: useUnreadMessages, useUnreadMessages };
});
vi.mock('../../../../hooks/admin/useAdminNavigation', async (importOriginal) => ({
  ...await importOriginal(),
  useAdminNavigation: () => mocks.navigation,
}));
vi.mock('../../../../store/customizationStore', () => ({
  default: (selector) => selector({
    currentCollege: 'default',
    getCustomizationForCollege: () => ({}),
  }),
}));
vi.mock('../../../../store/searchStore', () => ({
  default: (selector) => selector({ setCollege: mocks.setCollege }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('admin route viewport layout in Chromium', () => {
  let container;
  let root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  async function mountRoute(path) {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <MemoryRouter initialEntries={[path]}>
        <Layout />
      </MemoryRouter>,
    ));
  }

  it('runs admin edge to edge below the 5rem header and preserves the public frame', async () => {
    await page.viewport(1280, 900);
    await mountRoute('/admin/submissions/31');

    const header = container.querySelector('header .navbar');
    const main = container.querySelector('#main-content');
    const sidebar = container.querySelector('[aria-label="Admin navigation panel"]');
    const content = container.querySelector('[data-testid="admin-layout-content"]');
    expect(header.getBoundingClientRect().height).toBe(80);
    expect(sidebar.getBoundingClientRect().left).toBe(0);
    expect(getComputedStyle(sidebar).top).toBe('80px');
    expect(content.getBoundingClientRect().right).toBe(window.innerWidth);
    expect(content.getBoundingClientRect().top).toBe(header.getBoundingClientRect().height);
    expect(main.getBoundingClientRect().top + parseFloat(getComputedStyle(main).paddingTop))
      .toBe(header.getBoundingClientRect().height);
    await expectNoHorizontalOverflow([1280]);
    await expectNoAxeViolations(container);

    await page.viewport(320, 900);
    expect(header.getBoundingClientRect().height).toBe(80);
    expect(content.getBoundingClientRect().right).toBe(window.innerWidth);
    expect(content.getBoundingClientRect().top).toBe(header.getBoundingClientRect().height);
    await expectNoHorizontalOverflow([320]);
    await expectNoAxeViolations(container);

    act(() => root.unmount());
    container.remove();
    root = null;
    container = null;

    await page.viewport(1280, 900);
    await mountRoute('/search');
    expect(container.querySelector('#main-content').getBoundingClientRect().left).toBe(32);
    expect(container.querySelector('[data-testid="searchbar"]').getBoundingClientRect().left).toBe(32);
    await expectNoHorizontalOverflow([1280]);
    await expectNoAxeViolations(container);
  });
});
