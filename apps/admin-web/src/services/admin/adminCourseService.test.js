import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('offeringLinkApi.reuseResource', () => {
  it('posts the offering, resource and association settings', async () => {
    const getAuthTokenSpy = vi.spyOn(config.api, 'getAuthToken').mockReturnValue('Bearer test-token');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ course_resource_id: 11 }) });
    vi.stubGlobal('fetch', fetchMock);

    const { offeringLinkApi } = await import('./course/offeringLinkApi');
    await offeringLinkApi.reuseResource(11, 22, {
      start_visibility: null,
      end_visibility: '2026-12-20',
      use_resource_visibility: 1,
      primary_link_start_visibility: null,
      primary_link_end_visibility: null,
      use_primary_link_visibility: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual([
      `${config.api.urls.courseReserves}/offering-link/link-existing-resources`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({
          offering_id: 11,
          resource_id: 22,
          settings: {
            start_visibility: null,
            end_visibility: '2026-12-20',
            use_resource_visibility: 1,
            primary_link_start_visibility: null,
            primary_link_end_visibility: null,
            use_primary_link_visibility: 0,
          },
        }),
      },
    ]);
    expect(getAuthTokenSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 409, message: 'Already on this course', reference: 'SYNTH-409' },
    { status: 422, message: 'Please correct the highlighted fields.', reference: 'SYNTH-422' },
  ])('carries the $status response message and reference', async ({ status, message, reference }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ message, reference }),
    }));
    const { offeringLinkApi } = await import('./course/offeringLinkApi');

    await expect(offeringLinkApi.reuseResource(11, 22, {})).rejects.toMatchObject({
      message,
      serverMessage: message,
      reference,
    });
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
