import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, getByText, waitFor } from '@testing-library/dom';
import { page } from '@vitest/browser/context';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../test/browser';
import CourseRecords from './CourseRecords';
import Search from './Search';
import Searchbar from '../components/layout/Searchbar';
import HorizontalAdminSidebar from '../components/layout/HorizontalAdminSidebar';
import useSearchStore from '../store/searchStore';
import useAdminSearchStore from '../store/adminSearchStore';
import useRecordStore from '../store/recordStore';

const mocks = vi.hoisted(() => ({
  getFolioCourseId: vi.fn(),
  getDepartments: vi.fn(),
  auth: { user: { institution: 'Smith College' }, isAdmin: false },
}));

vi.mock('../services/admin/adminCourseService', () => ({
  adminCourseService: { getFolioCourseId: mocks.getFolioCourseId },
}));
vi.mock('../services/folioSearchService', () => ({
  folioSearchService: { getDepartments: mocks.getDepartments, getInventory: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../hooks/useCourseMaterials', () => ({
  useCourseMaterials: () => ({
    materials: [{ title: 'Previous synthetic course record' }],
    course: [{ name: 'Previous synthetic course' }],
    isLoading: false,
    error: null,
    availability: {},
    hasElectronicReserves: false,
    openAccordions: [],
    toggleAccordion: vi.fn(),
    combinedResults: [],
    hiddenCount: 0,
    visibleCount: 0,
    nextAvailableDate: null,
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFolioCourseId.mockRejectedValue(new Error('Synthetic course lookup failure'));
  mocks.getDepartments.mockResolvedValue({ ok: false, json: async () => ({ data: { departments: [] } }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

async function mount(element) {
  container = document.createElement('main');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(element));
}

async function checkAccessibilityAndReflow() {
  await expectNoAxeViolations(container);
  await expectNoHorizontalOverflow([320, 768, 1280]);
}

function unmount() {
  act(() => root.unmount());
  root = null;
  container.remove();
  container = null;
}

describe('public page load feedback in Chromium', () => {
  it('announces failed course, search, and department loads accessibly at narrow and wide widths', async () => {
    useRecordStore.setState({ record: 'PREVIOUS-SYNTHETIC-RECORD' });
    await mount(createElement(MemoryRouter, { initialEntries: ['/records/synthetic-uuid'] },
      createElement(Routes, null, createElement(Route, { path: '/records/:uuid', element: createElement(CourseRecords) })),
    ));
    await waitFor(() => expect(getByRole(container, 'alert').textContent).toBe('Could not load this course.'));
    expect(container.textContent).not.toContain('Previous synthetic course record');
    await checkAccessibilityAndReflow();
    unmount();

    useSearchStore.setState({
      college: 'smith', type: 'item', query: 'synthetic', department: '', sortOption: '',
      termId: 'SYNTH-TERM', terms: [{ id: 'SYNTH-TERM', name: '2026 Spring' }], displayMode: 'card',
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { reserves: [{
        id: 'SYNTHETIC-PRINT-1', copiedItem: { title: 'Synthetic print result' },
        course: { name: 'Synthetic course', courseNumber: 'SYN 101' },
      }] } }) })
      .mockResolvedValueOnce({ ok: false, status: 503 }));
    await mount(createElement(MemoryRouter, { initialEntries: ['/search?college=smith&type=item&query=synthetic&term=2026-spring'] }, createElement(Search)));
    await waitFor(() => expect(getByRole(container, 'status').textContent).toMatch(/results may be incomplete/i));
    expect(getByRole(container, 'status').compareDocumentPosition(getByText(container, 'Synthetic print result')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await checkAccessibilityAndReflow();
    unmount();

    useSearchStore.setState({ college: 'smith', type: 'all', query: '', department: '', sortOption: '', termId: null, terms: [] });
    useAdminSearchStore.setState({ college: 'smith', terms: [{ id: 'SYNTH-TERM', name: 'Synthetic Term' }], termId: 'SYNTH-TERM' });
    await mount(createElement(MemoryRouter, null, createElement(Searchbar)));
    const widths = [320, 768, 1280];
    for (const width of widths) {
      await page.viewport(width, 900);
      if (width === 320) {
        await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Show advanced filters' })));
      }
      await waitFor(() => expect(getByRole(container, 'alert').textContent.trim()).toBe('Could not load departments.'));
      await expectNoAxeViolations(container);
    }
    await expectNoHorizontalOverflow(widths);
    unmount();

    await mount(createElement(MemoryRouter, null, createElement(HorizontalAdminSidebar)));
    await waitFor(() => expect(getByRole(container, 'alert').textContent.trim()).toBe('Could not load departments.'));
    await checkAccessibilityAndReflow();
  });
});
