import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cloneMocks = vi.hoisted(() => ({
  fetchCourseResources: vi.fn(),
  fetchPreviousCourses: vi.fn(),
}));

vi.mock('@/hooks/useCourseCloning', () => ({
  useCourseCloning: () => ({
    loadingPreviousCourses: false,
    hasLoadedPreviousCourses: true,
    loadingOtherCourses: false,
    previousCourses: [{
      courseListingId: 'test-api057-course',
      courseNumber: 'TEST 057',
      courseName: 'Synthetic API-057 course',
      term: 'Fall 2099',
      instructor: 'Test Faculty',
      resourceCount: 1,
      electronicCount: 1,
      physicalCount: 0,
      isExactMatch: true,
    }],
    cloningFromCourse: null,
    fetchCourseResources: cloneMocks.fetchCourseResources,
    fetchPreviousCourses: cloneMocks.fetchPreviousCourses,
  }),
}));

vi.mock('./CourseListView', () => ({
  CourseListView: ({ previousCourses, onPreviewCourse }) => (
    <button type="button" onClick={() => onPreviewCourse(previousCourses[0])}>Preview course</button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogDescription: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/ui/card', () => ({ Card: ({ children }) => <div>{children}</div> }));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }) => <span>{children}</span> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CloneDialog } from '../CloneDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CloneDialog resource notes', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    cloneMocks.fetchCourseResources.mockResolvedValue({
      physicalReserves: [],
      electronicResources: [{
        id: 'test-api057-resource',
        title: 'Synthetic resource without staff note',
        description: 'Public description',
        external_note: 'Public note',
        folder_name: 'Week 1',
      }],
    });
    cloneMocks.fetchPreviousCourses.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('previews a resource without internal_note without showing undefined or crashing', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(
      <CloneDialog
        open={true}
        onOpenChange={() => {}}
        reserveId="test-api057-reserve"
        courseCode="TEST 057"
        userName="Test Faculty"
        currentItemsCount={0}
        onAddResource={() => {}}
      />
    ));

    await act(async () => {
      container?.querySelector('button')?.click();
      await cloneMocks.fetchCourseResources.mock.results[0]?.value;
    });

    expect(container?.textContent).toContain('Synthetic resource without staff note');
    expect(container?.textContent).toContain('Public description');
    expect(container?.textContent).toContain('Public note | Folder: Week 1');
    expect(container?.textContent).not.toContain('undefined');
  });
});
