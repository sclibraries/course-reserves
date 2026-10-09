import { describe, expect, it } from 'vitest';
import { courseMatchesSubmissionTerm } from './CourseVerificationCard';

describe('courseMatchesSubmissionTerm', () => {
  it('matches the sandbox FOLIO term when the submission stores the sandbox term code', () => {
    const course = {
      courseListingObject: {
        termId: 'sandbox-term-2026',
        termObject: {
          id: 'sandbox-term-2026',
          name: 'Sandbox Term 2026',
        },
      },
    };
    const submission = {
      term: 'SANDBOX-2026',
    };

    expect(courseMatchesSubmissionTerm(course, submission)).toBe(true);
  });
});
