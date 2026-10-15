import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResumeProxyInvitation } from '@/hooks/useResumeProxyInvitation';
import AcceptProxyInvitation from './AcceptProxyInvitation';

const mocks = vi.hoisted(() => ({
  validateProxyInvitation: vi.fn(),
  acceptProxyInvitation: vi.fn(),
  getMyFacultyAccess: vi.fn(),
  selectedFaculty: null as { username: string; displayName: string } | null,
  authState: { isAuthenticated: false, loading: false, initializeFromCookie: vi.fn() },
}));

vi.mock('@/services/api/facultyProxyApi', () => ({
  validateProxyInvitation: mocks.validateProxyInvitation,
  acceptProxyInvitation: mocks.acceptProxyInvitation,
  getMyFacultyAccess: mocks.getMyFacultyAccess,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: typeof mocks.authState) => unknown) => selector(mocks.authState),
}));

vi.mock('@/store/actingForStore', () => {
  const selectFaculty = (faculty: { username: string; displayName: string }) => { mocks.selectedFaculty = faculty; };
  const clearSelection = () => { mocks.selectedFaculty = null; };
  const getState = () => ({ selectedFaculty: mocks.selectedFaculty, selectFaculty, clearSelection });
  return { useActingForStore: Object.assign((selector: (state: ReturnType<typeof getState>) => unknown) => selector(getState()), { getState }) };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;
const ResumeProbe = () => {
  useResumeProxyInvitation();
  return null;
};

describe('AcceptProxyInvitation', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.stubEnv('VITE_BASE_PATH', '/form/');
    mocks.selectedFaculty = null;
    sessionStorage.clear();
    mocks.authState = {
      isAuthenticated: false,
      loading: false,
      initializeFromCookie: vi.fn(),
    };
    mocks.validateProxyInvitation.mockResolvedValue({
      valid: true,
      invitation: {
        faculty_name: 'Test Faculty',
        scope_summary: 'Edit selected courses (1)',
        invitation_expires_at: '2099-01-01T00:00:00Z',
      },
    });
    mocks.acceptProxyInvitation.mockReset();
    mocks.getMyFacultyAccess.mockReset();
  });

  afterEach(() => {
    act(() => root?.unmount());
    vi.unstubAllEnvs();
    container?.remove();
    container = null;
    root = null;
  });

  const renderPage = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={['/faculty/accept-proxy-invitation/test-token']}>
          <LocationProbe />
          <ResumeProbe />
          <Routes>
            <Route path="/faculty/accept-proxy-invitation/:token" element={<AcceptProxyInvitation />} />
            <Route path="/" element={<span data-testid="dashboard">Dashboard</span>} />
          </Routes>
        </MemoryRouter>,
      );
      await Promise.resolve();
    });
  };

  const clickButton = async (text: string) => {
    const button = [...(container?.querySelectorAll('button') || [])]
      .find((candidate) => candidate.textContent?.includes(text));
    expect(button).toBeDefined();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  };

  const clickLink = async (text: string) => {
    const link = [...(container?.querySelectorAll('a') || [])]
      .find((candidate) => candidate.textContent?.includes(text));
    expect(link).toBeDefined();
    await act(async () => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  };

  it('validates for signed-out visitors, preserves the token, and links to sign-in', async () => {
    await renderPage();

    expect(mocks.validateProxyInvitation).toHaveBeenCalledWith('test-token');
    expect(container?.textContent).toContain('Test Faculty');
    expect(container?.textContent).toContain('Edit selected courses (1)');
    expect(container?.textContent).toContain('Sign in to accept');
    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBeNull();
    const signIn = container?.querySelector<HTMLAnchorElement>('a[href*="faculty-authorize.php"]');
    expect(signIn).toBeDefined();
    await act(async () => {
      document.addEventListener('click', (event) => event.preventDefault(), { capture: true, once: true });
      signIn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBe('test-token');
    expect(signIn?.href).toContain('redirect=');
    expect(decodeURIComponent(signIn?.href || '')).toContain('/form/faculty/accept-proxy-invitation/test-token');
  });

  it('shows a clear invalid invitation message', async () => {
    sessionStorage.setItem('faculty-proxy-invitation-token', 'test-token');
    mocks.validateProxyInvitation.mockResolvedValue({ valid: false, message: 'Invalid or expired invitation token' });
    await renderPage();

    expect(container?.textContent).toContain('Invalid or expired invitation token');
    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBeNull();
  });

  it('shows the validation response for an expired invitation', async () => {
    sessionStorage.setItem('faculty-proxy-invitation-token', 'test-token');
    mocks.validateProxyInvitation.mockResolvedValue({ valid: false, message: 'Invitation has expired' });
    await renderPage();

    expect(container?.textContent).toContain('Invitation has expired');
    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBeNull();
  });

  it('does not store a signed-in visitor token or resume after returning to the dashboard', async () => {
    mocks.authState.isAuthenticated = true;
    await renderPage();

    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBeNull();
    await clickLink('Return to dashboard');
    expect(container?.querySelector('[data-testid="dashboard"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="location"]')?.textContent).toBe('/');
  });

  it('consumes a sign-in token when authentication returns directly to the invitation page', async () => {
    mocks.authState.isAuthenticated = true;
    sessionStorage.setItem('faculty-proxy-invitation-token', 'test-token');
    await renderPage();

    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBeNull();
    await clickLink('Return to dashboard');
    expect(container?.querySelector('[data-testid="location"]')?.textContent).toBe('/');
  });

  it('accepts a valid invitation and opens the dashboard in acting-for mode', async () => {
    mocks.authState.isAuthenticated = true;
    mocks.acceptProxyInvitation.mockResolvedValue({
      success: true,
      permission: { permission_id: 42 },
    });
    mocks.getMyFacultyAccess.mockResolvedValue({
      items: [{
        permission_id: 42,
        faculty_id: 'test-faculty',
        faculty_display_name: 'Test Faculty',
        status: 'active',
      }],
    });
    await renderPage();
    sessionStorage.setItem('faculty-proxy-invitation-token', 'test-token');

    expect(container?.textContent).toContain('Accept invitation');
    await clickButton('Accept invitation');

    expect(mocks.acceptProxyInvitation).toHaveBeenCalledWith('test-token');
    expect(mocks.selectedFaculty).toEqual({
      username: 'test-faculty',
      displayName: 'Test Faculty',
    });
    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBeNull();
    expect(container?.querySelector('[data-testid="dashboard"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="location"]')?.textContent).toBe('/');
  });

  it.each([
    [401, 'Please sign in again'],
    [409, 'This invitation was already used by another account'],
    [410, 'This invitation has expired'],
  ])('explains API acceptance status %i', async (status, expected) => {
    mocks.authState.isAuthenticated = true;
    mocks.acceptProxyInvitation.mockRejectedValue({
      response: { status, data: { message: expected } },
    });
    await renderPage();
    sessionStorage.setItem('faculty-proxy-invitation-token', 'test-token');
    await clickButton('Accept invitation');

    expect(container?.textContent).toContain(expected);
    expect(sessionStorage.getItem('faculty-proxy-invitation-token'))
      .toBe(status === 401 ? 'test-token' : null);
  });
});
