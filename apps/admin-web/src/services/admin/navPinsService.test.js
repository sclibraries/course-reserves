import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../http/authFetch', () => ({ authFetch: mocks.authFetch }));

import { apiConfig } from '../../config/api.config';
import { navPinsService } from './navPinsService';

const endpoint = `${apiConfig.urls.courseReserves}/staff-nav-pins`;
const response = (payload) => ({ ok: true, json: async () => payload });

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue(response({ pins: ['my-work'], is_default: false, defaults: [] }));
});

describe('navPinsService', () => {
  it('reads the signed-in staff member’s pins', async () => {
    await navPinsService.getPins();

    expect(mocks.authFetch).toHaveBeenCalledWith(endpoint, { method: 'GET' });
  });

  it('replaces pins with the requested ordered keys', async () => {
    await navPinsService.savePins(['my-work', 'submissions']);

    expect(mocks.authFetch).toHaveBeenCalledWith(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pins: ['my-work', 'submissions'] }),
    });
  });

  it('resets the signed-in staff member’s pins to defaults', async () => {
    await navPinsService.resetPins();

    expect(mocks.authFetch).toHaveBeenCalledWith(endpoint, { method: 'DELETE' });
  });
});
