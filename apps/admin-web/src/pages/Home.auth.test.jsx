import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import apiClient from '../services/apiClient';
import useSearchStore from '../store/searchStore';
import Home from './Home';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Home top-course request', () => {
  let container;
  let root;
  let originalAdapter;
  let adapter;
  const fetchMock = vi.fn();

  beforeEach(() => {
    document.cookie = 'accessToken=; Max-Age=0; path=/';
    useSearchStore.getState().setCollege('Smith & Hampshire');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        topCourses: [{ name: 'Biology 101', college: 'smith', count: 1, course_id: 7, instructors: [] }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    originalAdapter = apiClient.defaults.adapter;
    adapter = vi.fn(async request => ({
      data: {
        topCourses: [{ name: 'Biology 101', college: 'smith', count: 1, course_id: 7, instructors: [] }],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: request,
    }));
    apiClient.defaults.adapter = adapter;
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
      root = null;
    }
    container?.remove();
    container = null;
    useSearchStore.getState().setCollege('all');
    document.cookie = 'accessToken=; Max-Age=0; path=/';
    apiClient.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderHome() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>,
      );
    });
  }

  it('requests popular courses at the exact encoded URL without Authorization anonymously', async () => {
    await renderHome();

    expect(adapter).toHaveBeenCalledTimes(1);
    const request = adapter.mock.calls[0][0];
    expect(request.url).toBe(
      `${config.api.urls.courseReserves}/tracking/top-courses?limit=10&college=Smith%20%26%20Hampshire`,
    );
    expect(request.method).toBe('get');
    expect(request.headers.get('Authorization')).toBeUndefined();
  });

  it('allows the public client to send Authorization when a token exists', async () => {
    document.cookie = 'accessToken=synthetic-aw048-token; path=/';
    await renderHome();

    expect(adapter).toHaveBeenCalledTimes(1);
    const request = adapter.mock.calls[0][0];
    expect(request.url).toBe(
      `${config.api.urls.courseReserves}/tracking/top-courses?limit=10&college=Smith%20%26%20Hampshire`,
    );
    expect(request.headers.get('Authorization')).toBe('Bearer synthetic-aw048-token');
  });
});
