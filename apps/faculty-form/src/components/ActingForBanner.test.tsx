import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActingForBanner } from './ActingForBanner';

const mocks = vi.hoisted(() => ({
  clearSelection: vi.fn(),
  clearActingForAssignments: vi.fn(),
  fetchCourseAssignments: vi.fn(),
  selectedFaculty: { username: 'test-faculty', displayName: 'Test Faculty' } as { username: string; displayName: string } | null,
  canEdit: false as boolean | null,
}));

vi.mock('@/store/actingForStore', () => ({
  useActingForStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    selectedFaculty: mocks.selectedFaculty,
    clearSelection: mocks.clearSelection,
  }),
}));

vi.mock('@/store/courseAssignmentsStore', () => ({
  useCourseAssignmentsStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    actingForCanEdit: mocks.canEdit,
    clearActingForAssignments: mocks.clearActingForAssignments,
    fetchCourseAssignments: mocks.fetchCourseAssignments,
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ActingForBanner', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mocks.selectedFaculty = { username: 'test-faculty', displayName: 'Test Faculty' };
    mocks.canEdit = false;
    mocks.clearSelection.mockReset();
    mocks.clearActingForAssignments.mockReset();
    mocks.fetchCourseAssignments.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('shows the selected faculty and restores the user’s own course list on switchback', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<ActingForBanner />));

    expect(container.textContent).toContain('Acting for Test Faculty');
    expect(container.textContent).toContain('View only');
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('Switch back'));
    await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(mocks.clearSelection).toHaveBeenCalledOnce();
    expect(mocks.clearActingForAssignments).toHaveBeenCalledOnce();
    expect(mocks.fetchCourseAssignments).toHaveBeenCalledOnce();
  });
});
