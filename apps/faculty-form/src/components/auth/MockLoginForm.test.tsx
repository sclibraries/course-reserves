import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockLoginForm } from './MockLoginForm';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const setMockUser = vi.fn();
const fetchCourseAssignments = vi.fn();
const navigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    loading: false,
    setMockUser,
  }),
}));

vi.mock('@/store/courseAssignmentsStore', () => ({
  useCourseAssignmentsStore: () => ({
    fetchCourseAssignments,
  }),
}));

describe('MockLoginForm', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  const render = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<MockLoginForm />));
  };

  it('requires Shibboleth identity fields without real-looking examples or generated account preview', () => {
    render();

    expect(container!.textContent).toContain('Full name');
    expect(container!.textContent).toContain('Internal ID');
    expect(container!.textContent).not.toContain('Karla');
    expect(container!.textContent).not.toContain('999999999');
    expect(container!.textContent).not.toContain('Will create:');
  });
});
