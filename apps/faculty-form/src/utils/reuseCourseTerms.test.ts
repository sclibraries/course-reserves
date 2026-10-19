import { describe, expect, it } from 'vitest';
import type { PreviousCourse } from '@/hooks/useCourseCloning';
import {
  compareReuseTerms,
  filterPreviousCoursesForSubmission,
  getPinnedPreviousCourse,
  parseReuseTerm,
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
  it('compares earlier, later, same, and unparseable terms', () => {
    expect(compareReuseTerms('Spring 2026', 'Fall 2026')).toBeLessThan(0);
    expect(compareReuseTerms('Spring 2027', 'Fall 2026')).toBeGreaterThan(0);
    expect(compareReuseTerms('Fall 2026', 'Fall 2026')).toBe(0);
    expect(compareReuseTerms('Unknown Term', 'Fall 2026')).toBeNull();
  });

  it('orders Spring before Summer before Fall and recognizes January and Interterm', () => {
    expect(compareReuseTerms('Spring 2026', 'Summer 2026')).toBeLessThan(0);
    expect(compareReuseTerms('Summer 2026', 'Fall 2026')).toBeLessThan(0);
    expect(parseReuseTerm('January 2026')).toEqual({ year: 2026, rank: 0 });
    expect(parseReuseTerm('2026 Interterm')).toEqual({ year: 2026, rank: 0 });
  });

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
