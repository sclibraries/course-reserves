import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseAssignment } from '@/store/courseAssignmentsStore';

let CoursesTable: typeof import('./CoursesTable').CoursesTable;
let useCourseReservesStore: typeof import('@/store/courseReservesStore').useCourseReservesStore;

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

  beforeEach(async () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.resetModules();
    ({ useCourseReservesStore } = await import('@/store/courseReservesStore'));
    ({ CoursesTable } = await import('./CoursesTable'));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    useCourseReservesStore.setState({ reserves: [] });
    vi.unstubAllGlobals();
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

  it('keeps a course startable and uses its roster term when FOLIO has no term', () => {
    const rosterAssignment = {
      ...assignment,
      assignment: {
        ...assignment.assignment,
        academic_period: 'AP_202702',
        course_id: 'BIO-101-01-202702',
      },
      folio_term: null,
    } as unknown as CourseAssignment;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <MemoryRouter>
          <CoursesTable courses={[{
            type: 'assignment',
            assignment: rosterAssignment,
            key: 'BIO-101-01-202702',
          }]} />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain('Spring 2027');
    const addButton = [...(container.querySelectorAll('button'))]
      .find((button) => button.textContent?.includes('Add Reserves'));
    expect(addButton).toBeDefined();

    act(() => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(useCourseReservesStore.getState().reserves[0]).toMatchObject({
      term: 'Spring 2027',
      courseAssignmentId: 'BIO-101-01-202702',
      academicPeriod: 'AP_202702',
    });
    const persisted = JSON.parse(localStorage.getItem('course-reserves-storage') || '{}');
    expect(persisted.state.reserves[0]).toMatchObject({
      courseAssignmentId: 'BIO-101-01-202702',
      academicPeriod: 'AP_202702',
    });
  });
});

function makeLocalStorageMock() {
  const values: Record<string, string> = {};
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
  };
}
