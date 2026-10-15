import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProxyAccessSelector } from './ProxyAccessSelector';

const mocks = vi.hoisted(() => ({
  getMyFacultyAccess: vi.fn(),
  fetchCourseAssignments: vi.fn(),
  fetchActingForAssignments: vi.fn(),
  clearActingForAssignments: vi.fn(),
  actingForCanEdit: true as boolean | null,
  selectedFaculty: null as { username: string; displayName: string } | null,
}));

vi.mock('@/services/api/facultyProxyApi', () => ({
  getMyFacultyAccess: mocks.getMyFacultyAccess,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { username: string; role: string } }) => unknown) => (
    selector({ user: { username: 'test-proxy', role: 'employee' } })
  ),
}));

vi.mock('@/store/actingForStore', async () => {
  const { useSyncExternalStore } = await import('react');
  const listeners = new Set<() => void>();
  const selectFaculty = (faculty: { username: string; displayName: string }) => {
    mocks.selectedFaculty = faculty;
    listeners.forEach((listener) => listener());
  };
  const clearSelection = () => {
    mocks.selectedFaculty = null;
    listeners.forEach((listener) => listener());
  };
  const state = () => ({
    selectedFaculty: mocks.selectedFaculty,
    selectFaculty,
    clearSelection,
  });
  const useActingForStore = Object.assign(
    (selector: (value: ReturnType<typeof state>) => unknown) => useSyncExternalStore(
      (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      () => selector(state()),
      () => selector(state()),
    ),
    { getState: state },
  );
  return { useActingForStore };
});

vi.mock('@/store/courseAssignmentsStore', () => ({
  useCourseAssignmentsStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    actingForCanEdit: mocks.actingForCanEdit,
    actingForError: null,
    fetchCourseAssignments: mocks.fetchCourseAssignments,
    fetchActingForAssignments: mocks.fetchActingForAssignments,
    clearActingForAssignments: mocks.clearActingForAssignments,
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const activeGrant = {
  permission_id: 42,
  faculty_id: 'test-faculty',
  faculty_display_name: 'Test Faculty',
  permission_type: 'full_access',
  status: 'active',
};

describe('ProxyAccessSelector', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mocks.selectedFaculty = null;
    mocks.actingForCanEdit = true;
    mocks.getMyFacultyAccess.mockReset().mockResolvedValue({
      items: [activeGrant, { ...activeGrant, permission_id: 43, faculty_id: 'test-pending', status: 'pending' }],
    });
    mocks.fetchCourseAssignments.mockReset().mockResolvedValue(undefined);
    mocks.fetchActingForAssignments.mockReset().mockResolvedValue(undefined);
    mocks.clearActingForAssignments.mockReset();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    mocks.selectedFaculty = null;
  });

  const renderSelector = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<ProxyAccessSelector />);
      await Promise.resolve();
    });
  };

  it('offers only active faculty grants and loads that faculty’s course list on selection', async () => {
    await renderSelector();

    const selector = container?.querySelector<HTMLSelectElement>('select[aria-label="Working as"]');
    expect(selector).toBeDefined();
    expect([...((selector?.options) || [])].map((option) => option.value)).toEqual(['', 'test-faculty']);
    expect(container?.textContent).toContain('Working as');

    await act(async () => {
      if (selector) selector.value = 'test-faculty';
      selector?.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mocks.selectedFaculty).toEqual({
      username: 'test-faculty',
      displayName: 'Test Faculty',
    });
    expect(mocks.fetchActingForAssignments).toHaveBeenCalledWith('test-faculty', true);
    expect(container?.textContent).not.toContain('Acting for Test Faculty');
  });

  it('does not show the selector without an active grant', async () => {
    mocks.getMyFacultyAccess.mockResolvedValue({ items: [] });
    await renderSelector();

    expect(container?.querySelector('select[aria-label="Working as"]')).toBeNull();
  });

  it('shows the current view-only capability for a selected faculty member', async () => {
    mocks.getMyFacultyAccess.mockResolvedValue({
      items: [{ ...activeGrant, permission_type: 'view_only' }],
    });
    mocks.selectedFaculty = { username: 'test-faculty', displayName: 'Test Faculty' };
    await renderSelector();

    expect(mocks.fetchActingForAssignments).toHaveBeenCalledWith('test-faculty', false);
  });

  it('clears a persisted selection when its active grant disappears', async () => {
    mocks.selectedFaculty = { username: 'test-faculty', displayName: 'Test Faculty' };
    mocks.getMyFacultyAccess.mockResolvedValue({ items: [] });
    await renderSelector();

    expect(mocks.selectedFaculty).toBeNull();
    expect(mocks.clearActingForAssignments).toHaveBeenCalledOnce();
    expect(mocks.fetchCourseAssignments).toHaveBeenCalledOnce();
  });
});
