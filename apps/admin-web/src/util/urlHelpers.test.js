import { describe, expect, it } from 'vitest';
import { buildFriendlyCourseUrl } from './urlHelpers';

describe('buildFriendlyCourseUrl', () => {
  it.each([
    [
      'a full course',
      {
        courseNumber: 'BIO 101',
        name: 'Introduction to Biology',
        courseListingObject: { termObject: { name: 'Fall 2026' } },
        courseListingId: 'test-listing-1',
      },
      '/course/fall-2026/bio-101/introduction-to-biology?id=test-listing-1',
    ],
    [
      'a course without a term name',
      {
        courseNumber: 'BIO 101',
        name: 'Introduction to Biology',
        courseListingObject: { termObject: {} },
        courseListingId: 'test-listing-1',
      },
      '/records?courseListingId=test-listing-1',
    ],
    [
      'a course without a course number',
      {
        name: 'Introduction to Biology',
        courseListingObject: { termObject: { name: 'Fall 2026' } },
        courseListingId: 'test-listing-1',
      },
      '/records?courseListingId=test-listing-1',
    ],
    [
      'a course without a course name',
      {
        courseNumber: 'BIO 101',
        courseListingObject: { termObject: { name: 'Fall 2026' } },
        courseListingId: 'test-listing-1',
      },
      '/records?courseListingId=test-listing-1',
    ],
  ])('returns the expected URL for %s', (_description, course, expectedUrl) => {
    expect(buildFriendlyCourseUrl(course)).toBe(expectedUrl);
  });
});
