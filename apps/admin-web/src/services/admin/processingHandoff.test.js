import { describe, expect, it } from 'vitest';
import { buildProcessingHandoff, getProcessingBlockReason } from './processingHandoff';

describe('buildProcessingHandoff', () => {
  it('builds the electronic processing route and state from camelCase context', () => {
    const handoff = buildProcessingHandoff({
      id: 88,
      processingContext: {
        submissionId: 31,
        itemId: 88,
        folioCourseListingId: 'folio-course-123',
        offeringId: 44,
        canOpenProcessing: true,
        blockingReason: null,
      },
    });

    expect(handoff).toEqual({
      pathname: '/admin/electronic/folio-course-123',
      state: {
        processingContext: {
          submissionId: 31,
          submissionUuid: undefined,
          itemId: 88,
          folioCourseListingId: 'folio-course-123',
          offeringId: 44,
          itemStatus: undefined,
          claimedByStaffId: undefined,
          claimedAt: undefined,
          courseLinked: false,
          canOpenProcessing: true,
          blockingReason: null,
          returnTo: undefined,
        },
      },
    });
  });

  it('builds the electronic processing route and state from snake_case context', () => {
    const handoff = buildProcessingHandoff({
      id: 88,
      processing_context: {
        submission_id: 31,
        item_id: 88,
        folio_course_listing_id: 'folio-course-123',
        offering_id: 44,
        can_open_processing: true,
        blocking_reason: null,
      },
    });

    expect(handoff.pathname).toBe('/admin/electronic/folio-course-123');
    expect(handoff.state.processingContext.submissionId).toBe(31);
    expect(handoff.state.processingContext.itemId).toBe(88);
    expect(handoff.state.processingContext.offeringId).toBe(44);
  });

  it('returns null when the backend says processing cannot open yet', () => {
    const handoff = buildProcessingHandoff({
      processingContext: {
        folioCourseListingId: 'folio-course-123',
        canOpenProcessing: false,
        blockingReason: 'Submission is missing a local offering_id.',
      },
    });

    expect(handoff).toBeNull();
  });

  it('returns the backend blocking reason when processing cannot open yet', () => {
    const reason = getProcessingBlockReason({
      processingContext: {
        canOpenProcessing: false,
        blockingReason: 'Submission is missing a local offering_id.',
      },
    });

    expect(reason).toBe('Submission is missing a local offering_id.');
  });

  it('returns a generic blocking reason when context is missing', () => {
    expect(getProcessingBlockReason({})).toBe('Processing context is missing.');
  });
});
