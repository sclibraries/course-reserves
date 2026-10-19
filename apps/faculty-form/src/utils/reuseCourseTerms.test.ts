import { describe, expect, it } from 'vitest';
import type { PreviousCourse } from '@/hooks/useCourseCloning';
import {
  filterPreviousCoursesForSubmission,
  getPinnedPreviousCourse,
  sortPreviousCourses,
} from './reuseCourseTerms';

const makeCourse = (courseListingId: string, term: string, isExactMatch = true): PreviousCourse => ({
  courseListingId,
  courseNumber: isExactMatch ? 'TST 101' : 'TST 106',
  courseName: 'Test Course',
  term,
  instructor: 'Test Faculty A',
  resourceCount: 0,
  electronicCount: 0,
  physicalCount: 0,
  isExactMatch,
});

describe('reuse course terms', () => {
  it('keeps only earlier offerings, keeps unknown terms after dated courses, and never pins an unknown term', () => {
    const courses = [
      makeCourse('future', 'Spring 2027'),
      makeCourse('current', 'Fall 2026'),
      makeCourse('earlier', 'Spring 2026'),
      makeCourse('unknown', 'Special Session'),
    ];

    const eligible = filterPreviousCoursesForSubmission(courses, 'Fall 2026', 'TST 101');
    const ordered = sortPreviousCourses(eligible);

    expect(ordered.map((course) => course.courseListingId)).toEqual(['earlier', 'unknown']);
    expect(getPinnedPreviousCourse(ordered)?.courseListingId).toBe('earlier');
    expect(getPinnedPreviousCourse([
      makeCourse('older', 'Spring 2026'),
      makeCourse('newer', 'Summer 2026'),
    ])?.courseListingId).toBe('newer');
    expect(getPinnedPreviousCourse([makeCourse('unknown-exact', 'Special Session')])).toBeNull();
  });

  it('excludes the current unparseable same-course listing while keeping other unparseable courses', () => {
    const eligible = filterPreviousCoursesForSubmission([
      makeCourse('current-listing', 'Special Session'),
      makeCourse('other-course', 'Special Session', false),
    ], 'Special Session', 'TST 101');

    expect(eligible.map((course) => course.courseListingId)).toEqual(['other-course']);
  });
});
