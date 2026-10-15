import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  return <span data-testid="location">{useLocation().pathname}</span>;
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

  it('resumes a stored invitation route after the user becomes authenticated', async () => {
    sessionStorage.setItem('faculty-proxy-invitation-token', 'test-token');
    mocks.isAuthenticated = true;
    await renderHook('/');

    expect(container?.textContent).toBe('/faculty/accept-proxy-invitation/test-token');
  });

  it('keeps the current route when no invitation token is stored', async () => {
    mocks.isAuthenticated = true;
    await renderHook('/');

    expect(container?.textContent).toBe('/');
  });
});
