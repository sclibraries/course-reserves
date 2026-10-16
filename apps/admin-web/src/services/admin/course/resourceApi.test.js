import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../http/authFetch', () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from '../../http/authFetch';
import { resourceApi } from './resourceApi';

describe('resourceApi EDS search errors', () => {
  beforeEach(() => {
    vi.mocked(authFetch).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows unavailable guidance and its reference for search_unavailable responses', async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error_code: 'search_unavailable', message: 'raw provider text', reference: '7F3K2Q' }),
    });

    await expect(resourceApi.searchEDS('climate change')).rejects.toMatchObject({
      message: 'Library search is temporarily unavailable. Please try again later, or add the item by citation.\nReference: 7F3K2Q',
    });
  });

  it('shows a friendly rate limit message for 429 responses', async () => {
    vi.mocked(authFetch).mockResolvedValue({ ok: false, status: 429 });

    await expect(resourceApi.searchEDS('climate change')).rejects.toMatchObject({
      message: 'There are too many searches right now. Please wait a moment and try again.',
    });
  });

  it('uses a generic friendly message for other errors', async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'HTTP 400: provider detail' }),
    });

    await expect(resourceApi.searchEDS('climate change')).rejects.toMatchObject({
      message: 'Unable to search the library right now. Please try again.',
    });
  });

  it('uses the same friendly handling for paginated EDS searches', async () => {
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error_code: 'search_unavailable', reference: '7F3K2Q' }),
    });

    await expect(resourceApi.searchEDSPage('synthetic-query', 2)).rejects.toMatchObject({
      message: 'Library search is temporarily unavailable. Please try again later, or add the item by citation.\nReference: 7F3K2Q',
    });
  });
});
