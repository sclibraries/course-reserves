import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CoursesTable } from './CoursesTable';
import type { CourseAssignment } from '@/store/courseAssignmentsStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const assignment: CourseAssignment = {
  assignment: {
    academic_period: 'Fall 2026',
    course_id: 'BIO-101-01',
    course_title: 'Synthetic Biology',
    smith_id: 'test-faculty',
    role: 'instructor',
    created_at: '2026-07-21T00:00:00Z',
    updated_at: '2026-07-21T00:00:00Z',
  },
  parsed_course: { courseNumber: 'BIO 101', sectionName: '01', raw: 'BIO 101-01' },
  folio_term: { id: 'test-term-1', name: 'Fall 2026', startDate: '', endDate: '' },
  folio_course: { id: 'test-course-1', name: 'Synthetic Biology' },
};

describe('CoursesTable acting-for permissions', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  const renderAssignment = (canEdit?: boolean) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <MemoryRouter>
          <CoursesTable
            courses={[{
              type: 'assignment',
              assignment: { ...assignment, canEdit },
              key: 'BIO-101-01',
            }]}
          />
        </MemoryRouter>,
      );
    });
  };

  it('hides reserve creation controls for a view-only acting-for course', () => {
    renderAssignment(false);

    expect(container?.textContent).toContain('Synthetic Biology');
    expect(container?.textContent).not.toContain('Add Reserves');
  });

  it('keeps reserve creation controls for editable courses', () => {
    renderAssignment(true);

    expect(container?.textContent).toContain('Add Reserves');
  });
});
