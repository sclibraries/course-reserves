import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const listeners = new Set<() => void>();
  const record = (name: string) => () => {
    events.push(name);
    return null;
  };
  return {
    events,
    listeners,
    authState: {
      initialized: false,
      isAuthenticated: false,
      initializeFromCookie: vi.fn(),
    },
    authModule: { useAuthStore: undefined as unknown },
    toasterModule: { Toaster: () => null },
    tooltipModule: { TooltipProvider: ({ children }: { children: ReactNode }) => children },
    protectedRouteModule: { ProtectedRoute: ({ children }: { children: ReactNode }) => children },
    invitationModule: { ProxyInvitationResume: record('invitation resume') },
    proxySyncModule: { ProxyAccessSync: record('proxy sync') },
    bannerModule: { RouteActingForBanner: record('acting-for banner') },
    pages: {
      auth: { default: () => null },
      index: { default: record('dashboard') },
      editor: { default: () => null },
      detail: { default: () => null },
      notFound: { default: () => null },
      designees: { default: () => null },
      invitation: { default: () => null },
    },
  };
});

vi.mock('@/store/authStore', async () => {
  const { useSyncExternalStore } = await import('react');
  const useMockAuthStore = (selector?: (state: typeof mocks.authState) => unknown) =>
    useSyncExternalStore(
      (listener) => { mocks.listeners.add(listener); return () => mocks.listeners.delete(listener); },
      () => selector ? selector(mocks.authState) : mocks.authState,
      () => selector ? selector(mocks.authState) : mocks.authState,
    );
  mocks.authModule.useAuthStore = useMockAuthStore;
  return mocks.authModule;
});
vi.mock('@/components/ui/sonner', () => mocks.toasterModule);
vi.mock('@/components/ui/tooltip', () => mocks.tooltipModule);
vi.mock('./components/ProtectedRoute', () => mocks.protectedRouteModule);
vi.mock('./components/ProxyInvitationResume', () => mocks.invitationModule);
vi.mock('./components/ProxyAccessSync', () => mocks.proxySyncModule);
vi.mock('./components/RouteActingForBanner', () => mocks.bannerModule);
vi.mock('./pages/Auth', () => mocks.pages.auth);
vi.mock('./pages/Index', () => mocks.pages.index);
vi.mock('./pages/SubmissionEditor', () => mocks.pages.editor);
vi.mock('./pages/SubmissionDetail', () => mocks.pages.detail);
vi.mock('./pages/NotFound', () => mocks.pages.notFound);
vi.mock('./pages/ManageDesignees', () => mocks.pages.designees);
vi.mock('./pages/AcceptProxyInvitation', () => mocks.pages.invitation);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('App startup gate', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mocks.events.length = 0;
    mocks.listeners.clear();
    mocks.authState.initialized = false;
    mocks.authState.isAuthenticated = true;
    mocks.authState.initializeFromCookie.mockReset().mockImplementation(() => {
      expect(mocks.events).toEqual([]);
      mocks.events.push('startup decided');
      mocks.authState = { ...mocks.authState, initialized: true };
      mocks.listeners.forEach((listener) => listener());
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('mounts protected routes and global data hooks only after cookie initialization decides', async () => {
    await act(async () => root?.render(<App />));

    expect(mocks.authState.initializeFromCookie).toHaveBeenCalledOnce();
    expect(mocks.events).toEqual([
      'startup decided',
      'invitation resume',
      'proxy sync',
      'acting-for banner',
      'dashboard',
    ]);
  });
});
