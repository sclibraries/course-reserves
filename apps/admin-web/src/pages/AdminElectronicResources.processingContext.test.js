import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getByRole, queryByRole } from '@testing-library/dom';
import { getProcessingContextFromLocation } from './AdminElectronicResources';

const mocks = vi.hoisted(() => ({
  location: { state: null },
  courseService: {
    checkPermanentCourseExists: vi.fn(),
    fetchCourseResources: vi.fn(),
  },
  resourceStore: {
    setResources: vi.fn(),
    clearCourseData: vi.fn(),
    fetchResources: vi.fn(),
    fetchPrintResources: vi.fn(),
    fetchLinkedCourses: vi.fn(),
  },
  courseStore: {
    setCourse: vi.fn(),
    setFolioCourseData: vi.fn(),
    clearCourse: vi.fn(),
    folioCourseData: { id: 'synthetic-folio-course' },
    course: null,
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ folioCourseId: 'synthetic-folio-course' }),
  useNavigate: () => vi.fn(),
  useLocation: () => mocks.location,
}));

vi.mock('../components/page-sections/course-record/api', () => ({
  fetchCourseData: vi.fn().mockResolvedValue([{
    courseListingId: 'synthetic-folio-course',
    courseListingObject: { termObject: { name: '2026 Fall' } },
  }]),
}));

vi.mock('../services/admin/adminCourseService', () => ({
  adminCourseService: mocks.courseService,
}));

vi.mock('../store/adminResourceStore', () => ({
  useAdminResourceStore: () => mocks.resourceStore,
}));

vi.mock('../store/adminCourseStore', () => ({
  useAdminCourseStore: () => mocks.courseStore,
}));

vi.mock('../components/admin/forms/ResourceFormManager', () => ({ default: () => null }));
vi.mock('../hooks/admin/useResourceFormModal', () => ({
  useResourceFormModal: () => ({
    isOpen: false,
    openNewResourceForm: vi.fn(),
    openEDSForm: vi.fn(),
    openHitchcockForm: vi.fn(),
    openReuseForm: vi.fn(),
    openCrosslinkForm: vi.fn(),
    closeModal: vi.fn(),
  }),
}));
vi.mock('../components/page-sections/admin/electronic-resources/AdminCourseHeader', () => ({ default: () => null }));
vi.mock('../components/page-sections/admin/electronic-resources/AdminCoursePermalink', () => ({ default: () => null }));
vi.mock('../components/page-sections/admin/electronic-resources/AdminResourcesTabs', () => ({ default: () => null }));

import AdminElectronicResources from './AdminElectronicResources';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  mocks.location = { state: { processingContext: { itemId: 88 } } };
  mocks.courseService.checkPermanentCourseExists.mockResolvedValue({
    exists: true,
    offeringExists: true,
    course: {},
    offerings: [{ offering_id: 44 }],
    current_offering_id: 44,
    offeringId: 44,
  });
  mocks.courseService.fetchCourseResources.mockResolvedValue({ resources: [] });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

const renderPage = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(AdminElectronicResources));
  });
};

describe('getProcessingContextFromLocation', () => {
  it('returns the processing context from route state when present', () => {
    const context = {
      submissionId: 31,
      itemId: 88,
      folioCourseListingId: 'folio-course-123',
      offeringId: 44,
      canOpenProcessing: true,
    };

    expect(getProcessingContextFromLocation({ state: { processingContext: context } })).toBe(context);
  });

  it('returns null when no route state exists', () => {
    expect(getProcessingContextFromLocation(null)).toBeNull();
    expect(getProcessingContextFromLocation({ state: null })).toBeNull();
  });
});

describe('AdminElectronicResources processing banner', () => {
  it('explains how to add a submission item and has no publish button', async () => {
    await renderPage();

    const banner = getByRole(container, 'alert');
    expect(banner.textContent).toContain('Processing submission item #88.');
    expect(banner.textContent).toContain("Publishing from a submission isn't available yet.");
    expect(banner.textContent).toContain('Add the item to this course with the resource form.');
    expect(queryByRole(banner, 'button', { name: /publish/i })).toBeNull();
  });
});
