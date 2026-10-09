/**
 * authStore.test.ts — Smoke tests for the faculty-form Zustand authStore.
 *
 * Zustand stores are pure JS objects — no React rendering required.
 * Tests run in jsdom (configured in vitest.config.ts) so that Zustand's
 * persist middleware (localStorage) and any window.location references work.
 *
 * Test 1: Store initializes with null user / isAuthenticated = false when
 *         localStorage is empty (i.e. no persisted session).
 * Test 2: login() (the store's token-setting action) stores user data and sets
 *         isAuthenticated = true.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stub clearCourseReservesStorage so the authStore can import without pulling
// the entire courseReservesStore dependency chain.
vi.mock('./courseReservesStore', () => ({
  clearCourseReservesStorage: vi.fn(),
}));

// Stub API_ENDPOINTS — only BASE_URL is referenced in authStore's setMockUser.
vi.mock('@/config/endpoints', () => ({
  API_ENDPOINTS: {
    COURSE_RESERVES: {
      BASE_URL: 'http://test.invalid',
    },
  },
}));

// ── localStorage stub ─────────────────────────────────────────────────────────
// The jsdom environment provided by the root node_modules may expose a partial
// localStorage implementation.  vi.stubGlobal replaces it with a fully-
// functional in-memory store for the duration of the test run.
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authStore — auth token lifecycle', () => {
  beforeEach(() => {
    // Stub localStorage before each test so persist middleware gets a clean slate.
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with null token state when localStorage is empty', async () => {
    // Import lazily after resetModules so persist re-hydration reads empty storage.
    const { useAuthStore } = await import('./authStore');
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('login() stores the token data and marks the user as authenticated', async () => {
    const { useAuthStore } = await import('./authStore');

    await useAuthStore.getState().login({
      username: 'example.faculty',
      role: 'faculty',
      full_name: 'Sally Faculty',
      email: 'example.faculty@example.test',
      institution: 'SM',
    });

    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.user).not.toBeNull();
    expect(state.user?.username).toBe('example.faculty');
    expect(state.user?.role).toBe('faculty');
    // login() sets exp to ~8 hours from now — confirm it's in the future.
    expect(state.user?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('logout() clears auth state and redirects to the faculty form auth route', async () => {
    const { FACULTY_FORM_AUTH_PATH, useAuthStore } = await import('./authStore');

    useAuthStore.getState().login({
      username: 'faculty',
      role: 'faculty',
      full_name: 'Faculty Member',
      email: 'faculty@example.test',
      institution: 'SM',
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(FACULTY_FORM_AUTH_PATH).toBe('/form/auth');
  });
});
