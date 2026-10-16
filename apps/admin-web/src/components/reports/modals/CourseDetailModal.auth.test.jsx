import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../../config';
import CourseDetailModal from './CourseDetailModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CourseDetailModal request', () => {
  let container;
  let root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    document.cookie = 'accessToken=synthetic-aw048-token; path=/';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
      root = null;
    }
    container?.remove();
    container = null;
    document.cookie = 'accessToken=; Max-Age=0; path=/';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests course detail at the exact encoded URL with the staff token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        totalEvents: 1,
        uniqueSessions: 1,
        termsActive: 1,
        eventTypes: [{ event_type: 'page_view', count: 1 }],
        termData: [{ term: 'Fall 2026', count: 1, uniqueSessions: 1, eventTypes: 1 }],
        events: [{
          id: 1,
          event_type: 'page_view',
          term: 'Fall 2026',
          created_at: '2026-10-16T12:00:00Z',
          course_code: 'BIO 101',
          metadata: {},
        }],
      }),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        <CourseDetailModal
          isOpen
          toggle={vi.fn()}
          course={{ name: 'Biology & Chemistry 101', college: 'Smith College' }}
        />,
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${config.api.urls.courseReserves}/tracking/course-detail?course-name=Biology+%26+Chemistry+101&college=Smith+College`,
      { headers: { Authorization: 'Bearer synthetic-aw048-token' } },
    );
  });
});
