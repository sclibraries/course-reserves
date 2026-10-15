import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResumeProxyInvitation } from './useResumeProxyInvitation';

const mocks = vi.hoisted(() => ({ isAuthenticated: false }));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) => (
    selector({ isAuthenticated: mocks.isAuthenticated })
  ),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ResumeProbe = () => {
  useResumeProxyInvitation();
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <span data-testid="location">{location.pathname}</span>
    <button onClick={() => navigate('/')}>Return to dashboard</button>
  </>;
};

describe('useResumeProxyInvitation', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    sessionStorage.clear();
    mocks.isAuthenticated = false;
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  const renderHook = async (path: string) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[path]}>
          <ResumeProbe />
        </MemoryRouter>,
      );
      await Promise.resolve();
    });
  };

  it('consumes a stored invitation while resuming once after authentication', async () => {
    sessionStorage.setItem('faculty-proxy-invitation-token', 'test-token');
    mocks.isAuthenticated = true;
    await renderHook('/');

    expect(container?.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/faculty/accept-proxy-invitation/test-token');
    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBeNull();

    const dashboard = container?.querySelector('button');
    await act(async () => {
      dashboard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container?.querySelector('[data-testid="location"]')?.textContent).toBe('/');
    expect(sessionStorage.getItem('faculty-proxy-invitation-token')).toBeNull();
  });

  it('keeps the current route when no invitation token is stored', async () => {
    mocks.isAuthenticated = true;
    await renderHook('/');

    expect(container?.querySelector('[data-testid="location"]')?.textContent).toBe('/');
  });
});
