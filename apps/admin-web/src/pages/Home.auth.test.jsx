import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import useSearchStore from '../store/searchStore';
import Home from './Home';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Home top-course request', () => {
  let container;
  let root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    document.cookie = 'accessToken=synthetic-aw048-token; path=/';
    useSearchStore.getState().setCollege('Smith & Hampshire');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        topCourses: [{ name: 'Biology 101', college: 'smith', count: 1, course_id: 7, instructors: [] }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests top courses at the exact encoded URL with the staff token', async () => {
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

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.courseReserves}/tracking/top-courses?limit=10&college=Smith%20%26%20Hampshire`,
      { headers: { Authorization: 'Bearer synthetic-aw048-token' } },
    );
  });
});
