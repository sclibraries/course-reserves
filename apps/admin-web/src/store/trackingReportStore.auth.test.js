import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import { useTrackingReportStore } from './trackingReportStore';

const token = 'Bearer synthetic-aw048-token';
const baseUrl = config.api.urls.courseReserves;

describe('tracking report requests', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    document.cookie = 'accessToken=synthetic-aw048-token; path=/';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    useTrackingReportStore.getState().clearAllState();
  });

  afterEach(() => {
    document.cookie = 'accessToken=; Max-Age=0; path=/';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches tracking events with the exact encoded filter URL and staff token', async () => {
    const payload = [{ id: 1 }];
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => '1' },
      json: vi.fn().mockResolvedValue(payload),
    });
    const store = useTrackingReportStore.getState();
    store.setServerPagination({ page: 2, pageSize: 10, totalItems: 0 });
    store.setSortConfig({ key: 'event type', direction: 'desc' });
    store.setCollegeFilter('Smith & Hampshire');
    store.setEventTypeFilter('course view');
    store.setTermFilter('Fall 2026');
    store.setDateRange({ start: '2026-08-01', end: '2026-12-31' });
    store.setSearchTerm('BIO 101 & 102');

    await store.fetchData();

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/tracking?page=2&per-page=10&sort-by=event%20type&sort-dir=desc&college=Smith%20%26%20Hampshire&event-type=course%20view&term=Fall%202026&start-date=2026-08-01&end-date=2026-12-31&search=BIO%20101%20%26%20102`,
      { headers: { Authorization: token } },
    );
    expect(useTrackingReportStore.getState().trackingEvents).toBe(payload);
    expect(useTrackingReportStore.getState().error).toBeNull();
  });

  it('fetches analytics with the exact encoded filter URL and staff token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ totalCount: 2 }) });
    const store = useTrackingReportStore.getState();
    store.setCollegeFilter('Smith & Hampshire');
    store.setTermFilter('Fall 2026');
    store.setSearchTerm('BIO 101 & 102');

    await store.fetchAnalytics();

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/tracking/analytics?college=Smith%20%26%20Hampshire&term=Fall%202026&search=BIO%20101%20%26%20102`,
      { headers: { Authorization: token } },
    );
    expect(useTrackingReportStore.getState().analyticsData.totalCount).toBe(2);
    expect(useTrackingReportStore.getState().analyticsError).toBeNull();
    expect(console.debug.mock.calls.flat().some(value => String(value).includes(baseUrl))).toBe(false);
  });
});
