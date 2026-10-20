import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ENDPOINTS } from '@/config/endpoints';
import { getCatalogAvailability } from './catalogAvailabilityApi';

describe('getCatalogAvailability', () => {
  beforeEach(() => {
    document.cookie = 'accessToken=faculty-token; Path=/';
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const accessionNumbers = new URL(String(input)).searchParams.get('an')?.split(',') || [];
      return {
        ok: true,
        json: async () => ({
          records: Object.fromEntries(accessionNumbers.map((an) => [an, {
            instanceId: '00000000-0000-4000-8000-000000000089',
            copies: [{
              library: 'SC Neilson Library',
              location: 'Smith College Neilson Stacks',
              callNumber: 'QA 76 .A1',
              status: 'Available',
              loanType: 'Standard Loan',
            }],
          }])),
        }),
      };
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the authenticated course-reserves endpoint and maps copies by accession number', async () => {
    const response = await getCatalogAvailability(['synthetic-basic-an']);

    expect(fetch).toHaveBeenCalledWith(
      API_ENDPOINTS.COURSE_RESERVES.BASE_URL + '/catalog-availability?an=synthetic-basic-an',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer faculty-token' }),
      }),
    );
    expect(response['synthetic-basic-an']).toMatchObject({
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

    await expect(getCatalogAvailability(['synthetic-http-error-an'])).rejects.toThrow('Availability lookup failed');
  });

  it('shares an in-flight page lookup when the full record requests one of its accession numbers', async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn(() => pendingResponse);
    vi.stubGlobal('fetch', fetchMock);

    const pageLookup = getCatalogAvailability(['synthetic-flight-an', 'synthetic-flight-an-2']);
    const recordLookup = getCatalogAvailability(['synthetic-flight-an']);

    expect(fetchMock).toHaveBeenCalledOnce();
    resolveResponse({
      ok: true,
      json: async () => ({
        records: {
          'synthetic-flight-an': { instanceId: 'synthetic-instance', copies: [] },
          'synthetic-flight-an-2': { instanceId: null, copies: [] },
        },
      }),
    } as Response);

    const [pageRecords, recordRecords] = await Promise.all([pageLookup, recordLookup]);
    expect(recordRecords['synthetic-flight-an']).toEqual(pageRecords['synthetic-flight-an']);
  });

  it('reuses a resolved page lookup when the record route asks for the same accession number', async () => {
    const fetchMock = vi.mocked(fetch);
    await getCatalogAvailability(['synthetic-route-an', 'synthetic-route-an-2']);

    const routeRecords = await getCatalogAvailability(['synthetic-route-an']);

    expect(routeRecords['synthetic-route-an'].instanceId).toBe('00000000-0000-4000-8000-000000000089');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not cache a failed lookup and retries the accession number', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ message: 'private upstream diagnostics' }),
    } as Response);

    await expect(getCatalogAvailability(['synthetic-retry-an'])).rejects.toThrow('Availability lookup failed');
    await expect(getCatalogAvailability(['synthetic-retry-an'])).resolves.toHaveProperty('synthetic-retry-an');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('refetches resolved entries after the two-minute cache expiry', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    await getCatalogAvailability(['synthetic-expiring-an']);
    await getCatalogAvailability(['synthetic-expiring-an']);
    expect(fetch).toHaveBeenCalledOnce();

    now.mockReturnValue(122000);
    await getCatalogAvailability(['synthetic-expiring-an']);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('requests only uncached accession numbers in batches of at most 20', async () => {
    const accessionNumbers = Array.from({ length: 22 }, (_value, index) => `synthetic-batch-an-${index + 1}`);
    await getCatalogAvailability(accessionNumbers.slice(0, 20));
    await getCatalogAvailability(accessionNumbers);

    const requested = vi.mocked(fetch).mock.calls.flatMap(([input]) => (
      new URL(String(input)).searchParams.get('an')?.split(',') || []
    ));
    expect(requested).toHaveLength(22);
    expect(requested).toEqual(accessionNumbers);
    expect(vi.mocked(fetch).mock.calls.map(([input]) => (
      new URL(String(input)).searchParams.get('an')?.split(',').length
    ))).toEqual([20, 2]);
  });
});
