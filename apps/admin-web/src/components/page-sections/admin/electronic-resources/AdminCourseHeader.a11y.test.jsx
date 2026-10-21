import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import AdminCourseHeader from './AdminCourseHeader';

vi.mock('@fortawesome/react-fontawesome', () => ({ FontAwesomeIcon: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

it('exposes linked courses as buttons by their course name and navigates when activated', async () => {
  const navigate = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <AdminCourseHeader
        folioCourseData={{
          name: 'Biology',
          courseNumber: 'BIO 101',
          courseListingObject: { instructorObjects: [] },
        }}
        linkedCourses={[{
          course_id: 8,
          folio_course_id: 42,
          course_name: 'Chemistry',
          course_number: 'CHEM 102',
        }]}
        navigate={navigate}
        copyToClipboard={vi.fn()}
        coursePermalink="/course/42"
      />,
    );
  });

  const button = Array.from(container.querySelectorAll('button')).find((element) =>
    element.textContent.trim() === 'Chemistry (CHEM 102)'
  );
  expect(button).toBeTruthy();
  expect(button.getAttribute('role') || 'button').toBe('button');

  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(navigate).toHaveBeenCalledWith('/admin/electronic/42');
});
