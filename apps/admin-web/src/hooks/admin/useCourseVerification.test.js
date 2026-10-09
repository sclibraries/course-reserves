import { describe, expect, it, vi } from 'vitest';
import { shouldRunAutoSearch, verifyCourseSelection } from './useCourseVerification';

describe('verifyCourseSelection', () => {
  it('links the selected course and refreshes submission detail without a workflow loader', async () => {
    const submission = { id: 42 };
    const selectedCourse = { id: 'folio-course-123', name: 'Test Course' };
    const linkCourseOffering = vi.fn().mockResolvedValue({
      offering: { offering_id: 1463 },
    });
    const fetchSubmissionDetail = vi.fn().mockResolvedValue(undefined);
    const setVerifyingCourseId = vi.fn();
    const toastSuccess = vi.fn();
    const toastError = vi.fn();

    await verifyCourseSelection({
      submission,
      selectedCourse,
      linkCourseOffering,
      fetchSubmissionDetail,
      setVerifyingCourseId,
      toastSuccess,
      toastError,
    });

    expect(setVerifyingCourseId).toHaveBeenNthCalledWith(1, selectedCourse.id);
    expect(linkCourseOffering).toHaveBeenCalledWith(submission.id, selectedCourse);
    expect(fetchSubmissionDetail).toHaveBeenCalledWith(submission.id);
    expect(toastSuccess).toHaveBeenCalledWith('FOLIO course verified and linked.');
    expect(toastError).not.toHaveBeenCalled();
    expect(setVerifyingCourseId).toHaveBeenLastCalledWith(null);
  });
});

describe('shouldRunAutoSearch', () => {
  it('does not retry the same automatic course search after an attempted query fails empty', () => {
    const sanitizeQuery = (value) => value.trim();

    expect(shouldRunAutoSearch({
      submission: {
        folioCourseListingId: null,
        courseCode: 'TST 101',
      },
      searchResults: [],
      isSearching: false,
      attemptedAutoSearchQuery: 'TST 101',
      sanitizeQuery,
    })).toBe(false);
  });
});
