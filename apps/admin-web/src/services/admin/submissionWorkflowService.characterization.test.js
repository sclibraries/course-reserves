import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiConfig } from '../../config/api.config';
import { submissionWorkflowService } from './submissionWorkflowService';

const courseApi = apiConfig.urls.courseReserves;
const token = 'Bearer synthetic-aw043-token';
const headers = {
  Authorization: token,
  'Content-Type': 'application/json',
};
const result = { success: true, id: 17 };

let fetchMock;

beforeEach(() => {
  document.cookie = 'accessToken=synthetic-aw043-token; path=/';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  document.cookie = 'accessToken=; Max-Age=0; path=/';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const requestCases = [
  {
    name: 'getPendingSubmissions',
    invoke: () => submissionWorkflowService.getPendingSubmissions(3, 12),
    url: `${courseApi}/submission-workflow/pending-submissions?page=3&per_page=12`,
    init: { headers },
    responseBody: { items: [{ id: 17 }], _meta: { totalCount: 1 }, _links: {} },
    expected: { items: [{ id: 17 }], _meta: { totalCount: 1 }, _links: {} },
  },
  {
    name: 'getSubmissionDetail',
    invoke: () => submissionWorkflowService.getSubmissionDetail(17),
    url: `${courseApi}/submission-workflow/submission/17`,
    init: { headers },
    expected: result,
  },
  {
    name: 'lockSubmission',
    invoke: () => submissionWorkflowService.lockSubmission('synthetic-uuid', 'Reviewing request'),
    url: `${courseApi}/faculty-submission/synthetic-uuid/lock`,
    init: { method: 'POST', headers, body: JSON.stringify({ lock_reason: 'Reviewing request' }) },
    expected: result,
  },
  {
    name: 'unlockSubmission',
    invoke: () => submissionWorkflowService.unlockSubmission('synthetic-uuid'),
    url: `${courseApi}/faculty-submission/synthetic-uuid/unlock`,
    init: { method: 'POST', headers },
    expected: result,
  },
  {
    name: 'updateItem',
    invoke: () => submissionWorkflowService.updateItem(18, { item_status: 'complete', staff_notes: 'Done' }),
    url: `${courseApi}/submission-workflow/item/18`,
    init: {
      method: 'PUT',
      headers,
      body: JSON.stringify({ item_status: 'complete', staff_notes: 'Done' }),
    },
    expected: result,
  },
  {
    name: 'claimItem',
    invoke: () => submissionWorkflowService.claimItem(19),
    url: `${courseApi}/submission-workflow/item/19/claim`,
    init: { method: 'POST', headers },
    expected: result,
  },
  {
    name: 'unclaimItem',
    invoke: () => submissionWorkflowService.unclaimItem(20),
    url: `${courseApi}/submission-workflow/item/20/unclaim`,
    init: { method: 'POST', headers },
    expected: result,
  },
  {
    name: 'assignItem',
    invoke: () => submissionWorkflowService.assignItem(21, 5, 'Synthetic assignment'),
    url: `${courseApi}/submission-workflow/item/21/assign`,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: 5, reason: 'Synthetic assignment' }),
    },
    expected: result,
  },
  {
    name: 'updateItemStatus',
    invoke: () => submissionWorkflowService.updateItemStatus(22, 'in_progress'),
    url: `${courseApi}/submission-workflow/item/22`,
    init: { method: 'PUT', headers, body: JSON.stringify({ item_status: 'in_progress' }) },
    expected: result,
  },
  {
    name: 'completeProcessing',
    invoke: () => submissionWorkflowService.completeProcessing(23, { staff_notes: 'Synthetic note' }),
    url: `${courseApi}/submission-workflow/item/23/complete-processing`,
    init: { method: 'POST', headers, body: JSON.stringify({ staff_notes: 'Synthetic note' }) },
    expected: result,
  },
  {
    name: 'switchItemWorkflow',
    invoke: () => submissionWorkflowService.switchItemWorkflow(24, 6),
    url: `${courseApi}/submission-workflow/item/24/switch-workflow`,
    init: { method: 'POST', headers, body: JSON.stringify({ template_id: 6 }) },
    expected: result,
  },
  {
    name: 'addStaffCommunication',
    invoke: () => submissionWorkflowService.addStaffCommunication(25, 'Synthetic update', [4, 5]),
    url: `${courseApi}/submission-workflow/item/25/staff-message`,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Synthetic update', mentioned_user_ids: [4, 5] }),
    },
    expected: result,
  },
  {
    name: 'getStaffCommunications',
    invoke: () => submissionWorkflowService.getStaffCommunications(26),
    url: `${courseApi}/submission-workflow/item/26/staff-messages`,
    init: { headers },
    expected: result,
  },
  {
    name: 'getStaffUsers',
    invoke: () => submissionWorkflowService.getStaffUsers(),
    url: `${courseApi}/user/staff`,
    init: { headers },
    expected: result,
  },
  {
    name: 'getMyClaimedItems',
    invoke: () => submissionWorkflowService.getMyClaimedItems(),
    url: `${courseApi}/submission-workflow/my-claimed-items`,
    init: { headers },
    responseBody: [],
    expected: [],
  },
  {
    name: 'getCurrentUser',
    invoke: () => submissionWorkflowService.getCurrentUser(),
    url: `${courseApi}/user/current`,
    init: { headers },
    expected: result,
  },
  {
    name: 'getSubmissionCommunications',
    invoke: () => submissionWorkflowService.getSubmissionCommunications(27),
    url: `${courseApi}/submission-workflow/submission/27/communications`,
    init: { headers },
    responseBody: { messages: [{ id: 8 }] },
    expected: [{ id: 8 }],
  },
  {
    name: 'createCommunication',
    invoke: () => submissionWorkflowService.createCommunication(28, { message: 'Synthetic message' }),
    url: `${courseApi}/submission-workflow/submission/28/communications`,
    init: { method: 'POST', headers, body: JSON.stringify({ message: 'Synthetic message' }) },
    expected: result,
  },
  {
    name: 'updateCommunication',
    invoke: () => submissionWorkflowService.updateCommunication(29, { message: 'Edited message' }),
    url: `${courseApi}/submission-workflow/communications/29`,
    init: { method: 'PUT', headers, body: JSON.stringify({ message: 'Edited message' }) },
    expected: result,
  },
  {
    name: 'markAsRead',
    invoke: () => submissionWorkflowService.markAsRead(30),
    url: `${courseApi}/submission-workflow/communications/30/read`,
    init: { method: 'POST', headers },
    expected: result,
  },
  {
    name: 'searchStaff',
    invoke: () => submissionWorkflowService.searchStaff('ana & sam'),
    url: `${courseApi}/submission-workflow/search-staff?q=ana%20%26%20sam`,
    init: { headers },
    responseBody: { users: [{ id: 31 }] },
    expected: [{ id: 31 }],
  },
  {
    name: 'getUnreadCount',
    invoke: () => submissionWorkflowService.getUnreadCount(),
    url: `${courseApi}/submission-workflow/my-unread-count`,
    init: { headers },
    expected: result,
  },
  {
    name: 'getMyMentions',
    invoke: () => submissionWorkflowService.getMyMentions(),
    url: `${courseApi}/submission-workflow/my-mentions`,
    init: { headers },
    expected: result,
  },
  {
    name: 'linkFolioCourse',
    invoke: () => submissionWorkflowService.linkFolioCourse(32, 7, { course_id: 'folio-course-33' }),
    url: `${courseApi}/workflow-admin/instance/32/steps/7/folio/link`,
    init: { method: 'POST', headers, body: JSON.stringify({ course_id: 'folio-course-33' }) },
    expected: result,
  },
];

