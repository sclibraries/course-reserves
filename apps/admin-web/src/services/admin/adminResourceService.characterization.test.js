import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiConfig } from '../../config/api.config';
import { ADMIN_ERROR_MESSAGES } from '../../constants/admin';
import { adminResourceService } from './adminResourceService';

const courseApi = apiConfig.urls.courseReserves;
const token = 'Bearer synthetic-aw043-token';
const result = [{ id: 17, name: 'Synthetic resource' }];
const paginationHeaders = {
  Authorization: token,
  'Content-Type': 'application/json',
};

let fetchMock;

beforeEach(() => {
  document.cookie = 'accessToken=synthetic-aw043-token; path=/';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  document.cookie = 'accessToken=; Max-Age=0; path=/';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const requestCases = [
  {
    name: 'searchResources',
    invoke: () => adminResourceService.searchResources({
      name: 'Synthetic title',
      materialTypeId: 2,
      page: 3,
      perPage: 12,
    }),
    url: `${courseApi}/resource?name=Synthetic+title&type=2&page=3&perPage=12`,
    init: { headers: paginationHeaders },
    expected: { data: result, pagination: { totalCount: 1 } },
    responseHeaders: paginationHeaders,
  },
  {
    name: 'getResourceById',
    invoke: () => adminResourceService.getResourceById(18),
    url: `${courseApi}/resource/18`,
    init: { headers: { Authorization: token } },
    expected: result,
  },
  {
    name: 'createResource',
    invoke: () => adminResourceService.createResource({ name: 'Synthetic title' }),
    url: `${courseApi}/resource`,
    init: {
      method: 'POST',
      headers: paginationHeaders,
      body: JSON.stringify({ name: 'Synthetic title' }),
    },
    expected: result,
  },
  {
    name: 'updateResource',
    invoke: () => adminResourceService.updateResource(19, { name: 'Updated title' }),
    url: `${courseApi}/resource/19`,
    init: {
      method: 'PUT',
      headers: paginationHeaders,
      body: JSON.stringify({ name: 'Updated title' }),
    },
    expected: result,
  },
  {
    name: 'deleteResource',
    invoke: () => adminResourceService.deleteResource(20),
    url: `${courseApi}/resource/20`,
    init: { method: 'DELETE', headers: { Authorization: token } },
    expected: true,
  },
  {
    name: 'getMaterialTypes',
    invoke: () => adminResourceService.getMaterialTypes(),
    url: `${courseApi}/material-type`,
    init: { headers: { Authorization: token } },
    expected: result,
  },
  {
    name: 'updateResourceMetadata',
    invoke: () => adminResourceService.updateResourceMetadata(21, { call_number: 'QA 123' }),
    url: `${courseApi}/resource/21/metadata`,
    init: {
      method: 'PATCH',
      headers: paginationHeaders,
      body: JSON.stringify({ call_number: 'QA 123' }),
    },
    expected: result,
  },
  {
    name: 'updateUnifiedResourceOrder',
    invoke: () => adminResourceService.updateUnifiedResourceOrder(22, {
      electronic: [{ resource_id: 23, order: 1 }],
      print: [{ resource_id: 24, order: 2 }],
    }),
    url: `${courseApi}/resource/update-unified-order`,
    init: {
      method: 'POST',
      headers: paginationHeaders,
      body: JSON.stringify({
        offering_id: 22,
        electronic_resources: [{ resource_id: 23, order: 1 }],
        physical_resources: [{ resource_id: 24, order: 2 }],
      }),
    },
    expected: result,
  },
];

describe('adminResourceService characterization', () => {
  it.each(requestCases)('$name preserves its request and response', async (testCase) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(result),
      headers: {
        get: (name) => name === 'X-Pagination' ? '{"totalCount":1}' : null,
      },
    });

    await expect(testCase.invoke()).resolves.toEqual(testCase.expected);

    expect(fetchMock.mock.calls).toEqual([[testCase.url, testCase.init]]);
  });

  it('keeps unauthenticated resource listing and the public token accessor', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(result) });

    expect(adminResourceService.getAuthToken()).toBe(token);
    await expect(adminResourceService.getAllResources()).resolves.toEqual(result);

    expect(fetchMock.mock.calls).toEqual([[
      `${courseApi}/resource?expand=material_type_name,course_count, metadata`,
    ]]);
  });

  it('preserves the resource fetch error when the API rejects the request', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    await expect(adminResourceService.getResourceById(18))
      .rejects.toThrow(ADMIN_ERROR_MESSAGES.RESOURCE_FETCH_FAILED);
    expect(fetchMock.mock.calls).toEqual([[
      `${courseApi}/resource/18`,
      { headers: { Authorization: token } },
    ]]);
  });
});
