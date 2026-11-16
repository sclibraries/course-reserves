import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Auth from './Auth';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';
import { RETURN_DESTINATION_SESSION_KEY } from '@/services/session';

const mocks = vi.hoisted(() => ({
  debugMode: false,
  debugModule: { isDebugEnabled: () => mocks.debugMode },
  authModule: { useAuthStore: () => ({ loading: false, setMockUser: vi.fn() }) },
  assignmentsModule: {
    useCourseAssignmentsStore: () => ({ fetchCourseAssignments: vi.fn() }),
  },
}));

vi.mock('@/lib/debug', () => mocks.debugModule);
vi.mock('@/store/authStore', () => mocks.authModule);
vi.mock('@/store/courseAssignmentsStore', () => mocks.assignmentsModule);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('faculty sign-in page in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    vi.unstubAllEnvs();
    sessionStorage.clear();
    container?.remove();
    container = null;
    root = null;
  });

  const renderPage = async (mode: 'production' | 'mock') => {
    vi.stubEnv('VITE_BASE_PATH', '/form/');
    mocks.debugMode = mode === 'mock';
    if (mode === 'production') {
      sessionStorage.setItem(RETURN_DESTINATION_SESSION_KEY, '/form/submission/reserve-a?tab=items#item-2');
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
        `${window.location.origin}/form/submission/reserve-a?tab=items#item-2`,
      );
    } else {
      getByRole(container!, role, { name });
      expect(getByRole(container!, 'textbox', { name: 'Full name' })).toBeTruthy();
      expect(container?.textContent).not.toContain('valid for 1 hour');
    }

    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(container!);
  });
});
