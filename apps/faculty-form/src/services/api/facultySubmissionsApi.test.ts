import { describe, expect, it, vi } from 'vitest';
import type { BackendSubmission } from '@/store/reserve/submissionMapping';

type IndexPage = { items: BackendSubmission[]; meta: { totalCount: number } };

vi.mock('@/config/endpoints', () => ({
  API_ENDPOINTS: {
    COURSE_RESERVES: {
      BASE_URL: 'https://api.test',
      FACULTY_SUBMISSION_INDEX: '/faculty-submission/index',
    },
  },
}));

import { readAllSubmissions } from './facultySubmissionsApi';

describe('readAllSubmissions', () => {
  it('reads the counted pages and keeps repeated submissions once in order', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      submission_uuid: `submission-${index + 1}`,
    })) as BackendSubmission[];
    const readPage = vi.fn(async (url: string) => ({
      items: url.endsWith('page=1') ? rows.slice(0, 50) : [rows[49], rows[50]],
      meta: { totalCount: 51 },
    }));

    await expect(readAllSubmissions(readPage)).resolves.toEqual(rows);
    expect(readPage.mock.calls.map(([url]) => url)).toEqual([
      'https://api.test/faculty-submission/index?per-page=50&page=1',
      'https://api.test/faculty-submission/index?per-page=50&page=2',
    ]);
  });

  it('rejects when a later page fails', async () => {
    const readPage = vi.fn<(url: string) => Promise<IndexPage>>()
      .mockResolvedValueOnce({ items: [], meta: { totalCount: 51 } })
      .mockRejectedValueOnce(new Error('page 2 failed'));

    await expect(readAllSubmissions(readPage)).rejects.toThrow('page 2 failed');
  });
});
