import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getByRole } from '@testing-library/dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ItemSearchResults from './ItemSearchResults';

const mocks = vi.hoisted(() => ({
  setRecord: vi.fn(),
  trackEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/trackingService', () => ({
  trackingService: { trackEvent: mocks.trackEvent },
}));
vi.mock('../../../store/searchStore', () => ({ default: (selector) => selector({ college: 'test-college' }) }));
vi.mock('../../../store/recordStore', () => ({
  default: () => ({ setRecord: mocks.setRecord }),
}));
vi.mock('../../../util/urlHelpers', () => ({
  buildFriendlyCourseUrl: () => '/course/test-bio',
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

it('exposes the course as a named link and tracks ordinary navigation', async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/search']}>
        <ItemSearchResults
          reserves={[{
            id: 1,
            copiedItem: { title: 'Test book' },
            course: {
              name: 'Biology',
              courseNumber: 'BIO 101',
              courseListingId: 42,
              courseListingObject: { instructorObjects: [] },
            },
          }]}
        />
        <Routes>
          <Route path="/search" element={<p>Search route</p>} />
          <Route path="/course/test-bio" element={<p>Course route reached</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });

  const link = getByRole(container, 'link', { name: 'Biology' });
  expect(link.getAttribute('href')).toBe('/course/test-bio');

  const modifiedClick = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ctrlKey: true,
  });
  await act(async () => link.dispatchEvent(modifiedClick));
  expect(modifiedClick.defaultPrevented).toBe(false);
  expect(mocks.setRecord).not.toHaveBeenCalled();

  await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
  expect(container.textContent).toContain('Course route reached');
  expect(mocks.setRecord).toHaveBeenCalledWith(42);
  expect(mocks.trackEvent).toHaveBeenCalledWith(expect.objectContaining({
    course_id: 42,
    event_type: 'course_access_from_item_search',
  }));
});
