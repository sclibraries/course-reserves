import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseAssignment } from '@/store/courseAssignmentsStore';

let CourseAssignmentCard: typeof import('./CourseAssignmentCard').CourseAssignmentCard;
let useCourseReservesStore: typeof import('@/store/courseReservesStore').useCourseReservesStore;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CourseAssignmentCard roster course', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(async () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.resetModules();
    ({ useCourseReservesStore } = await import('@/store/courseReservesStore'));
    ({ CourseAssignmentCard } = await import('./CourseAssignmentCard'));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    useCourseReservesStore.setState({ reserves: [] });
    vi.unstubAllGlobals();
  });

  it('starts the exact roster course when the FOLIO term is missing', () => {
    const assignment = {
      assignment: {
        academic_period: 'AP_202702',
        course_id: 'BIO-101-01-202702',
        course_title: 'Synthetic Biology',
        smith_id: 'test-faculty',
        role: 'instructor',
        created_at: '2026-07-21T00:00:00Z',
        updated_at: '2026-07-21T00:00:00Z',
      },
      parsed_course: { courseNumber: 'BIO 101', sectionName: '01', raw: 'BIO 101-01' },
      folio_term: null,
      folio_course: { id: 'test-course-1', name: 'Synthetic Biology' },
    } as unknown as CourseAssignment;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<MemoryRouter><CourseAssignmentCard assignment={assignment} /></MemoryRouter>);
    });

    expect(container.textContent).toContain('Spring 2027');
    const addButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Add Reserves'));
    expect(addButton).toBeDefined();
    act(() => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(useCourseReservesStore.getState().reserves[0]).toMatchObject({
      courseAssignmentId: 'BIO-101-01-202702',
      academicPeriod: 'AP_202702',
      term: 'Spring 2027',
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
