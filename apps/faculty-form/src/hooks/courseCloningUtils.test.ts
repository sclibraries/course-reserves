import { describe, expect, it } from 'vitest';
import { buildPreviousCoursesQuery, mapFolioCourseToPreviousCourse } from './courseCloningUtils';

describe('course cloning search utilities', () => {
  it('queries with the complete instructor name and no first-name prefix wildcard', () => {
    expect(buildPreviousCoursesQuery('TST 101', 'Test Faculty A', 'exact'))
      .toContain('courseListing.instructorObjects="Test Faculty A"');
    expect(buildPreviousCoursesQuery('TST 101', 'Test Faculty A', 'exact')).not.toContain('Faculty A*');
  });

  it('does not map a course taught only by Test Faculty B for Test Faculty A', () => {
    const course = {
      courseNumber: 'TST 106',
      name: 'Test Course',
      courseListingObject: {
        id: 'listing-tst-106',
        termObject: { name: 'Fall 2026' },
        instructorObjects: [{ name: 'Test Faculty B' }],
      },
    };

    expect(mapFolioCourseToPreviousCourse(course, 'TST 101', 'Test Faculty A')).toBeNull();
  });

  it('matches an instructor name case- and whitespace-insensitively', () => {
    const course = {
      courseNumber: 'TST 101',
      name: 'Test Course',
      courseListingObject: {
        id: 'listing-tst-101',
        termObject: { name: 'Spring 2026' },
        instructorObjects: [{ name: '  test   faculty a  ' }],
      },
    };

    expect(mapFolioCourseToPreviousCourse(course, 'TST 101', 'Test Faculty A')?.instructor)
      .toBe('  test   faculty a  ');
  });
});
