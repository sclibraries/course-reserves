import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('adminCourseService.linkExistingResources', () => {
  it('sends the bearer token when linking an existing resource', async () => {
    const getAuthTokenSpy = vi.spyOn(config.api, 'getAuthToken').mockReturnValue('Bearer test-token');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);

    const { adminCourseService } = await import('./adminCourseService');
    await adminCourseService.linkExistingResources(11, 22);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('offering_id=11');
    expect(fetchMock.mock.calls[0][0]).toContain('resource_id=22');
    expect(fetchMock.mock.calls[0][1]?.headers.Authorization).toBe('Bearer test-token');
    expect(getAuthTokenSpy).toHaveBeenCalledTimes(1);
  });
});

describe('adminCourseService.searchCoursesByQuery', () => {

  it('routes test-course searches through the normal FOLIO search path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          courses: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { adminCourseService } = await import('./adminCourseService');
    await adminCourseService.searchCoursesByQuery('TST 101');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/folio/web/search/search-courses');
  });
});
