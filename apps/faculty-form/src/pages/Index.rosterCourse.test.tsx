import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Index from './Index';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

const mocks = vi.hoisted(() => ({
  reserveState: {
    reserves: [] as Array<Record<string, unknown>>,
    getReserveStats: () => ({ totalItems: 0, completeItems: 0, inProgressItems: 0, needsReviewItems: 0 }),
    initialize: vi.fn(),
    fetchSubmissions: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    addReserve: vi.fn(() => 'new-reserve'),
  },
  assignments: [] as Array<Record<string, unknown>>,
}));

vi.hoisted(() => {
  const values: Record<string, string> = {};
  // @ts-expect-error - vitest exposes vi while evaluating hoisted mocks
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
  });
});

vi.mock('../store/courseReservesStore', () => ({
  useCourseReservesStore: () => mocks.reserveState,
}));
vi.mock('../store/termsStore', () => ({
  useTermsStore: () => ({
    getCurrentTermName: () => 'Spring 2027',
    refreshTermsIfStale: vi.fn(),
    loading: false,
  }),
}));
vi.mock('../store/authStore', () => ({
  getAuthHeaders: () => ({}),
  useAuthStore: () => ({
    user: { id: 'test-faculty', display_name: 'Test Faculty' },
    isAuthenticated: true,
    initializeFromCookie: vi.fn(),
    logout: vi.fn(),
  }),
}));
vi.mock('../store/draftStore', () => ({
  useDraftStore: () => ({ hasUnsavedChanges: {}, getDraft: vi.fn() }),
}));
vi.mock('@/hooks/useUnsavedChangesWarning', () => ({ useHasAnyUnsavedChanges: () => false }));
vi.mock('@/hooks/useDashboardCourseAssignments', () => ({
  useDashboardCourseAssignments: () => ({ assignments: mocks.assignments, loading: false, error: null }),
}));
vi.mock('@/components/dashboard/DashboardHeader', () => ({ DashboardHeader: () => null }));
vi.mock('@/components/LogoutConfirmDialog', () => ({ LogoutConfirmDialog: () => null }));
vi.mock('@/hooks/useLegacyDraftUpload', () => ({ useLegacyDraftUpload: vi.fn() }));

describe('Index roster course matching', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    const apiIndexItem = {
      submission_uuid: 'submission-test-1',
      its_course_id: 'BIO-101-01-202702',
      academic_period: 'AP_202702',
      course_code: 'BIO 101',
      course_title: 'Synthetic Biology',
      section: '01',
      faculty_display_name: 'Test Faculty',
      term_code: 'Spring 2027',
      status: 'submitted',
      updated_at: '2026-08-01T12:00:00Z',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [apiIndexItem] }),
    }));
    vi.resetModules();
    const { useReserveStore } = await import('@/store/useReserveStore');
    useReserveStore.setState({ reserves: [] });
    await useReserveStore.getState().fetchSubmissions();
    mocks.reserveState.reserves = useReserveStore.getState().reserves as unknown as Array<Record<string, unknown>>;
    mocks.assignments = [{
      assignment: {
        academic_period: 'AP_202702',
        course_id: 'BIO-101-01-202702',
        course_title: 'Synthetic Biology',
      },
      parsed_course: { courseNumber: 'BIO 101', sectionName: '01', raw: 'BIO 101-01' },
      folio_term: { id: 'term-test-1', name: 'Spring 2027', startDate: '', endDate: '' },
      folio_course: { name: 'Synthetic Biology' },
    }];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.unstubAllGlobals();
  });

  it('shows the mocked reloaded submission as submitted for its ITS roster course', () => {
    act(() => root?.render(<MemoryRouter><Index /><LocationProbe /></MemoryRouter>));

    expect(container?.textContent).toContain('Submitted');
    expect(container?.textContent).not.toContain('Not Started');
  });

  it('lists a server draft after the browser reserve storage was cleared', async () => {
    const serverDraft = {
      submission_uuid: 'server-draft-1',
      its_course_id: 'BIO-101-01-202702',
      academic_period: 'AP_202702',
      course_code: 'BIO 101',
      course_title: 'Synthetic Biology',
      section: '01',
      faculty_display_name: 'Test Faculty',
      term_code: 'Spring 2027',
      status: 'draft',
      draft_version: 2,
      updated_at: '2026-10-20T12:00:00Z',
      folders: [],
      unfoldered_items: [{ id: 4, title: 'Server saved item', material_type: 'book', status: 'draft', display_order: 0 }],
    };
    localStorage.clear();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [serverDraft] }),
    } as Response);
    const { useReserveStore } = await import('@/store/useReserveStore');
    useReserveStore.setState({ reserves: [] });
    await useReserveStore.getState().fetchSubmissions();
    mocks.reserveState.reserves = useReserveStore.getState().reserves as unknown as Array<Record<string, unknown>>;
    mocks.assignments = [];

    act(() => root?.render(<MemoryRouter><Index /><LocationProbe /></MemoryRouter>));

    expect(container?.textContent).toContain('Draft');
    expect(container?.textContent).toContain('BIO 101');
    expect(container?.textContent).toContain('Edit');
    const editButton = Array.from(container?.querySelectorAll('button') || [])
      .find((button) => button.textContent?.trim() === 'Edit');
    act(() => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container?.querySelector('[data-testid="pathname"]')?.textContent)
      .toBe('/submission/server-draft-1/edit');
  });
});

function makeLocalStorageMock() {
  const values: Record<string, string> = {};
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
  };
}
