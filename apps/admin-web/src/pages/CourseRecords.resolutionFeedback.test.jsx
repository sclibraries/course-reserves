import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getByRole, queryByText } from '@testing-library/dom';
import CourseRecords from './CourseRecords';

const mocks = vi.hoisted(() => ({
  params: {},
  location: { search: '', pathname: '/course/synthetic', hash: '' },
  getFolioCourseId: vi.fn(),
  setRecord: vi.fn(),
  fetch: vi.fn(),
  materialTitle: 'Stale synthetic course material',
  materialsView: ({ materials }) => materials[0]?.title,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useLocation: () => mocks.location,
    useNavigate: () => vi.fn(),
    useParams: () => mocks.params,
  };
});
vi.mock('../store/recordStore', () => ({
  default: () => ({ record: 'previous-record', setRecord: mocks.setRecord }),
}));
vi.mock('../store/customizationStore', () => {
  const customization = {
    cardTextColor: '#111', buttonSecondaryColor: '#222', discoverLinkBaseUrl: 'https://example.test',
    buttonPrimaryColor: '#333',
  };
  return {
    default: Object.assign(() => customization, {
      getState: () => ({
        getCustomization: () => customization,
        getCustomizationByReserve: () => customization,
        getCustomizationForCollege: () => customization,
      }),
    }),
  };
});
vi.mock('../services/admin/adminCourseService', () => ({
  adminCourseService: { getFolioCourseId: mocks.getFolioCourseId },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../store/recordsTextStore', () => ({
  useRecordsTextStore: () => ({}),
  selectCourseRecordsText: () => ({}),
}));
vi.mock('../hooks/useCourseMaterials', () => ({
  useCourseMaterials: () => ({
    materials: [{ title: mocks.materialTitle }], course: [], isLoading: false, error: null,
    availability: {}, hasElectronicReserves: false, openAccordions: [], toggleAccordion: vi.fn(),
    combinedResults: [], hiddenCount: 0, visibleCount: 0, nextAvailableDate: null,
  }),
}));
vi.mock('../components/page-sections/course-record/CourseHeader', () => ({ default: () => null }));
vi.mock('../components/page-sections/course-record/ViewControls', () => ({ default: () => null }));
vi.mock('../components/page-sections/course-record/MaterialsDisplay', () => ({ default: mocks.materialsView }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.params = {};
  mocks.fetch.mockResolvedValue({ ok: false, status: 503 });
  mocks.getFolioCourseId.mockResolvedValue({ exists: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

async function renderCourse(params) {
  mocks.params = params;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(CourseRecords));
    await Promise.resolve();
  });
}

describe('CourseRecords resolution feedback', () => {
  it.each([
    ['unresolved UUID', { uuid: 'synthetic-uuid' }],
    ['failed course-code lookup', { courseCode: 'SYN-101' }],
  ])('shows an alert instead of the prior record after an %s', async (_label, params) => {
    await renderCourse(params);

    expect(getByRole(container, 'alert').textContent).toBe('Could not load this course.');
    expect(queryByText(container, mocks.materialTitle)).toBeNull();
  });
});
