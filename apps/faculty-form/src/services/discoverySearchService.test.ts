import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchDiscovery } from './discoverySearchService';

const searchFailure = (status: number, payload: unknown = {}) => ({
  ok: false,
  status,
  statusText: 'Request failed',
  json: async () => payload,
});

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

  it('shows unavailable guidance and its reference for a search_unavailable response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(searchFailure(503, {
      error_code: 'search_unavailable',
      message: 'raw upstream details must not be shown',
      reference: '7F3K2Q',
    }) as Response);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(searchDiscovery('typed query')).rejects.toMatchObject({
      message: 'Library search is temporarily unavailable. Please try again later, or add the item by citation.\nReference: 7F3K2Q',
    });
  });

  it('shows a friendly rate limit message for 429 responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(searchFailure(429) as Response);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(searchDiscovery('typed query')).rejects.toMatchObject({
      message: 'There are too many searches right now. Please wait a moment and try again.',
    });
  });

  it('uses a generic friendly message for other HTTP errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(searchFailure(400, {
      message: 'HTTP 400: raw server error',
    }) as Response);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(searchDiscovery('typed query')).rejects.toMatchObject({
      message: 'Unable to search the library right now. Please try again.',
    });
  });
});
