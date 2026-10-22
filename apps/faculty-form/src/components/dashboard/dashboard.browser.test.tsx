import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CoursesTable } from './CoursesTable';
import { ReservesTable } from './ReservesTable';
import type { Submission } from '@/components/SubmissionCard';
import type { CourseAssignment } from '@/store/courseAssignmentsStore';
import { expectNoHorizontalOverflow } from '@/test/browser';

const longTitle = `Synthetic course title ${'with an extended description '.repeat(6)}`;
const assignment: CourseAssignment = {
  assignment: {
    academic_period: 'Fall 2026',
    course_id: 'TEST-101-01',
    course_title: longTitle,
    smith_id: 'test-faculty',
    role: 'instructor',
    created_at: '2026-07-21T00:00:00Z',
    updated_at: '2026-07-21T00:00:00Z',
  },
  parsed_course: { courseNumber: 'TEST 101', sectionName: '01', raw: 'TEST 101-01' },
  folio_term: { id: 'test-term-1', name: 'Fall 2026', startDate: '', endDate: '' },
  folio_course: { id: 'test-course-1', name: longTitle },
};
const submission: Submission = {
  id: 'test-submission-1',
  courseCode: 'TEST 101',
  courseTitle: longTitle,
  term: 'Fall 2026',
  status: 'submitted',
  totalItems: 3,
  completeItems: 0,
  inProgressItems: 1,
  needsReviewItems: 2,
  lastUpdated: 'Oct 22, 2026',
};

describe('dashboard tables in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  const render = async (content: ReactNode) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(<MemoryRouter>{content}</MemoryRouter>));
  };

  it('reflows a course assignment at supported widths', async () => {
    await render(<main><h1>Courses</h1><CoursesTable courses={[{ type: 'assignment', assignment, key: 'TEST-101-01' }]} /></main>);
    expect(container?.textContent).toContain(longTitle);
    await expectNoHorizontalOverflow();
  });

  it('reflows a submission row at supported widths', async () => {
    await render(<main><h1>Course reserves</h1><ReservesTable submissions={[submission]} /></main>);
    expect(container?.textContent).toContain(longTitle);
    await expectNoHorizontalOverflow();
  });
});
