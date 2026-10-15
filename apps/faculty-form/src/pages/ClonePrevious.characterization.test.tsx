import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ENDPOINTS } from '@/config/endpoints';

const pageMocks = vi.hoisted(() => {
  const course = {
    id: 'course-1',
    name: 'Synthetic Ecology',
    courseNumber: 'BIO 220',
    courseListingId: 'listing-1',
    departmentObject: { name: 'Synthetic Biology' },
    courseListingObject: {
      instructorObjects: [{ name: 'Faculty One' }],
      termObject: { name: 'Fall 2025' },
    },
  };
  return {
    course,
    courses: [course],
    addReserve: vi.fn(() => 'new-reserve-1'),
    navigate: vi.fn(),
    searchCoursesByInstructor: vi.fn(),
    clearResults: vi.fn(),
  };
});

vi.mock('react-router-dom', () => ({ useNavigate: () => pageMocks.navigate }));
vi.mock('@/store/courseSearchStore', () => ({
  useCourseSearchStore: () => ({
    loading: false,
    courses: pageMocks.courses,
    searchCoursesByInstructor: pageMocks.searchCoursesByInstructor,
    clearResults: pageMocks.clearResults,
  }),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { full_name: 'Faculty One' }, isAuthenticated: true }),
}));
vi.mock('@/store/termsStore', () => ({
  useTermsStore: () => ({ getNextTermName: () => 'Spring 2100', getCurrentTermName: () => 'Fall 2099' }),
}));
vi.mock('@/store/courseReservesStore', () => ({
  useCourseReservesStore: () => ({ addReserve: pageMocks.addReserve }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }) => <span>{children}</span> }));
vi.mock('@/components/ui/input', () => ({ Input: (props) => <input {...props} /> }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }));
vi.mock('@/components/ui/table', () => ({
  Table: ({ children }) => <div>{children}</div>,
  TableBody: ({ children }) => <>{children}</>,
  TableCell: ({ children }) => <span>{children}</span>,
  TableHead: ({ children }) => <span>{children}</span>,
  TableHeader: ({ children }) => <div>{children}</div>,
  TableRow: ({ children }) => <div>{children}</div>,
}));

import ClonePrevious from './ClonePrevious';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ClonePrevious characterization', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    pageMocks.addReserve.mockClear();
    pageMocks.navigate.mockClear();
    pageMocks.searchCoursesByInstructor.mockClear();
    fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(input).includes('search-course-listings')
        ? { data: { reserves: [{
          id: 'folio-reserve-1',
          copiedItem: {
            title: 'Synthetic Book',
            contributors: [{ name: 'Book Author', primary: true }],
            publication: [{ publisher: 'Test Press', dateOfPublication: '2020' }],
            callNumber: 'QA 76 .N49',
            barcode: 'BC123',
          },
        }] } }
        : { resources: [{
          resource_type: 'electronic',
          id: 'electronic-1',
          title: 'Synthetic Journal Article',
          item_url: 'https://journal.example.test/article',
          description: 'Public description',
          external_note: 'Public note',
          internal_note: 'Staff note',
          folder_name: 'Week 2',
          course_resource_id: 'resource-1',
          order: '0',
        }] },
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('searches, previews, then clones the exact synthetic course resources', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<ClonePrevious />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(pageMocks.searchCoursesByInstructor).toHaveBeenCalledWith('Faculty One');
    const previewButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Preview & Copy'));
    expect(previewButton).toBeDefined();
    await act(async () => {
      previewButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Synthetic Book');
    expect(container.textContent).toContain('Synthetic Journal Article');

    const cloneButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Clone This Course');
    expect(cloneButton).toBeDefined();
    await act(async () => {
      cloneButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const randomSuffix = Math.random().toString(36).substr(2, 9);
    expect(pageMocks.addReserve).toHaveBeenCalledWith({
      courseCode: 'BIO 220',
      courseTitle: 'Synthetic Ecology',
      section: '01',
      instructors: 'Faculty One',
      term: 'Spring 2100',
      status: 'draft',
      items: [
        {
          id: `cloned-book-${Date.now()}-0-${randomSuffix}`,
          title: 'Synthetic Book',
          authors: 'Book Author',
          materialType: 'book',
          status: 'draft',
          priority: 'medium',
          isbn: '',
          publisher: 'Test Press',
          publicationYear: '2020',
          pages: '',
          notes: 'Call Number: QA 76 .N49 | Barcode: BC123',
        },
        {
          id: `cloned-article-${Date.now()}-1-${randomSuffix}`,
          title: 'Synthetic Journal Article',
          materialType: 'article',
          status: 'draft',
          priority: 'medium',
          url: 'https://journal.example.test/article',
          notes: 'Public description | Public note | Staff note | Folder: Week 2',
        },
      ],
    });
    expect(pageMocks.navigate).toHaveBeenCalledWith('/submission/new-reserve-1/edit');

    const expectedUrls = [
      `${API_ENDPOINTS.FOLIO.BASE_URL}${API_ENDPOINTS.FOLIO.SEARCH_COURSE_LISTINGS}?courseListingId=listing-1`,
      `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.GET_MERGED_RESOURCES}?courseListingId=listing-1`,
    ];
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toHaveLength(6);
    expectedUrls.forEach((url) => {
      expect(fetchMock.mock.calls.filter(([input]) => String(input) === url)).toHaveLength(3);
    });
  });
});
