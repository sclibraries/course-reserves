import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/services/apiClient', () => ({ default: api }));

vi.mock('@/config/endpoints', () => ({
  API_ENDPOINTS: {
    COURSE_RESERVES: {
      BASE_URL: 'https://api.test/course-reserves/backend/web',
      FACULTY_SUBMISSION_DRAFT: '/faculty-submission/draft',
      FACULTY_SUBMISSION_INDEX: '/faculty-submission/index',
      FACULTY_SUBMISSION_UPDATE: '/faculty-submission/:uuid',
      FACULTY_SUBMISSION_SUBMIT: '/faculty-submission/:uuid/submit',
      FACULTY_SUBMISSION_DELETE: '/faculty-submission/:uuid',
    },
  },
}));

import {
  createDraft,
  discardDraft,
  getDraft,
  saveDraft,
  syncDraft,
  submitDraft,
} from './facultyDraftApi';

describe('faculty draft API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a draft with the existing submit payload and returns its version', async () => {
    const payload = { courseInfo: { courseCode: 'BIO 101' }, items: [{ title: 'Synthetic item' }] };
    api.post.mockResolvedValue({ data: { submission_uuid: 'draft-1', status: 'draft', draft_version: 1 } });

    await expect(createDraft(payload)).resolves.toEqual({
      submission_uuid: 'draft-1', status: 'draft', draft_version: 1,
    });
    expect(api.post).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/draft',
      payload,
    );
  });

  it('saves with the current server version and returns the next version', async () => {
    const payload = { courseInfo: { courseCode: 'BIO 101' }, items: [] };
    api.put.mockResolvedValue({ data: { draft_version: 4 } });

    await expect(saveDraft('draft-1', payload, 3)).resolves.toEqual({ draft_version: 4 });
    expect(api.put).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/draft-1',
      { ...payload, draft_version: 3 },
    );
  });

  it('uses POST for a local reserve and versioned PUT after it has a server identity', async () => {
    const payload = { courseInfo: { courseCode: 'BIO 101' }, items: [] };
    api.post.mockResolvedValueOnce({ data: { submission_uuid: 'draft-1', status: 'draft', draft_version: 1 } });
    api.put.mockResolvedValueOnce({ data: { draft_version: 2 } });

    await expect(syncDraft({ id: 'reserve-local' }, payload)).resolves.toMatchObject({
      submission_uuid: 'draft-1', draft_version: 1,
    });
    await expect(syncDraft({ id: 'reserve-local', submissionUuid: 'draft-1', draftVersion: 1 }, payload))
      .resolves.toMatchObject({ submission_uuid: 'draft-1', draft_version: 2 });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/draft-1',
      { ...payload, draft_version: 1 },
    );
  });

  it('submits and discards through the draft UUID routes', async () => {
    api.post.mockResolvedValue({ data: { status: 'submitted' } });
    api.delete.mockResolvedValue({ status: 204 });

    await submitDraft('draft-1');
    await discardDraft('draft-1');

    expect(api.post).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/draft-1/submit',
    );
    expect(api.delete).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/draft-1',
    );
  });

  it('loads a full server draft from the authenticated index response', async () => {
    api.get.mockResolvedValue({ data: { items: [{
      submission_uuid: 'draft-1',
      course_code: 'BIO 101',
      course_title: 'Synthetic Biology',
      section: '01',
      faculty_display_name: 'Test Faculty',
      term_code: '2027SP',
      status: 'draft',
      updated_at: '2026-10-20T12:00:00Z',
      draft_version: 8,
      folders: [],
      unfoldered_items: [{ id: 1, title: 'Server item', material_type: 'book', status: 'draft', display_order: 0 }],
    }] } });

    await expect(getDraft('draft-1')).resolves.toMatchObject({
      id: 'draft-1', submissionUuid: 'draft-1', draftVersion: 8,
      status: 'draft', items: [{ title: 'Server item' }],
    });
    expect(api.get).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/index',
    );
  });
});
