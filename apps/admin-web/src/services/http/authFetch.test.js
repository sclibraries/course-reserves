import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { authFetch } from './authFetch';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('authFetch', () => {
  it('adds the current token while preserving request options and other headers', async () => {
    const getAuthToken = vi.spyOn(config.api, 'getAuthToken')
      .mockReturnValueOnce('Bearer first-token')
      .mockReturnValueOnce('Bearer second-token');
    const response = { ok: true };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    const init = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'synthetic-request-1',
        Authorization: 'Bearer stale-token',
      },
      body: '{"id":1}',
    };

    await expect(authFetch('/synthetic-endpoint', init)).resolves.toBe(response);
    await authFetch('/another-synthetic-endpoint');

    expect(fetchMock.mock.calls).toEqual([
      [
        '/synthetic-endpoint',
        {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': 'synthetic-request-1',
            Authorization: 'Bearer first-token',
          },
        },
      ],
      [
        '/another-synthetic-endpoint',
        { headers: { Authorization: 'Bearer second-token' } },
      ],
    ]);
    expect(getAuthToken).toHaveBeenCalledTimes(2);
  });
});
