import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InviteProxyPayload } from './facultyProxyApi';

const BASE_API_URL = 'https://localhost';
const COURSE_RESERVES_PATH = '/course-reserves/test-web';

let apiClient: typeof import('@/services/apiClient').default;
let endpoints: typeof import('@/config/endpoints').API_ENDPOINTS;
let proxyApi: typeof import('./facultyProxyApi');
let useAuthStore: typeof import('@/store/authStore').useAuthStore;
let capturedConfig: InternalAxiosRequestConfig | undefined;
let originalAdapter: ReturnType<typeof import('axios').default.create>['defaults']['adapter'];

describe('facultyProxyApi', () => {
  beforeAll(async () => {
    vi.stubEnv('VITE_BASE_API_URL', BASE_API_URL);
    vi.stubEnv('VITE_COURSE_RESERVES_PATH', COURSE_RESERVES_PATH);
    vi.resetModules();
    ({ default: apiClient } = await import('@/services/apiClient'));
    ({ API_ENDPOINTS: endpoints } = await import('@/config/endpoints'));
    ({ useAuthStore } = await import('@/store/authStore'));
    proxyApi = await import('./facultyProxyApi');
    originalAdapter = apiClient.defaults.adapter;
  });

  afterAll(() => {
    if (apiClient) apiClient.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    capturedConfig = undefined;
    apiClient.defaults.adapter = (async (config) => {
      capturedConfig = config;
      return { data: { success: true, items: [] }, status: 200, statusText: 'OK', headers: {}, config };
    }) as AxiosAdapter;
  });

  const expectRequest = (method: string, path: string, body?: unknown) => {
    expect(capturedConfig).toBeDefined();
    expect(capturedConfig?.method).toBe(method);
    expect(apiClient.getUri(capturedConfig)).toBe(
      `${BASE_API_URL}${COURSE_RESERVES_PATH}${path}`,
    );
    if (body !== undefined) {
      expect(JSON.parse(String(capturedConfig?.data))).toEqual(body);
    }
  };

  it('gets the signed-in faculty member’s designees from the configured endpoint', async () => {
    await proxyApi.getMyProxies();

    expectRequest('get', endpoints.COURSE_RESERVES.FACULTY_PROXY_MY_PROXIES);
  });

  it('posts an invitation using the configured endpoint and API request fields', async () => {
    const invitation: InviteProxyPayload = {
      proxy_email: 'test-proxy@example.test',
      permission_type: 'specific_courses',
      course_permissions: [{ folio_course_listing_id: 'test-listing-1' }],
    };
    await proxyApi.inviteProxy(invitation);

    expectRequest('post', endpoints.COURSE_RESERVES.FACULTY_PROXY_INVITE, invitation);
  });

  it('gets active faculty grants for the signed-in designee', async () => {
    await proxyApi.getMyFacultyAccess();

    expectRequest('get', endpoints.COURSE_RESERVES.FACULTY_PROXY_MY_FACULTY_ACCESS);
  });

  it('validates the token through the public validation endpoint', async () => {
    await proxyApi.validateProxyInvitation('test-token/with space');

    expectRequest(
      'get',
      `${endpoints.COURSE_RESERVES.FACULTY_PROXY_VALIDATE_TOKEN}/test-token%2Fwith%20space`,
    );
  });

  it('accepts an invitation with the token body required by the API', async () => {
    await proxyApi.acceptProxyInvitation('test-invitation-token');

    expectRequest('post', endpoints.COURSE_RESERVES.FACULTY_PROXY_ACCEPT, {
      invitation_token: 'test-invitation-token',
    });
  });

  it('surfaces a 401 from acceptance for the invitation page to request sign-in again', async () => {
    const logout = vi.spyOn(useAuthStore.getState(), 'logout');
    apiClient.defaults.adapter = (async (config) => {
      capturedConfig = config;
      return {
        data: { message: 'Authentication required' },
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
      };
    }) as AxiosAdapter;

    await expect(proxyApi.acceptProxyInvitation('test-invitation-token')).rejects.toMatchObject({
      response: { status: 401, data: { message: 'Authentication required' } },
    });
    expect(logout).not.toHaveBeenCalled();
    expect(capturedConfig?.validateStatus?.(401)).toBe(true);
    expectRequest('post', endpoints.COURSE_RESERVES.FACULTY_PROXY_ACCEPT, {
      invitation_token: 'test-invitation-token',
    });
  });

  it('revokes a designee at the configured permission URL', async () => {
    await proxyApi.revokeProxy(42);

    expectRequest(
      'delete',
      `${endpoints.COURSE_RESERVES.FACULTY_PROXY_REVOKE}/42`,
    );
  });

  it('gets activity for the selected faculty owner', async () => {
    await proxyApi.getProxyActivityLog('test-faculty');

    expectRequest(
      'get',
      `${endpoints.COURSE_RESERVES.FACULTY_PROXY_ACTIVITY_LOG}/test-faculty`,
    );
  });
});
