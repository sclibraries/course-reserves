import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminCourseService } from './adminCourseService';

describe('adminCourseService.searchCoursesByQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes sandbox course searches to the backend sandbox FOLIO fixture', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          courses: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await adminCourseService.searchCoursesByQuery('TST 101');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/course-reserves/backend/web/sandbox-folio/search-courses');
  });
});
