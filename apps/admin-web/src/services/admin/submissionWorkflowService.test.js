import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submissionWorkflowService } from './submissionWorkflowService';

vi.mock('../../config/api.config', () => ({
  apiConfig: {
    urls: {
      courseReserves: 'https://course-reserves.test',
    },
    getAuthToken: () => 'Bearer test-token',
  },
}));

describe('submissionWorkflowService.updateItemStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 123, item_status: 'in_progress' }),
    }));
  });

  it('updates item status through the routed item endpoint', async () => {
    await submissionWorkflowService.updateItemStatus(123, 'in_progress');

    expect(fetch).toHaveBeenCalledWith(
      'https://course-reserves.test/submission-workflow/item/123',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ item_status: 'in_progress' }),
      })
    );
  });
});

describe('submissionWorkflowService.completeProcessing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        item: {
          id: 123,
          item_status: 'complete',
          materialized_resource_id: 456,
          materialized_course_resource_id: 789,
        },
      }),
    }));
  });

  it('publishes a processed workflow item through the routed completion endpoint', async () => {
    const result = await submissionWorkflowService.completeProcessing(123, {
      staff_notes: 'Ready for students',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://course-reserves.test/submission-workflow/item/123/complete-processing',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ staff_notes: 'Ready for students' }),
      })
    );
    expect(result.item.materialized_resource_id).toBe(456);
  });
});

describe('submissionWorkflowService.formatSubmissionDetail', () => {
  it('exposes the roster and link state fields used by the linking panel', () => {
    const formatted = submissionWorkflowService.formatSubmissionDetail({
      submission_id: 32,
      submission_uuid: 'synthetic-linking-uuid',
      course_code: 'AFR 155',
      course_title: 'African Studies',
      section: '01',
      term_code: '2026FA',
      roster_term_id: 'synthetic-term-id',
      academic_period: '2026FA',
      its_course_id: 'AFR-155-01-2026FA',
      link_state: 'linked',
      link_flag: 'mismatch_override',
      linked_at: '2026-10-16T12:00:00Z',
      linked_by: 'synthetic-staff',
      folio_course_listing_id: 'synthetic-listing-id',
      offering_id: 44,
      newResources: [],
      reuseResources: [],
      communications: [],
    });

    expect(formatted.submission).toEqual(expect.objectContaining({
      uuid: 'synthetic-linking-uuid',
      courseCode: 'AFR 155',
      section: '01',
      term: '2026FA',
      rosterTermId: 'synthetic-term-id',
      academicPeriod: '2026FA',
      itsCourseId: 'AFR-155-01-2026FA',
      linkState: 'linked',
      linkFlag: 'mismatch_override',
      linkedAt: '2026-10-16T12:00:00Z',
      linkedBy: 'synthetic-staff',
      folioCourseListingId: 'synthetic-listing-id',
      offeringId: 44,
    }));
  });

  it('preserves processing context and course linkage fields on normalized items', () => {
    const formatted = submissionWorkflowService.formatSubmissionDetail({
      submission_id: 31,
      submission_uuid: 'submission-uuid',
      course_code: 'ENG 101',
      course_title: 'Intro to Literature',
      term_code: '2026SP',
      faculty_display_name: 'Prof. Example',
      status: 'in_review',
      folio_course_listing_id: 'folio-course-123',
      offering_id: 44,
      newResources: [
        {
          id: 88,
          resource_data: JSON.stringify({ title: 'Requested title' }),
          item_status: 'in_progress',
          folio_course_listing_id: 'folio-course-123',
          offering_id: 44,
          materialized_resource_id: 456,
          materialized_course_resource_id: 789,
          materialized_physical_reference_id: null,
          materialized_folder_id: 12,
          materialized_at: '2026-04-14 12:00:00',
          materialized_by_staff_id: '27',
          processing_context: {
            submission_id: 31,
            submission_uuid: 'submission-uuid',
            item_id: 88,
            folio_course_listing_id: 'folio-course-123',
            offering_id: 44,
            item_status: 'in_progress',
            claimed_by_staff_id: 27,
            claimed_at: '2026-04-14 11:00:00',
            course_linked: true,
            can_open_processing: true,
            blocking_reason: null,
            return_to: '/admin/submissions/31',
          },
        },
      ],
      reuseResources: [],
      communications: [],
    });

    expect(formatted.submission.folioCourseListingId).toBe('folio-course-123');
    expect(formatted.submission.offeringId).toBe(44);
    expect(formatted.unfolderedItems[0].folioCourseListingId).toBe('folio-course-123');
    expect(formatted.unfolderedItems[0].offeringId).toBe(44);
    expect(formatted.unfolderedItems[0]).toEqual(expect.objectContaining({
      materializedResourceId: 456,
      materializedCourseResourceId: 789,
      materializedPhysicalReferenceId: null,
      materializedFolderId: 12,
      materializedAt: '2026-04-14 12:00:00',
      materializedByStaffId: '27',
    }));
    expect(formatted.unfolderedItems[0].processingContext).toEqual({
      submissionId: 31,
      itemId: 88,
      folioCourseListingId: 'folio-course-123',
      offeringId: 44,
      submissionUuid: 'submission-uuid',
      itemStatus: 'in_progress',
      claimedByStaffId: 27,
      claimedAt: '2026-04-14 11:00:00',
      courseLinked: true,
      canOpenProcessing: true,
      blockingReason: null,
      returnTo: '/admin/submissions/31',
    });
  });
});

describe('submissionWorkflowService.getMyClaimedItems', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: 88,
          resource_data: JSON.stringify({ title: 'Claimed title' }),
          item_status: 'in_progress',
          folio_course_listing_id: 'folio-course-123',
          offering_id: 44,
          materialized_resource_id: 456,
          materialized_course_resource_id: 789,
          materialized_physical_reference_id: null,
          materialized_folder_id: 12,
          materialized_at: '2026-04-14 12:00:00',
          materialized_by_staff_id: '27',
          processing_context: {
            submission_id: 31,
            item_id: 88,
            folio_course_listing_id: 'folio-course-123',
            offering_id: 44,
            can_open_processing: true,
            blocking_reason: null,
          },
          submission: {
            submission_id: 31,
            course_code: 'ENG 101',
            faculty_display_name: 'Prof. Example',
            folio_course_listing_id: 'folio-course-123',
            offering_id: 44,
          },
        },
      ]),
    }));
  });

  it('normalizes claimed item processing context at the service boundary', async () => {
    const items = await submissionWorkflowService.getMyClaimedItems();

    expect(items[0]).toEqual(expect.objectContaining({
      id: 88,
      title: 'Claimed title',
      folioCourseListingId: 'folio-course-123',
      offeringId: 44,
      materializedResourceId: 456,
      materializedCourseResourceId: 789,
      processingContext: expect.objectContaining({
        submissionId: 31,
        itemId: 88,
        folioCourseListingId: 'folio-course-123',
        offeringId: 44,
        canOpenProcessing: true,
        blockingReason: null,
      }),
    }));
  });
});
