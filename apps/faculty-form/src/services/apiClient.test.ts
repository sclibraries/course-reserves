import { AxiosError, type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './apiClient';
import {
  buildFacultyAuthorizeUrl,
  getPostLoginDestination,
  RETURN_DESTINATION_SESSION_KEY,
} from './session';

const mocks = vi.hoisted(() => {
  const logout = vi.fn();
  return {
    logout,
    authStoreModule: {
      getAccessToken: () => 'synthetic-access-token',
      useAuthStore: { getState: () => ({ logout }) },
    },
  };
});

vi.mock('@/store/authStore', () => mocks.authStoreModule);

describe('apiClient 401 return destination', () => {
  let adapter: AxiosAdapter | undefined;

  beforeEach(() => {
    vi.stubEnv('VITE_BASE_PATH', '/form/');
    sessionStorage.clear();
    mocks.logout.mockReset();
    adapter = apiClient.defaults.adapter as AxiosAdapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = adapter;
    vi.unstubAllEnvs();
  });

  it.each([
    [
      'saves a deep route before signing out and the authorize URL returns there',
      '/form/submission/reserve-a?tab=items#item-2',
      null,
      '/form/submission/reserve-a?tab=items#item-2',
    ],
    [
      'does not replace a saved route when a later 401 occurs on auth',
      '/form/auth?retry=1',
      '/form/submission/reserve-a?tab=items#item-2',
      '/form/submission/reserve-a?tab=items#item-2',
    ],
  ])('%s', async (_name, path, previous, expected) => {
    if (previous) sessionStorage.setItem(RETURN_DESTINATION_SESSION_KEY, previous);
    window.history.replaceState({}, '', path);
    apiClient.defaults.adapter = (async (config) => {
      const response = { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config };
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response);
    }) as AxiosAdapter;

    await expect(apiClient.get('/synthetic')).rejects.toMatchObject({ response: { status: 401 } });

    expect(sessionStorage.getItem(RETURN_DESTINATION_SESSION_KEY)).toBe(expected);
    expect(mocks.logout).toHaveBeenCalledWith({ reason: 'expired' });
    const destination = getPostLoginDestination(
      null,
      sessionStorage.getItem(RETURN_DESTINATION_SESSION_KEY),
      '/form/',
    );
    const authorizeUrl = buildFacultyAuthorizeUrl(
      'https://faculty.example.edu/backend/admin/faculty-authorize.php',
      'https://faculty.example.edu',
      '/form/',
      destination,
    );
    expect(new URL(authorizeUrl).searchParams.get('redirect')).toBe(
      'https://faculty.example.edu/form/submission/reserve-a?tab=items#item-2',
    );
  });
});
