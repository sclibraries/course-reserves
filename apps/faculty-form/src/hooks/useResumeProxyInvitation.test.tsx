import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole } from '@testing-library/dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResumeProxyInvitation } from './useResumeProxyInvitation';
import { PROXY_INVITATION_SESSION_KEY, RETURN_DESTINATION_SESSION_KEY } from '@/services/session';

const mocks = vi.hoisted(() => {
  const authState = { isAuthenticated: false };
  const listeners = new Set<() => void>();
  return {
    authState,
    listeners,
    fetchAssignments: vi.fn(),
    authModule: { useAuthStore: undefined as unknown },
  };
});

vi.mock('@/store/authStore', async () => {
  const { useSyncExternalStore } = await import('react');
  const useMockAuthStore = (selector: (state: typeof mocks.authState) => unknown) =>
    useSyncExternalStore(
      (listener) => { mocks.listeners.add(listener); return () => mocks.listeners.delete(listener); },
      () => selector(mocks.authState),
      () => selector(mocks.authState),
    );
  mocks.authModule.useAuthStore = useMockAuthStore;
  return mocks.authModule;
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ResumeProbe = () => {
  useResumeProxyInvitation();
  const location = useLocation();
  return <>
    <span data-testid="location">{location.pathname}{location.search}{location.hash}</span>
    <button onClick={() => {
      void mocks.fetchAssignments();
      mocks.authState.isAuthenticated = true;
      mocks.listeners.forEach((listener) => listener());
    }}>Finish sign-in</button>
  </>;
};

describe('useResumeProxyInvitation', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.stubEnv('VITE_BASE_PATH', '/form/');
    sessionStorage.clear();
    mocks.authState.isAuthenticated = false;
    mocks.fetchAssignments.mockReset().mockReturnValue(new Promise<void>(() => {}));
  });

  afterEach(() => {
    act(() => root?.unmount());
    vi.unstubAllEnvs();
    container?.remove();
    container = null;
    root = null;
  });

  const renderHook = async (path = '/auth') => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(
      <MemoryRouter initialEntries={[path]}>
        <ResumeProbe />
      </MemoryRouter>,
    ));
  };

  it('routes to a pending invitation once sign-in completes without waiting for assignments', async () => {
    sessionStorage.setItem(PROXY_INVITATION_SESSION_KEY, 'test-token');
    sessionStorage.setItem(RETURN_DESTINATION_SESSION_KEY, '/form/submission/test-1?tab=items#item-2');
    await renderHook();

    await act(async () => getByRole(container!, 'button', { name: 'Finish sign-in' }).click());

    expect(mocks.fetchAssignments).toHaveBeenCalledOnce();
    expect(container?.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/faculty/accept-proxy-invitation/test-token');
    expect(sessionStorage.getItem(PROXY_INVITATION_SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(RETURN_DESTINATION_SESSION_KEY)).toBeNull();
  });

  it('uses the saved path after sign-in when there is no invitation', async () => {
    sessionStorage.setItem(RETURN_DESTINATION_SESSION_KEY, '/form/submission/test-1?tab=items#item-2');
    await renderHook();

    await act(async () => getByRole(container!, 'button', { name: 'Finish sign-in' }).click());

    expect(container?.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/submission/test-1?tab=items#item-2');
    expect(sessionStorage.getItem(RETURN_DESTINATION_SESSION_KEY)).toBeNull();
  });

  it('uses the dashboard after sign-in when no destination was saved', async () => {
    await renderHook();

    await act(async () => getByRole(container!, 'button', { name: 'Finish sign-in' }).click());

    expect(container?.querySelector('[data-testid="location"]')?.textContent).toBe('/');
  });

  it('keeps a production callback at its saved route and consumes the return state once', async () => {
    mocks.authState.isAuthenticated = true;
    sessionStorage.setItem(RETURN_DESTINATION_SESSION_KEY, '/form/submission/test-1?tab=items#item-2');
    await renderHook('/submission/test-1?tab=items#item-2');

    expect(container?.querySelector('[data-testid="location"]')?.textContent)
      .toBe('/submission/test-1?tab=items#item-2');
    expect(sessionStorage.getItem(RETURN_DESTINATION_SESSION_KEY)).toBeNull();
  });
});
