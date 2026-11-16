import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Auth from './Auth';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';
import { AUTH_NOTICE_SESSION_KEY, RETURN_DESTINATION_SESSION_KEY, appPathForRoute } from '@/services/session';

// Vitest's stubEnv needs process.env, which Chromium lacks; use the basename the page itself reads.
const savedPath = appPathForRoute('/submission/reserve-a?tab=items#item-2', import.meta.env.VITE_BASE_PATH || '/');

const mocks = vi.hoisted(() => ({
  debugMode: false,
  debugModule: { isDebugEnabled: () => mocks.debugMode },
  authModule: { useAuthStore: () => ({ loading: false, setMockUser: vi.fn() }) },
  assignmentsModule: {
    useCourseAssignmentsStore: () => ({ fetchCourseAssignments: vi.fn() }),
  },
  notifyModule: {
    notify: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
    getSafeErrorFeedback: vi.fn(() => ({ message: 'Safe error' })),
  },
}));

vi.mock('@/lib/debug', () => mocks.debugModule);
vi.mock('@/store/authStore', () => mocks.authModule);
vi.mock('@/store/courseAssignmentsStore', () => mocks.assignmentsModule);
vi.mock('@/services/notify', () => mocks.notifyModule);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('faculty sign-in page in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    sessionStorage.clear();
    container?.remove();
    container = null;
    root = null;
  });

  const renderPage = async (mode: 'production' | 'mock') => {
    mocks.debugMode = mode === 'mock';
    if (mode === 'production') {
      sessionStorage.setItem(RETURN_DESTINATION_SESSION_KEY, savedPath);
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter initialEntries={['/auth']}><Auth /></MemoryRouter>));
    expect(getByRole(container, 'heading', { name: 'Course Reserves' })).toBeTruthy();
  };

  it.each([
    ['production', 'link', 'Sign In with Shibboleth'],
    ['mock', 'button', 'Login as Mock User'],
  ] as const)('shows the accessible %s sign-in action without overflow or axe violations', async (mode, role, name) => {
    await renderPage(mode);

    if (mode === 'production') {
      const action = getByRole(container!, role, { name }) as HTMLAnchorElement;
      const authorizeUrl = new URL(action.href);
      expect(authorizeUrl.pathname).toContain('faculty-authorize.php');
      expect(authorizeUrl.searchParams.get('redirect')).toBe(
        `${window.location.origin}${savedPath}`,
      );
    } else {
      getByRole(container!, role, { name });
      expect(getByRole(container!, 'textbox', { name: 'Full name' })).toBeTruthy();
      expect(container?.textContent).not.toContain('valid for 1 hour');
    }

    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(container!);
  });

  it.each([
    ['manual', 'success', 'Signed out of Course Reserves. Close the browser to end your campus sign-in.'],
    ['expired', 'error', 'Your session has ended. Sign in again to continue.'],
  ] as const)('shows the %s logout notice once, then clears it', async (reason, kind, message) => {
    mocks.notifyModule.notify.success.mockReset();
    mocks.notifyModule.notify.error.mockReset();
    sessionStorage.setItem(AUTH_NOTICE_SESSION_KEY, reason);

    await renderPage('production');

    expect(mocks.notifyModule.notify[kind]).toHaveBeenCalledWith(message);
    expect(sessionStorage.getItem(AUTH_NOTICE_SESSION_KEY)).toBeNull();

    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    await renderPage('production');
    expect(mocks.notifyModule.notify[kind]).toHaveBeenCalledOnce();
  });
});
