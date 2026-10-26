import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { getByRole } from '@testing-library/dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

it('exposes linked courses as named links to their course pages', async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/admin/electronic']}>
        <AdminCourseHeader
          folioCourseData={{
            name: 'Biology',
            courseNumber: 'BIO 101',
            courseListingId: 42,
            courseListingObject: { instructorObjects: [] },
          }}
          linkedCourses={[{
            course_id: 8,
            folio_course_id: 42,
            course_name: 'Chemistry',
            course_number: 'CHEM 102',
          }]}
          copyToClipboard={vi.fn()}
          coursePermalink="/course/42"
        />
        <Routes>
          <Route path="/admin/electronic" element={<p>Current route</p>} />
          <Route path="/admin/electronic/42" element={<p>Course route reached</p>} />
          <Route path="/admin/electronic/42/syllabus-request" element={<p>Syllabus request route reached</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });

  const link = getByRole(container, 'link', { name: 'Chemistry (CHEM 102)' });
  expect(link.getAttribute('href')).toBe('/admin/electronic/42');

  await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
  expect(container.textContent).toContain('Course route reached');
});

it('links from the course header to the syllabus request route', async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/admin/electronic']}>
        <AdminCourseHeader
          folioCourseData={{
            name: 'Biology',
            courseNumber: 'BIO 101',
            courseListingId: 42,
            courseListingObject: { instructorObjects: [] },
          }}
          linkedCourses={[]}
          copyToClipboard={vi.fn()}
          coursePermalink="/course/42"
        />
        <Routes>
          <Route path="/admin/electronic" element={<p>Current route</p>} />
          <Route path="/admin/electronic/42/syllabus-request" element={<p>Syllabus request route reached</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });

  const link = getByRole(container, 'link', { name: 'Start a request from a syllabus' });
  expect(link.getAttribute('href')).toBe('/admin/electronic/42/syllabus-request');
  await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
  expect(container.textContent).toContain('Syllabus request route reached');
});
