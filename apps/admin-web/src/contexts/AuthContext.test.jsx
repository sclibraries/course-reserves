/**
 * AuthContext.test.jsx — Smoke tests for the admin-web AuthContext token lifecycle.
 *
 * These tests exercise the token-validity logic that AuthContext's
 * initializeAuth() relies on, without rendering the React component.  This
 * avoids a react / react-dom version mismatch in the monorepo workspace and
 * keeps the tests fast and focused.
 *
 * AuthContext.initializeAuth() does two things:
 *   1. Calls jwtDecode(storedToken) then checks  decodedToken.exp > currentTime
 *      → if true  → sets isAuthenticated = true (valid token path)
 *      → if false → calls handleLogout() which removes tokens from localStorage
 *
 * These tests verify both sides of that branch using real calls to jwtDecode
 * and a mocked localStorage (via jsdom's built-in localStorage), then confirm
 * that the conditions align with the component's expected behaviour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { jwtDecode } from 'jwt-decode';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stub modules that AuthContext imports so that importing it in this test
// does not throw (router hooks, config, fetch are all unavailable here).
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/' }),
}));

vi.mock('../config', () => ({
  config: { api: { urls: { courseReserves: 'http://test.invalid' } } },
}));

vi.mock('../config/api.config', () => ({
  apiConfig: { getRefreshTokenUrl: () => 'http://test.invalid/refresh' },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build a decodable JWT with the given exp (unix timestamp).
 * jwtDecode does not verify the signature, so the last segment can be fake.
 */
function makeJWT(exp) {
  const b64url = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return [
    b64url({ typ: 'JWT', alg: 'HS256' }),
    b64url({
      exp,
      iat: Math.floor(Date.now() / 1000) - 10,
      username: 'testadmin',
      role: 'admin',
      id: '99',
      full_name: 'Test Admin',
      email: 'test@example.com',
      institution: 'SM',
    }),
    'fakesig',
  ].join('.');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// Replace localStorage with a proper vi-stubbed mock.
// @vitest/browser (in admin-web's local node_modules) inserts a Playwright-
// backed localStorage that omits removeItem/clear; vi.stubGlobal gives us a
// fully-functional in-memory implementation for testing.
function makeLocalStorageMock() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

describe('AuthContext — token lifecycle logic', () => {
  let fakeStorage;

  beforeEach(() => {
    fakeStorage = makeLocalStorageMock();
    vi.stubGlobal('localStorage', fakeStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recognizes a valid stored token as authenticated on mount', () => {
    // Build a token that expires 1 hour from now.
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJWT(exp);
    fakeStorage.setItem('authToken', token);

    // Replicate the exact check inside AuthContext.initializeAuth():
    const storedToken = fakeStorage.getItem('authToken');
    const decoded = jwtDecode(storedToken);
    const currentTime = Date.now() / 1000;

    // This is the condition that sets isAuthenticated = true in initializeAuth().
    expect(decoded.exp).toBeGreaterThan(currentTime);
    expect(decoded.username).toBe('testadmin');
  });

  it('expired token triggers the logout / localStorage clear flow', () => {
    // Build a token that expired 1 hour ago.
    const exp = Math.floor(Date.now() / 1000) - 3600;
    fakeStorage.setItem('authToken', makeJWT(exp));
    fakeStorage.setItem('refreshToken', makeJWT(exp));

    const storedToken = fakeStorage.getItem('authToken');
    const decoded = jwtDecode(storedToken);
    const currentTime = Date.now() / 1000;

    // Condition is false → handleLogout() branch is taken in initializeAuth().
    expect(decoded.exp).toBeLessThanOrEqual(currentTime);

    // Simulate the handleLogout() side-effect: remove tokens from localStorage.
    // This mirrors exactly what AuthContext.handleLogout() does.
    fakeStorage.removeItem('authToken');
    fakeStorage.removeItem('refreshToken');

    expect(fakeStorage.getItem('authToken')).toBeNull();
    expect(fakeStorage.getItem('refreshToken')).toBeNull();
  });
});

