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
  adminSearch: {
    college: 'all', type: 'all', query: '', department: '', sort: 'name', termId: null, terms: [],
    fetchTerms: vi.fn(), initializeDefaults: vi.fn(), defaultsSet: true,
    setCollege: vi.fn(), setType: vi.fn(), setQuery: vi.fn(), setDepartment: vi.fn(),
    setSort: vi.fn(), setTermId: vi.fn(),
  },
  courseStore: { fetchResults: vi.fn(), results: [], error: null, loading: false },
  resourceStore: {
    results: [], pagination: {}, error: null, loading: false,
    filters: { name: '', materialTypeId: '', metadata: {}, startDate: '', endDate: '', page: 1, perPage: 20 },
    setSearchResults: vi.fn(), setPagination: vi.fn(), setFilters: vi.fn(), resetFilters: vi.fn(),
  },
  getAllResources: vi.fn().mockResolvedValue([]),
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
vi.mock('../../../services/folioSearchService', () => ({
  folioSearchService: { getDepartments: vi.fn().mockResolvedValue({ json: async () => ({ data: { departments: [] } }) }) },
}));
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
vi.mock('../../../services/admin/adminResourceService', () => ({
  adminResourceService: { getAllResources: mocks.getAllResources, searchResources: vi.fn() },
}));
vi.mock('../../../services/admin/adminMaterialTypeService', () => ({
  adminMaterialTypeService: { getMaterialTypes: vi.fn().mockResolvedValue({ data: [] }) },
}));
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

  it('matches the three-row submissions table at desktop and reflows without overflow', async () => {
    mocks.workflow.submissions = [
      {
        submissionId: 99907809, status: 'submitted', courseCode: 'TST 101', section: '01',
        courseTitle: 'Test Course One', facultyName: 'test-faculty-a', facultyId: 'test-faculty-a',
        term: 'Fall 2026', submittedAt: '2026-10-21T12:00:00Z', totalItems: 11,
        completionPercentage: 0, completeItems: 0, priority: 'normal', isLocked: false,
        communicationsCount: 0, unreadCommunications: 0, assignedTo: null,
      },
      {
        submissionId: 99907810, status: 'in_progress', courseCode: 'NSC 230', section: '01',
        courseTitle: 'Experimental Methods in Neuroscience', facultyName: 'Sandbox Faculty',
        facultyId: 'sandbox-faculty', term: 'Spring 2026', submittedAt: '2026-04-29T12:00:00Z',
        totalItems: 9, completionPercentage: 35, completeItems: 3, priority: 'high', isLocked: false,
        communicationsCount: 1, unreadCommunications: 1, assignedTo: 'test-staff',
      },
      {
        submissionId: 99907811, status: 'submitted', courseCode: 'AFR 175', section: '01',
        courseTitle: 'African Amer Lit 1900-pres', facultyName: 'test-faculty-b', facultyId: 'test-faculty-b',
        term: 'Spring 2026', submittedAt: '2026-04-02T12:00:00Z', totalItems: 1,
        completionPercentage: 100, completeItems: 1, priority: 'urgent', isLocked: true,
        lockedBy: 'test-staff', communicationsCount: 0, unreadCommunications: 0, assignedTo: null,
      },
    ];
    mocks.workflow.pagination = { currentPage: 1, pageCount: 1, perPage: 20, totalCount: 10 };

    await renderRoute('/admin?tab=submissions');

    expect(getByRole(container, 'navigation', { name: 'Admin' })).toBeTruthy();
    const queue = getByRole(container, 'table', { name: 'Faculty submissions' });
    const heading = getByRole(container, 'heading', { name: 'Faculty Submissions' });
    const contentArea = heading.closest('.admin-container').parentElement;
    expect(heading.closest('.admin-container').classList.contains('container-fluid')).toBe(false);
    const rows = getAllByRole(queue, 'row').slice(1);
    expect(rows).toHaveLength(3);
    expect(queue.textContent).toContain('6 days ago');
    expect(queue.textContent).toContain('Apr 29');
    expect(queue.textContent).toContain('Locked by test-staff');
    expect(getAllByRole(rows[0], 'cell')[0].textContent).toContain('Test Course One');
    const details = getAllByRole(rows[1], 'cell')[4].querySelector('.tw-flex-col > .tw-text-xs');
    expect(details.textContent).toContain('Assigned to test-staff');
    expect(details.textContent).toContain('1 unread');
    const fadeIn = queue.closest('.fade-in')?.getAnimations()[0];
    if (fadeIn) await fadeIn.finished;
    await expectNoAxeViolations(queue);
    const viewportMeasurements = [];
    for (const [width, expectedColumns] of [[320, 1], [768, 5], [1280, 5]]) {
      await page.viewport(width, 900);
      expect(details.textContent.trim()).not.toMatch(/^·/);
      const measurement = {
        width,
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
      expect(measurement.innerWidth, `${width}px viewport`).toBe(width);
      expect(measurement.scrollWidth, `${width}px page scroll width`).toBeLessThanOrEqual(measurement.innerWidth);
      viewportMeasurements.push(measurement);
      const headingLeft = heading.getBoundingClientRect().left;
      const contentRect = contentArea.getBoundingClientRect();
      expect(headingLeft, `${width}px heading left`).toBeGreaterThanOrEqual(contentRect.left + 16);
      expect(headingLeft, `${width}px heading inside viewport`).toBeGreaterThanOrEqual(0);
      expect(contentRect.left, `${width}px content left`).toBeGreaterThanOrEqual(0);
      expect(contentRect.right, `${width}px content right`).toBeLessThanOrEqual(width);
      const template = getComputedStyle(rows[0]).gridTemplateColumns;
      const columnCount = template === 'none' ? 0 : template.trim().split(/\s+/).length;
      expect(columnCount, `${width}px row layout: ${template}; classes: ${rows[0].className}`).toBe(expectedColumns);
    }
    expect(viewportMeasurements.map(({ innerWidth, scrollWidth }) => `${scrollWidth} <= ${innerWidth}`))
      .toEqual(['320 <= 320', '768 <= 768', '1280 <= 1280']);
    const statusCell = getAllByRole(rows[0], 'cell')[4];
    const statusChip = statusCell.querySelector('.tw-rounded-full');
    const track = getByRole(getAllByRole(rows[0], 'cell')[3], 'progressbar');
    const card = queue.closest('.tw-overflow-hidden');
    expect(getComputedStyle(statusChip).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(statusChip).borderWidth).toBe('0px');
    expect(getComputedStyle(track).height).toBe('6px');
    expect(getComputedStyle(track).borderWidth).toBe('0px');
    expect(getComputedStyle(track).backgroundColor).toBe(getComputedStyle(card).borderTopColor);
    await page.screenshot({ path: '../../../../dist/test-results/AW-071-fr2-queue-1280.png' });
  });

  it.each([
    ['/admin?tab=courses', 'Course Management'],
    ['/admin?tab=resources', 'Resource Management'],
  ])('keeps the %s tab on the page background', async (path, title) => {
    await renderRoute(path);

    const heading = getByRole(container, 'heading', { name: title });
    const adminContent = heading.closest('.admin-container');
    expect(adminContent).toBeTruthy();
    expect(getComputedStyle(adminContent).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(adminContent).paddingBottom).toBe('0px');
    await page.viewport(1280, 900);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
