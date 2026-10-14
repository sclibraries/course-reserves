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
