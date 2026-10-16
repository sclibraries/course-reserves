import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Index from './Index';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
vi.mock('@/components/dashboard/ReservesTable', () => ({ ReservesTable: () => null }));
vi.mock('@/components/LogoutConfirmDialog', () => ({ LogoutConfirmDialog: () => null }));

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
    act(() => root?.render(<MemoryRouter><Index /></MemoryRouter>));

    expect(container?.textContent).toContain('Submitted');
    expect(container?.textContent).not.toContain('Not Started');
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