describe('submissionWorkflowService characterization', () => {
  it.each(requestCases)('$name preserves its authenticated request and response', async (testCase) => {
    const responseBody = testCase.responseBody ?? result;
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(responseBody) });

    await expect(testCase.invoke()).resolves.toEqual(testCase.expected);

    expect(fetchMock.mock.calls).toEqual([[testCase.url, testCase.init]]);
  });

  it('keeps the token accessor public and does not fetch for formatting helpers', async () => {
    expect(submissionWorkflowService.getAuthToken()).toBe(token);
    expect(submissionWorkflowService.formatProcessingContext({
      submission_id: 17,
      item_id: 18,
      course_linked: true,
    })).toEqual(expect.objectContaining({
      submissionId: 17,
      itemId: 18,
      courseLinked: true,
    }));
    await expect(submissionWorkflowService.searchStaff('x')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves the lock error when the API rejects the request', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409 });

    await expect(submissionWorkflowService.lockSubmission('synthetic-uuid', 'Reviewing request'))
      .rejects.toThrow('Failed to lock submission: 409');
    expect(fetchMock.mock.calls).toEqual([[
      `${courseApi}/faculty-submission/synthetic-uuid/lock`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ lock_reason: 'Reviewing request' }),
      },
    ]]);
  });
});

