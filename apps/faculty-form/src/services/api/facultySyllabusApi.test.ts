import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/services/apiClient', () => ({ default: api }));
vi.mock('@/config/endpoints', () => ({
  API_ENDPOINTS: {
    COURSE_RESERVES: {
      BASE_URL: 'https://api.test/course-reserves/backend/web',
      FACULTY_SUBMISSION_SYLLABI: '/faculty-submission/:uuid/syllabi',
    },
  },
}));

import { createFacultySyllabus, listFacultySyllabi } from './facultySyllabusApi';

const record = {
  id: 17,
  source: 'upload',
  source_url: null,
  original_filename: 'sample.pdf',
  mime_type: 'application/pdf',
  byte_size: 12,
  extracted_text: 'Week 1',
  created_at: '2026-10-26T12:00:00Z',
};

describe('faculty syllabus API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists syllabi attached to the submission UUID', async () => {
    api.get.mockResolvedValue({ data: { syllabi: [record] } });

    await expect(listFacultySyllabi('draft/one')).resolves.toEqual([record]);
    expect(api.get).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/draft%2Fone/syllabi',
    );
  });

  it('attaches a Google Doc URL as JSON', async () => {
    const payload = { google_doc_url: 'https://docs.google.com/document/d/example/view' };
    api.post.mockResolvedValue({ data: record });

    await expect(createFacultySyllabus('draft-1', payload)).resolves.toEqual(record);
    expect(api.post).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/draft-1/syllabi', payload,
    );
  });

  it('attaches extracted file data as JSON', async () => {
    const payload = {
      filename: 'sample.pdf',
      mime_type: 'application/pdf',
      content_base64: 'AQID',
      extracted_text: 'Week 1',
    };
    api.post.mockResolvedValue({ data: record });

    await createFacultySyllabus('draft-1', payload);
    expect(api.post).toHaveBeenCalledWith(
      'https://api.test/course-reserves/backend/web/faculty-submission/draft-1/syllabi', payload,
    );
  });
});
