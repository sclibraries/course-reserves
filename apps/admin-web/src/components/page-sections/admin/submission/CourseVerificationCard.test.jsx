import { describe, expect, it } from 'vitest';
import { courseMatchesSubmissionTerm } from './CourseVerificationCard';

describe('courseMatchesSubmissionTerm', () => {
  it('matches the fake FOLIO term when the submission stores the term name', () => {
    const course = {
      courseListingObject: {
        termId: '00000000-0000-4000-8000-000000000002',
        termObject: {
          id: '00000000-0000-4000-8000-000000000002',
          name: 'Spring 2027',
        },
      },
    };
    const submission = {
      term: 'Spring 2027',
    };

    expect(courseMatchesSubmissionTerm(course, submission)).toBe(true);
  });
});