describe('submissionWorkflowService formatter characterization', () => {
  it('formats a submission for the queue with exact item and status counts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));

    const submission = {
      submission_id: 17,
      submission_uuid: 'submission-17',
      course_code: 'BIO-101-01',
      course_title: 'Introduction to Biology',
      section: null,
      term_code: '2026FA',
      faculty_display_name: 'Pat Example',
      shibboleth_user_id: 'pexample',
      status: 'submitted',
      submitted_at: '2026-10-13T12:00:00.000Z',
      is_locked: 1,
      locked_by_staff_id: 52,
      locked_at: '2026-10-13T13:00:00.000Z',
      assignee_staff_user_id: 53,
      newResources: [{
        id: 101,
        resource_data: JSON.stringify({ title: 'New item', authors: 'A. Writer', materialType: 'book' }),
        source_barcode: 'SYNTH-BC-101',
        source_call_number: 'QA 101',
        item_status: 'complete',
        is_reuse: 0,
        display_order: 2,
        folder_name: 'Week 1',
      }],
      reuseResources: [{
        id: 102,
        resource_data: JSON.stringify({ title: 'Reused item', materialType: 'article' }),
        source_barcode: 'SYNTH-BC-102',
        source_call_number: 'QH 102',
        item_status: 'pending',
        is_reuse: 1,
      }],
      communications: [{ is_read: false }, { is_read: true }],
    };

    expect(submissionWorkflowService.formatSubmissionForDisplay(submission)).toEqual({
      submissionId: 17,
      submissionUuid: 'submission-17',
      courseCode: 'BIO-101-01',
      courseTitle: 'Introduction to Biology',
      section: '',
      term: '2026FA',
      facultyName: 'Pat Example',
      facultyId: 'pexample',
      status: 'submitted',
      submittedAt: '2026-10-13T12:00:00.000Z',
      totalItems: 2,
      pendingItems: 1,
      inProgressItems: 0,
      completeItems: 1,
      unavailableItems: 0,
      daysSinceSubmission: 1,
      isLocked: true,
      lockedBy: 52,
      lockedAt: '2026-10-13T13:00:00.000Z',
      assignedTo: 53,
      communicationsCount: 2,
      unreadCommunications: 1,
      completionPercentage: 50,
      priority: 'normal',
    });
  });

  it('formats processing context from camelCase and snake_case and preserves null', () => {
    expect(submissionWorkflowService.formatProcessingContext(null)).toBeNull();
    expect(submissionWorkflowService.formatProcessingContext({
      submissionId: 17,
      submissionUuid: 'submission-17',
      itemId: 101,
      folioCourseListingId: 700,
      offeringId: 701,
      itemStatus: 'complete',
      claimedByStaffId: 52,
      claimedAt: '2026-10-12T09:15:00.000Z',
      courseLinked: true,
      canOpenProcessing: false,
      blockingReason: 'Course already linked',
      returnTo: '/admin/work-queue',
    })).toEqual({
      submissionId: 17,
      submissionUuid: 'submission-17',
      itemId: 101,
      folioCourseListingId: 700,
      offeringId: 701,
      itemStatus: 'complete',
      claimedByStaffId: 52,
      claimedAt: '2026-10-12T09:15:00.000Z',
      courseLinked: true,
      canOpenProcessing: false,
      blockingReason: 'Course already linked',
      returnTo: '/admin/work-queue',
    });
    expect(submissionWorkflowService.formatProcessingContext({
      submission_id: 17,
      submission_uuid: 'submission-17',
      item_id: 101,
      folio_course_listing_id: 700,
      offering_id: 701,
      item_status: 'pending',
      claimed_by_staff_id: 52,
      claimed_at: '2026-10-12T09:15:00.000Z',
      course_linked: 0,
      can_open_processing: 1,
      blocking_reason: null,
      return_to: '/admin/work-queue',
    })).toEqual({
      submissionId: 17,
      submissionUuid: 'submission-17',
      itemId: 101,
      folioCourseListingId: 700,
      offeringId: 701,
      itemStatus: 'pending',
      claimedByStaffId: 52,
      claimedAt: '2026-10-12T09:15:00.000Z',
      courseLinked: false,
      canOpenProcessing: true,
      blockingReason: null,
      returnTo: '/admin/work-queue',
    });
  });

  it('formats a claimed item using resource data, fallbacks, and processing context', () => {
    const item = {
      id: 101,
      resource_data: JSON.stringify({
        title: 'Chapter 1',
        authors: 'A. Writer',
        materialType: 'book',
        barcode: 'JSON-BC-101',
        callNumber: 'JSON QA 101',
        url: 'https://example.edu/chapter-1',
      }),
      source_barcode: 'SYNTH-BC-101',
      source_call_number: 'QA 101',
      materialType: { name: 'Book' },
      folio_course_listing_id: 700,
      offering_id: null,
      submission: { offering_id: 701 },
      materialized_resource_id: 801,
      materialized_physical_reference_id: null,
      materialized_at: '2026-10-12T10:00:00.000Z',
      materialized_by_staff_id: 52,
      processing_context: { submission_id: 17, item_id: 101, course_linked: true },
    };

    expect(submissionWorkflowService.formatClaimedItem(item)).toEqual({
      ...item,
      title: 'Chapter 1',
      authors: 'A. Writer',
      materialTypeName: 'Book',
      barcode: 'SYNTH-BC-101',
      callNumber: 'QA 101',
      url: 'https://example.edu/chapter-1',
      folioCourseListingId: 700,
      offeringId: 701,
      materializedResourceId: 801,
      materializedCourseResourceId: null,
      materializedPhysicalReferenceId: null,
      materializedFolderId: null,
      materializedAt: '2026-10-12T10:00:00.000Z',
      materializedByStaffId: 52,
      processingContext: {
        submissionId: 17,
        submissionUuid: undefined,
        itemId: 101,
        folioCourseListingId: undefined,
        offeringId: undefined,
        itemStatus: undefined,
        claimedByStaffId: undefined,
        claimedAt: undefined,
        courseLinked: true,
        canOpenProcessing: false,
        blockingReason: null,
        returnTo: undefined,
      },
    });
  });

  it('formats nested submission resources, processing context, folders, and communications', () => {
    const response = {
      submission_id: 17,
      submission_uuid: 'submission-17',
      course_code: 'BIO-101-01',
      course_title: 'Introduction to Biology',
      section: '01',
      term_code: '2026FA',
      faculty_display_name: 'Pat Example',
      shibboleth_user_id: 'pexample',
      proxy_display_name: 'Alex Proxy',
      proxy_shibboleth_user_id: 'aproxy',
      status: 'submitted',
      submitted_at: '2026-10-12T08:00:00.000Z',
      needed_by_date: '2026-11-01',
      submission_notes: 'Synthetic submission note',
      is_locked: 1,
      locked_by_staff_id: 52,
      locked_at: '2026-10-12T09:00:00.000Z',
      lock_reason: 'Processing items',
      assignee_staff_user_id: 53,
      is_duplicate_previous: 0,
      duplicate_note: null,
      email_confirmation_sent: 1,
      folio_course_listing_id: 700,
      offering_id: 701,
      workflowAssignment: { id: 9, status: 'active' },
      newResources: [{
        id: 101,
        resource_data: JSON.stringify({
          title: 'Chapter 1',
          authors: 'A. Writer',
          materialType: 'book',
          url: 'https://example.edu/chapter-1',
          isbn: '978-0-00-000001-1',
          publisher: 'Example Press',
          publicationYear: 2022,
        }),
        source_barcode: 'SYNTH-BC-101',
        source_call_number: 'QA 101',
        item_status: 'complete',
        folder_name: 'Week 1',
        display_order: 2,
        position_in_folder: 1,
        faculty_notes: 'Please use chapter 1.',
        staff_notes: 'Claimed by Pat Example at 2026-10-12 09:15:00',
        is_reuse: 0,
        priority: 'high',
        material_type_id: 3,
        source_resource_id: 10,
        source_folio_instance_id: 20,
        folio_course_listing_id: 700,
        offering_id: 701,
        materialized_resource_id: 801,
        materialized_course_resource_id: 802,
        materialized_physical_reference_id: 803,
        materialized_folder_id: 804,
        materialized_at: '2026-10-12T10:00:00.000Z',
        materialized_by_staff_id: 52,
        claimed_by_staff_id: '52',
        claimed_by_username: 'pexample',
        claimed_at: '2026-10-12T09:15:00.000Z',
        processing_context: {
          submission_id: 17,
          submission_uuid: 'submission-17',
          item_id: 101,
          folio_course_listing_id: 700,
          offering_id: 701,
          item_status: 'complete',
          claimed_by_staff_id: 52,
          claimed_at: '2026-10-12T09:15:00.000Z',
          course_linked: true,
          can_open_processing: false,
          blocking_reason: 'Course already linked',
          return_to: '/admin/work-queue',
        },
      }],
      reuseResources: [{
        id: 102,
        resource_data: JSON.stringify({ title: 'Journal article', materialType: 'article' }),
        source_barcode: null,
        source_call_number: null,
        item_status: 'pending',
        folder_name: null,
        display_order: 1,
        position_in_folder: null,
        faculty_notes: null,
        is_reuse: 1,
        priority: 'medium',
        material_type_id: 4,
        source_resource_id: 22,
        source_folio_instance_id: 23,
      }],
      communications: [
        { id: 501, resource_id: 101, is_read: false, message: 'Synthetic item update' },
        { id: 502, resource_id: null, is_read: true, message: 'Synthetic general update' },
      ],
    };

    const itemProcessingContext = {
      submissionId: 17,
      submissionUuid: 'submission-17',
      itemId: 101,
      folioCourseListingId: 700,
      offeringId: 701,
      itemStatus: 'complete',
      claimedByStaffId: 52,
      claimedAt: '2026-10-12T09:15:00.000Z',
      courseLinked: true,
      canOpenProcessing: false,
      blockingReason: 'Course already linked',
      returnTo: '/admin/work-queue',
    };
    const itemCommunication = { id: 501, resource_id: 101, is_read: false, message: 'Synthetic item update' };
    const generalCommunication = { id: 502, resource_id: null, is_read: true, message: 'Synthetic general update' };
    const formattedItem = {
      id: 101,
      title: 'Chapter 1',
      authors: 'A. Writer',
      materialType: 'book',
      url: 'https://example.edu/chapter-1',
      isbn: '978-0-00-000001-1',
      publisher: 'Example Press',
      doi: null,
      issn: null,
      journalTitle: null,
      volume: null,
      issue: null,
      eds: null,
      publicationYear: 2022,
      barcode: 'SYNTH-BC-101',
      callNumber: 'QA 101',
      status: 'complete',
      folderName: 'Week 1',
      displayOrder: 2,
      positionInFolder: 1,
      facultyNotes: 'Please use chapter 1.',
      staffNotes: 'Claimed by Pat Example at 2026-10-12 09:15:00',
      isReuse: false,
      priority: 'high',
      materialTypeId: 3,
      sourceResourceId: 10,
      sourceFolioInstanceId: 20,
      folioCourseListingId: 700,
      offeringId: 701,
      materializedResourceId: 801,
      materializedCourseResourceId: 802,
      materializedPhysicalReferenceId: 803,
      materializedFolderId: 804,
      materializedAt: '2026-10-12T10:00:00.000Z',
      materializedByStaffId: 52,
      processingContext: itemProcessingContext,
      claimedBy: { id: 52, username: 'pexample', display_name: 'Pat Example' },
      claimedAt: '2026-10-12T09:15:00.000Z',
      communications: [itemCommunication],
      unreadCommunications: 1,
      hasCommunications: true,
    };
    const unfolderedItem = {
      id: 102,
      title: 'Journal article',
      authors: '',
      materialType: 'article',
      url: null,
      isbn: null,
      publisher: null,
      doi: null,
      issn: null,
      journalTitle: null,
      volume: null,
      issue: null,
      eds: null,
      publicationYear: null,
      barcode: null,
      callNumber: null,
      status: 'pending',
      folderName: null,
      displayOrder: 1,
      positionInFolder: null,
      facultyNotes: null,
      staffNotes: '',
      isReuse: true,
      priority: 'medium',
      materialTypeId: 4,
      sourceResourceId: 22,
      sourceFolioInstanceId: 23,
      folioCourseListingId: undefined,
      offeringId: undefined,
      materializedResourceId: null,
      materializedCourseResourceId: null,
      materializedPhysicalReferenceId: null,
      materializedFolderId: null,
      materializedAt: null,
      materializedByStaffId: null,
      processingContext: null,
      claimedBy: null,
      claimedAt: null,
      communications: [],
      unreadCommunications: 0,
      hasCommunications: false,
    };

    expect(submissionWorkflowService.formatSubmissionDetail(response)).toEqual({
      submission: {
        id: 17,
        uuid: 'submission-17',
        courseCode: 'BIO-101-01',
        courseTitle: 'Introduction to Biology',
        section: '01',
        term: '2026FA',
        facultyName: 'Pat Example',
        facultyId: 'pexample',
        proxyName: 'Alex Proxy',
        proxyId: 'aproxy',
        status: 'submitted',
        submittedAt: '2026-10-12T08:00:00.000Z',
        neededByDate: '2026-11-01',
        submissionNotes: 'Synthetic submission note',
        isLocked: true,
        lockedBy: 52,
        lockedAt: '2026-10-12T09:00:00.000Z',
        lockReason: 'Processing items',
        assignedTo: 53,
        isDuplicatePrevious: false,
        duplicateNote: null,
        emailConfirmationSent: true,
        folioCourseListingId: 700,
        offeringId: 701,
      },
      folders: [{ name: 'Week 1', items: [formattedItem] }],
      unfolderedItems: [unfolderedItem],
      statistics: {
        totalItems: 2,
        totalFolders: 1,
        byStatus: { pending: 1, inProgress: 0, complete: 1, unavailable: 0 },
        completionPercentage: 50,
      },
      communications: {
        all: [itemCommunication, generalCommunication],
        general: [generalCommunication],
        total: 2,
        unread: 1,
        byResource: { 101: [itemCommunication] },
      },
      workflowAssignment: { id: 9, status: 'active' },
    });
  });

  it('keeps priority thresholds at 7 and 14 needed-by days and 7 submitted days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T00:00:00.000Z'));

    expect(submissionWorkflowService.determinePriority({ needed_by_date: '2026-10-20' }, 0)).toBe('urgent');
    expect(submissionWorkflowService.determinePriority({ needed_by_date: '2026-10-21' }, 0)).toBe('high');
    expect(submissionWorkflowService.determinePriority({ needed_by_date: '2026-10-27' }, 0)).toBe('high');
    expect(submissionWorkflowService.determinePriority({ needed_by_date: '2026-10-28' }, 0)).toBe('normal');
    expect(submissionWorkflowService.determinePriority({}, 7)).toBe('normal');
    expect(submissionWorkflowService.determinePriority({}, 8)).toBe('high');
  });
});
