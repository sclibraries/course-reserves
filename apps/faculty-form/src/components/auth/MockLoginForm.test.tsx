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

  const enterValue = (input: HTMLInputElement, value: string) => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    valueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('requires Shibboleth identity fields without real-looking examples or generated account preview', () => {
    render();

    expect(container!.textContent).toContain('Full name');
    expect(container!.textContent).toContain('Internal ID');
    expect(container!.textContent).not.toContain('Karla');
    expect(container!.textContent).not.toContain('999999999');
    expect(container!.textContent).not.toContain('Will create:');
  });

  it('fetches courses without identity arguments after mock JWT creation resolves', async () => {
    let resolveLogin!: () => void;
    const loginPromise = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });
    setMockUser.mockReturnValue(loginPromise);
    fetchCourseAssignments.mockResolvedValue(undefined);
    render();

    const nameInput = container!.querySelector<HTMLInputElement>('#custom-name')!;
    const idInput = container!.querySelector<HTMLInputElement>('#internal-id')!;
    await act(async () => {
      enterValue(nameInput, 'Faculty Member');
      enterValue(idInput, 'faculty-id');
    });

    const button = container!.querySelector<HTMLButtonElement>('button')!;
    act(() => {
      button.click();
    });

    expect(setMockUser).toHaveBeenCalledWith('Faculty Member', 'faculty-id');
    expect(fetchCourseAssignments).not.toHaveBeenCalled();

    await act(async () => {
      resolveLogin();
      await loginPromise;
    });

    expect(fetchCourseAssignments).toHaveBeenCalledOnce();
    expect(fetchCourseAssignments).toHaveBeenCalledWith();
  });

  it('lists the dev-seed test accounts and signs in with one click', async () => {
    setMockUser.mockResolvedValue(undefined);
    fetchCourseAssignments.mockResolvedValue(undefined);
    render();

    const section = container!.querySelector('section[aria-label="Test accounts"]')!;
    expect(section.textContent).toContain('Test Faculty A');
    expect(section.textContent).toContain('999078001');
    expect(section.textContent).toContain('Test Faculty B');
    expect(section.textContent).toContain('999078002');

    const buttons = section.querySelectorAll<HTMLButtonElement>('button');
    await act(async () => {
      buttons[0].click();
    });

    expect(setMockUser).toHaveBeenCalledWith('Test Faculty A', '999078001');
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
