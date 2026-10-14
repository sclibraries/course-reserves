import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { hitchcockService } from './hitchcockService';

vi.mock('../../config', () => ({
  config: {
    api: {
      urls: { courseReserves: 'https://configured-api.example/course-reserves' },
      endpoints: {
        courseReserves: { hitchcockSearch: '/hitchcock/search-resources' },
      },
    },
  },
}));

describe('hitchcockService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches the configured Hitchcock endpoint and returns the response', async () => {
    const response = { ok: true, json: vi.fn() };
    fetchMock.mockResolvedValue(response);

    await expect(hitchcockService.searchResources('biology & ecology')).resolves.toBe(response);

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.courseReserves}${config.api.endpoints.courseReserves.hitchcockSearch}?title=biology%20%26%20ecology`,
      { headers: { 'Content-Type': 'application/json' } }
    );
  });
});
