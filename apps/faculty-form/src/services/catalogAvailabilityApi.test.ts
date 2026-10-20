import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ENDPOINTS } from '@/config/endpoints';
import { getCatalogAvailability } from './catalogAvailabilityApi';

describe('getCatalogAvailability', () => {
  beforeEach(() => {
    document.cookie = 'accessToken=faculty-token; Path=/';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        records: {
          'synthetic-an': {
            instanceId: '00000000-0000-4000-8000-000000000089',
            copies: [{
              library: 'SC Neilson Library',
              location: 'Smith College Neilson Stacks',
              callNumber: 'QA 76 .A1',
              status: 'Available',
              loanType: 'Standard Loan',
            }],
          },
        },
      }),
    }));
  });

  it('uses the authenticated course-reserves endpoint and maps copies by accession number', async () => {
    const response = await getCatalogAvailability(['synthetic-an']);

    expect(fetch).toHaveBeenCalledWith(
      API_ENDPOINTS.COURSE_RESERVES.BASE_URL + '/catalog-availability?an=synthetic-an',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer faculty-token' }),
      }),
    );
    expect(response['synthetic-an']).toMatchObject({
      instanceId: '00000000-0000-4000-8000-000000000089',
      copies: [{ location: 'Smith College Neilson Stacks', status: 'Available' }],
    });
  });

  it('turns HTTP failures into a generic error without exposing response details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ message: 'private upstream diagnostics' }),
    } as Response);

    await expect(getCatalogAvailability(['synthetic-an'])).rejects.toThrow('Availability lookup failed');
  });

  it('shares an in-flight page lookup when the full record requests one of its accession numbers', async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn(() => pendingResponse);
    vi.stubGlobal('fetch', fetchMock);

    const pageLookup = getCatalogAvailability(['synthetic-an', 'synthetic-an-2']);
    const recordLookup = getCatalogAvailability(['synthetic-an']);

    expect(fetchMock).toHaveBeenCalledOnce();
    resolveResponse({
      ok: true,
      json: async () => ({
        records: {
          'synthetic-an': { instanceId: 'synthetic-instance', copies: [] },
          'synthetic-an-2': { instanceId: null, copies: [] },
        },
      }),
    } as Response);

    const [pageRecords, recordRecords] = await Promise.all([pageLookup, recordLookup]);
    expect(recordRecords['synthetic-an']).toEqual(pageRecords['synthetic-an']);
  });
});
