import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const duplicateMocks = vi.hoisted(() => ({
  fetchCourseResources: vi.fn(),
  fetchPreviousCourses: vi.fn(),
}));

vi.mock('@/hooks/useCourseCloning', () => ({ useCourseCloning: () => duplicateMocks }));
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children }) => <button type="button">{children}</button>,
  AlertDialogContent: ({ children }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }) => <h2>{children}</h2>,
}));
vi.mock('@/components/ui/checkbox', () => ({ Checkbox: () => <input type="checkbox" /> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import DuplicateDialog from './DuplicateDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DuplicateDialog resource notes', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const updateReserve = vi.fn();
  const confirmDuplicateSubmit = vi.fn();

  beforeEach(() => {
    duplicateMocks.fetchPreviousCourses.mockResolvedValue([{
      courseListingId: 'test-api057-course-listing',
    }]);
    duplicateMocks.fetchCourseResources.mockResolvedValue({
      physicalReserves: [],
      electronicResources: [{
        title: 'Synthetic resource without staff note',
        description: 'Public description',
        external_note: 'Public note',
      }],
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('submits a resource without internal_note without adding undefined to its notes', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(
      <DuplicateDialog
        showDuplicateDialog={true}
        setShowDuplicateDialog={() => {}}
        reserve={{ courseCode: 'TEST 057' } as never}
        user={{ full_name: 'Test Faculty' } as never}
        id="test-api057-reserve"
        emailConfirmation={false}
        setEmailConfirmation={() => {}}
        updateReserve={updateReserve}
        submissionHandlers={{ confirmDuplicateSubmit }}
        addItem={() => true}
        duplicateSourceCourse={{
          term: 'Fall 2099',
          courseName: 'Synthetic API-057 course',
          resourceCount: 1,
          electronicCount: 1,
          physicalCount: 0,
        }}
      />
    ));

    await act(async () => {
      Array.from(container!.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Submit as Duplicate'))
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(updateReserve).toHaveBeenCalledWith('test-api057-reserve', {
      items: [expect.objectContaining({
        title: 'Synthetic resource without staff note',
        notes: 'Public description Public note',
      })],
    });
    expect(updateReserve.mock.calls[0][1].items[0].notes).not.toContain('undefined');
  });
});
