import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiConfig } from '../../config/api.config';
import { facultyProxyService } from './facultyProxyService';

vi.mock('../../config/api.config', () => ({
  apiConfig: {
    urls: { courseReserves: 'https://api.example.test/course-reserves' },
    endpoints: {
      facultyProxy: {
        staffGrants: '/faculty-proxy/staff/grants',
        staffActivityLog: '/faculty-proxy/staff/activity-log',
      },
    },
    getAuthToken: () => 'Bearer synthetic-staff-token',
  },
}));

const response = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe('facultyProxyService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lists grants with config-derived URL, filters, and staff authorization', async () => {
    fetch.mockResolvedValue(response({ items: [], count: 0 }));

    await facultyProxyService.listGrants({ status: 'active', facultyId: 'test-faculty-7' });

    expect(fetch).toHaveBeenCalledWith(
      `${apiConfig.urls.courseReserves}${apiConfig.endpoints.facultyProxy.staffGrants}?status=active&faculty_id=test-faculty-7`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer synthetic-staff-token' }),
      })
    );
  });

  it('loads activity with a config-derived endpoint and optional faculty filter', async () => {
    fetch.mockResolvedValue(response({ items: [], count: 0 }));

    await facultyProxyService.getActivityLog({ facultyId: 'test-faculty-9' });

    expect(fetch).toHaveBeenCalledWith(
      `${apiConfig.urls.courseReserves}${apiConfig.endpoints.facultyProxy.staffActivityLog}?faculty_id=test-faculty-9`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer synthetic-staff-token' }),
      })
    );
  });

  it('revokes a grant with DELETE and returns the API response', async () => {
    const result = { success: true, message: 'Proxy access revoked' };
    fetch.mockResolvedValue(response(result));

    await expect(facultyProxyService.revokeGrant(23)).resolves.toEqual(result);

    expect(fetch).toHaveBeenCalledWith(
      `${apiConfig.urls.courseReserves}${apiConfig.endpoints.facultyProxy.staffGrants}/23`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('keeps API errors generic and preserves their reference', async () => {
    fetch.mockResolvedValue(response({ message: 'Synthetic server detail', reference: 'SYNTH-403' }, false, 403));

    await expect(facultyProxyService.listGrants()).rejects.toMatchObject({
      message: 'Faculty proxy request failed',
      reference: 'SYNTH-403',
    });
  });
});
