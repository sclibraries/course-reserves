import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { CourseListView } from './CourseListView';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CourseListView', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });

    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  it('shows an exact-match loading state before the first previous-course request completes', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <CourseListView
          loadingPreviousCourses={false}
          hasLoadedPreviousCourses={false}
          previousCourses={[]}
          cloningFromCourse={null}
          userName="Test Faculty"
          currentItemsCount={0}
          courseCode="AFR 175"
          onPreviewCourse={() => undefined}
        />
      );
    });

    expect(container?.textContent).toContain('Checking for exact matches...');
    expect(container?.textContent).not.toContain('No Previous Courses Found');
  });

  it('shows exact matches while still indicating that other courses are loading', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <CourseListView
          loadingPreviousCourses={false}
          hasLoadedPreviousCourses={true}
          loadingOtherCourses={true}
          previousCourses={[
            {
              courseListingId: 'course-1',
              courseNumber: 'AFR 175',
              courseName: 'African Amer Lit 1900-pres',
              term: '2025 Fall',
              instructor: 'Test Faculty',
              resourceCount: 4,
              electronicCount: 3,
              physicalCount: 1,
              isExactMatch: true,
            },
          ]}
          cloningFromCourse={null}
          userName="Test Faculty"
          currentItemsCount={0}
          courseCode="AFR 175"
          onPreviewCourse={() => undefined}
        />
      );
    });

    expect(container?.textContent).toContain('Exact Matches (1)');
    expect(container?.textContent).toContain('Checking your other courses...');
    expect(container?.textContent).not.toContain('No Previous Courses Found');
  });
});