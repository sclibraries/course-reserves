import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ItemSearchResults from './ItemSearchResults';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setRecord: vi.fn(),
  trackEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
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

it('exposes a course navigation action as a button named for the course', async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
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
      />,
    );
  });

  const button = Array.from(container.querySelectorAll('button')).find((element) =>
    element.textContent.trim() === 'Biology'
  );
  expect(button).toBeTruthy();
  expect(button.getAttribute('role') || 'button').toBe('button');

  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(mocks.setRecord).toHaveBeenCalledWith(42);
  expect(mocks.navigate).toHaveBeenCalledWith('/course/test-bio');
});
