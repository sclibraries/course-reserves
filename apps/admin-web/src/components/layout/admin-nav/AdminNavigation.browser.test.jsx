import 'bootstrap/dist/css/bootstrap.min.css';
import '../../../index.css';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { getAllByRole, getByRole } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../test/browser';

const mocks = vi.hoisted(() => ({
  auth: { user: { role: 'admin', permissions: [] }, isAdmin: true, isAuthenticated: true },
  workflow: {
    submissions: [], loading: false, error: null,
    pagination: { currentPage: 1, pageCount: 1, perPage: 20, totalCount: 3 },
    claimedItems: [{ id: 1 }, { id: 2 }],
    fetchPendingSubmissions: vi.fn(), fetchClaimedItems: vi.fn(), setPage: vi.fn(), clearError: vi.fn(),
  },
  adminSearch: { fetchTerms: vi.fn(), initializeDefaults: vi.fn(), defaultsSet: true },
  courseStore: { fetchResults: vi.fn(), results: [], error: null, loading: false },
  resourceStore: { results: [], pagination: {}, error: null, loading: false, setSearchResults: vi.fn() },
  getPins: vi.fn(),
  savePins: vi.fn(),
  resetPins: vi.fn(),
}));

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../../hooks/useTermSetup', () => ({ default: () => ({ loading: false, error: null }) }));
vi.mock('../../../hooks/useUnreadMessages', () => ({
  useUnreadMessages: () => ({ unreadCount: 4 }),
  default: () => ({ unreadCount: 4 }),
}));
vi.mock('../../../store/submissionWorkflowStore', () => ({ default: () => mocks.workflow }));
vi.mock('../../../store/adminSearchStore', () => ({ default: () => mocks.adminSearch }));
vi.mock('../../../store', () => ({ default: () => mocks.courseStore }));
vi.mock('../../../store/resourceSearchStore', () => ({ default: () => mocks.resourceStore }));
vi.mock('../../../hooks/useBuildQuery', () => ({ useBuildQuery: () => '' }));
vi.mock('../../../hooks/useCurrentTermId', () => ({ useCurrentTermId: () => ({ termId: null, loading: false }) }));
vi.mock('../../../services/admin/navPinsService', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    navPinsService: {
      getPins: mocks.getPins,
      savePins: mocks.savePins,
      resetPins: mocks.resetPins,
    },
  };
});
vi.mock('../../../services/admin/adminResourceService', () => ({ adminResourceService: { getAllResources: vi.fn() } }));
vi.mock('../../../components/page-sections/admin/MyWorkQueue', () => ({ default: () => <h1>Admin home fixture</h1> }));
vi.mock('../../../pages/WorkQueueDetail', () => ({ default: () => <h1>Work queue detail fixture</h1> }));

import AppRoutes from '../AppRoutes';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function renderRoute(path) {
  localStorage.removeItem('admin-navigation-collapsed');
  localStorage.removeItem('admin-navigation-electronic-collapsed');
  await page.viewport(1280, 900);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.getPins.mockReset().mockResolvedValue({ pins: ['my-work'], is_default: false, defaults: ['my-work'] });
  await act(async () => root.render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  ));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

async function measureAllWidths() {
  await expectNoHorizontalOverflow([320, 768, 1280]);
  await page.viewport(1280, 900);
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('admin navigation in Chromium', () => {
  it('reflows expanded, collapsed, and mobile Sheet navigation with no overflow or axe issues', async () => {
    await renderRoute('/admin');
    expect(container.textContent).toContain('Admin home fixture');
    const adminNav = getByRole(container, 'navigation', { name: 'Admin' });
    expect(getAllByRole(adminNav, 'link', { name: /My Work Queue/ })
      .every((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    await expectNoAxeViolations(document.body);
    await measureAllWidths();

    const collapse = getByRole(container, 'button', { name: 'Collapse admin navigation' });
    await act(async () => collapse.click());
    expect(getByRole(container, 'button', { name: 'Expand admin navigation' }).getAttribute('aria-expanded')).toBe('false');
    await expectNoAxeViolations(document.body);
    await measureAllWidths();

    const railLink = getByRole(container, 'link', { name: /My Work Queue/ });
    expect(railLink.getAttribute('aria-label')).toBe('My Work Queue, 2 items');
    await act(async () => {
      railLink.focus();
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(getByRole(document.body, 'tooltip', { name: 'My Work Queue' })).toBeTruthy();
    await expectNoAxeViolations(document.body);
    await act(async () => {
      railLink.blur();
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    await page.viewport(320, 900);
    const menu = getByRole(container, 'button', { name: 'Open admin navigation' });
    await act(async () => menu.click());
    expect(getByRole(document.body, 'dialog', { name: 'Admin navigation' })).toBeTruthy();
    await expectNoAxeViolations(document.body);
    await expectNoHorizontalOverflow([320]);
    expect(document.activeElement.closest('[role="dialog"]')).toBeTruthy();
    await act(async () => getByRole(document.body, 'button', { name: 'Close' }).click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(document.activeElement).toBe(menu);
  });

  it('marks the parent entry current on a detail route', async () => {
    await renderRoute('/admin/work-queue/31');
    expect(container.textContent).toContain('Work queue detail fixture');
    const adminNav = getByRole(container, 'navigation', { name: 'Admin' });
    expect(getAllByRole(adminNav, 'link', { name: /My Work Queue/ })
      .every((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    await expectNoAxeViolations(document.body);
    await measureAllWidths();
  });

  it('keeps the submissions queue readable beside navigation at narrow widths', async () => {
    mocks.workflow.submissions = [{
      submissionId: 99907809,
      status: 'submitted',
      courseCode: 'LONG 999',
      section: '99',
      courseTitle: 'SyntheticQueueTitleThatIsIntentionallyAnUnbrokenWordToCheckResponsiveWrappingWithoutRealCourseData',
      facultyName: 'Synthetic Faculty',
      term: '2026FA',
      submittedAt: '2026-10-20T12:00:00Z',
      totalItems: 3,
      completionPercentage: 33,
      completeItems: 1,
      priority: 'high',
      isLocked: false,
      lockedBy: null,
      communicationsCount: 0,
      unreadCommunications: 0,
      assignedTo: null,
    }];
    mocks.workflow.pagination = { currentPage: 1, pageCount: 1, perPage: 20, totalCount: 1 };

    await renderRoute('/admin?tab=submissions');

    expect(getByRole(container, 'navigation', { name: 'Admin' })).toBeTruthy();
    const queue = getByRole(container, 'table', { name: 'Faculty submissions' });
    const row = getAllByRole(queue, 'row')[1];
    expect(queue.textContent).toContain('SyntheticQueueTitleThatIsIntentionallyAnUnbrokenWordToCheckResponsiveWrappingWithoutRealCourseData');
    const fadeIn = queue.closest('.fade-in')?.getAnimations()[0];
    if (fadeIn) await fadeIn.finished;
    await expectNoAxeViolations(document.body);
    for (const [width, expectedColumns] of [[320, 1], [768, 5], [1280, 5]]) {
      await page.viewport(width, 900);
      const template = getComputedStyle(row).gridTemplateColumns;
      const columnCount = template === 'none' ? 0 : template.trim().split(/\s+/).length;
      expect(columnCount, `${width}px row layout: ${template}; classes: ${row.className}`).toBe(expectedColumns);
    }
    await measureAllWidths();
  });
});
