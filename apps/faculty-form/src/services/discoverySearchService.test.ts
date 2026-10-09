import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchDiscovery } from './discoverySearchService';

describe('searchDiscovery', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        code: 200,
        data: {
          request: {
            QueryString: 'climate change',
            SearchCriteriaWithActions: {
              QueriesWithAction: [],
            },
          },
          statistics: {
            TotalHits: 0,
            TotalSearchTime: 3,
          },
          recordFormat: 'EP Display',
          records: [],
          facets: [],
          availableCriteria: [],
        },
      }),
    }));

    document.cookie = 'accessToken=faculty-token; Path=/';
  });

  it('sends the faculty bearer token to the EBSCO proxy', async () => {
    await searchDiscovery('climate change');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ebsco-search/search?query=climate%20change'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer faculty-token',
        }),
      })
    );
  });
});
