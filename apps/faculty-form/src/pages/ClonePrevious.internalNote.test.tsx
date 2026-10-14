import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pageMocks = vi.hoisted(() => ({
  courses: [{
    id: 'test-api057-course',
    name: 'Synthetic API-057 course',
    courseNumber: 'TEST 057',
    courseListingId: 'test-api057-course-listing',
    departmentObject: { name: 'Synthetic department' },
    courseListingObject: {
      instructorObjects: [{ name: 'Test Faculty' }],
      termObject: { name: 'Fall 2099' },
    },
  }],
  addReserve: vi.fn(() => 'test-api057-new-reserve'),
  navigate: vi.fn(),
  searchCoursesByInstructor: vi.fn(),
  clearResults: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => pageMocks.navigate }));
vi.mock('@/store/courseSearchStore', () => ({
  useCourseSearchStore: () => ({
    loading: false,
    courses: pageMocks.courses,
    searchCoursesByInstructor: pageMocks.searchCoursesByInstructor,
    clearResults: pageMocks.clearResults,
  }),
}));
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { full_name: 'Test Faculty' }, isAuthenticated: true }) }));
vi.mock('@/store/termsStore', () => ({ useTermsStore: () => ({ getNextTermName: () => 'Spring 2100', getCurrentTermName: () => 'Fall 2099' }) }));
vi.mock('@/store/courseReservesStore', () => ({ useCourseReservesStore: () => ({ addReserve: pageMocks.addReserve }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, variant, size, ...props }) => <button {...props}>{children}</button> }));
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

describe('ClonePrevious resource notes', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(input).includes('search-course-listings')
        ? { data: { reserves: [] } }
        : { resources: [{
          id: 'test-api057-resource',
          title: 'Synthetic resource without staff note',
          item_url: 'https://example.test/api057-resource',
          description: 'Public description',
          external_note: 'Public note',
          folder_name: 'Week 1',
        }] },
    })));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('previews a resource without internal_note without showing undefined or crashing', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<ClonePrevious />));
    await act(async () => { await Promise.resolve(); });

    const previewButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Preview & Copy'));
    expect(previewButton).toBeDefined();

    await act(async () => {
      previewButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Synthetic resource without staff note');
    expect(container.textContent).toContain('Public description | Public note | Folder: Week 1');
    expect(container.textContent).not.toContain('undefined');
  });

  it('clones a resource without internal_note without adding undefined to notes', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<ClonePrevious />));
    await act(async () => { await Promise.resolve(); });

    const cloneButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Clone');
    expect(cloneButton).toBeDefined();

    await act(async () => {
      cloneButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(pageMocks.addReserve).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({
        title: 'Synthetic resource without staff note',
        notes: 'Public description | Public note | Folder: Week 1',
      })],
    }));
  });
});
