import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import { folioSearchService } from './folioSearchService';

vi.mock('../config', () => ({
  config: {
    api: {
      urls: { folio: 'https://configured-api.example/folio' },
      endpoints: {
        folioSearch: {
          departments: '/search/search-departments',
          inventory: '/search/search-inventory',
        },
      },
    },
  },
}));

describe('folioSearchService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('encodes the department query and returns the response for caller parsing', async () => {
    const response = { ok: true, json: vi.fn() };
    fetchMock.mockResolvedValue(response);

    await expect(
      folioSearchService.getDepartments('owner==Smith College AND active==true')
    ).resolves.toBe(response);

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.folio}${config.api.endpoints.folioSearch.departments}?query=owner%3D%3DSmith%20College%20AND%20active%3D%3Dtrue`
    );
  });

  it('preserves Searchbar’s sorted department query suffix', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await folioSearchService.getDepartments('owner==Smith', '%20sortBy%20name/sort.ascending');

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.folio}${config.api.endpoints.folioSearch.departments}?query=owner%3D%3DSmith%20sortBy%20name/sort.ascending`
    );
  });

  it('omits the department query when the caller has no college query', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await folioSearchService.getDepartments(null);

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.folio}${config.api.endpoints.folioSearch.departments}`
    );
  });

  it('fetches inventory using the configured FOLIO endpoint and instance query', async () => {
    const response = { ok: true, json: vi.fn() };
    fetchMock.mockResolvedValue(response);

    await expect(folioSearchService.getInventory('folio-instance-123')).resolves.toBe(response);

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.folio}${config.api.endpoints.folioSearch.inventory}?query=id==folio-instance-123`
    );
  });
});
