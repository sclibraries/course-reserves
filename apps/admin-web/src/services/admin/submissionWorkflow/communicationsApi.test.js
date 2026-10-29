import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authFetch } from '../../http/authFetch';
import { communicationsApi } from './communicationsApi';

vi.mock('../../../config/api.config', () => ({
  apiConfig: { urls: { courseReserves: 'https://api.example.test/course-reserves' } },
}));
vi.mock('../../http/authFetch', () => ({ authFetch: vi.fn() }));

describe('communicationsApi errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps the reference id without exposing server error text', async () => {
    authFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Synthetic provider detail', reference: 'SYNTH-COMM-1' }),
    });

    await expect(communicationsApi.createCommunication('31', { message: 'Synthetic message' }))
      .rejects.toMatchObject({
        message: 'Communication request failed',
        reference: 'SYNTH-COMM-1',
      });
  });
});
