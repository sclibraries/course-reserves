import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './apiClient';
import { trackingService } from './trackingService';

describe('trackingService anonymous tracking', () => {
  let originalAdapter;
  let adapter;

  beforeEach(() => {
    document.cookie = 'accessToken=; Max-Age=0; path=/';
    originalAdapter = apiClient.defaults.adapter;
    adapter = vi.fn(async request => ({
      data: { accepted: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: request,
    }));
    apiClient.defaults.adapter = adapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    document.cookie = 'accessToken=; Max-Age=0; path=/';
    vi.restoreAllMocks();
  });

  it('posts tracking events without an Authorization header when no token exists', async () => {
    const event = { event_type: 'page_view', page: '/course/example' };

    await expect(trackingService.trackEvent(event)).resolves.toEqual({ accepted: true });

    const request = adapter.mock.calls[0][0];
    expect(request.url).toBe('/course-reserves/backend/web/tracking');
    expect(request.method).toBe('post');
    expect(request.data).toBe(JSON.stringify(event));
    expect(request.headers.get('Authorization')).toBeUndefined();
  });
});
