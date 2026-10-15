import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProxyAccessSelector } from './ProxyAccessSelector';
import { ProxyAccessSync } from './ProxyAccessSync';

const mocks = vi.hoisted(() => ({
  getMyFacultyAccess: vi.fn(),
  fetchCourseAssignments: vi.fn(),
  fetchActingForAssignments: vi.fn(),
  clearActingForAssignments: vi.fn(),
  selectedFaculty: null as { username: string; displayName: string } | null,
}));

vi.mock('@/services/api/facultyProxyApi', () => ({
  getMyFacultyAccess: mocks.getMyFacultyAccess,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { username: string } }) => unknown) => (
    selector({ user: { username: 'test-proxy' } })
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
  const state = () => ({ selectedFaculty: mocks.selectedFaculty, selectFaculty, clearSelection });
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

const Dashboard = () => {
  const navigate = useNavigate();
  return <>
    <ProxyAccessSelector />
    <button onClick={() => navigate('/details')}>Open details</button>
  </>;
};

describe('ProxyAccessSync', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mocks.selectedFaculty = { username: 'test-faculty', displayName: 'Test Faculty' };
    mocks.getMyFacultyAccess.mockReset().mockResolvedValue({ items: [activeGrant] });
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

  const renderApp = async (path: string) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[path]}>
          <ProxyAccessSync />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/details" element={<span>Details</span>} />
          </Routes>
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it('does not fetch either course list when navigating away from the dashboard', async () => {
    await renderApp('/');
    const courseFetches = mocks.fetchCourseAssignments.mock.calls.length;
    const actingForFetches = mocks.fetchActingForAssignments.mock.calls.length;

    await act(async () => {
      container?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container?.textContent).toContain('Details');
    expect(mocks.fetchCourseAssignments).toHaveBeenCalledTimes(courseFetches);
    expect(mocks.fetchActingForAssignments).toHaveBeenCalledTimes(actingForFetches);
  });

  it('clears a revoked acting-for selection off the dashboard without loading courses', async () => {
    mocks.getMyFacultyAccess.mockResolvedValue({ items: [{ ...activeGrant, status: 'revoked' }] });
    await renderApp('/details');

    expect(mocks.selectedFaculty).toBeNull();
    expect(mocks.clearActingForAssignments).toHaveBeenCalledOnce();
    expect(mocks.fetchCourseAssignments).not.toHaveBeenCalled();
    expect(mocks.fetchActingForAssignments).not.toHaveBeenCalled();
  });
});
