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
