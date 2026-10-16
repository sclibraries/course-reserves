import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiConfig } from '../../../config/api.config';

vi.mock('../../http/authFetch', () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from '../../http/authFetch';
import { linkingApi } from './linkingApi';

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const base = apiConfig.urls.courseReserves;
const uuid = 'synthetic-submission-uuid';

describe('linkingApi', () => {
  afterEach(() => vi.clearAllMocks());

  it('loads the needs-linking page with its term filter', async () => {
    authFetch.mockResolvedValue(response({ items: [], count: 0 }));

    await linkingApi.getNeedsLinking(2, '2026FA');

    expect(authFetch).toHaveBeenCalledWith(
      `${base}/workflow/needs-linking?page=2&term=2026FA`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads suggestions and encodes a manual candidate query', async () => {
    authFetch.mockResolvedValue(response({ items: [], checked_at: null }));

    await linkingApi.getCandidates(uuid, 'AFR 155');

    expect(authFetch).toHaveBeenCalledWith(
      `${base}/workflow/submission/${uuid}/candidates?query=AFR+155`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads suggestions without a query for the initial check', async () => {
    authFetch.mockResolvedValue(response({ items: [], checked_at: null }));

    await linkingApi.getCandidates(uuid);

    expect(authFetch).toHaveBeenCalledWith(
      `${base}/workflow/submission/${uuid}/candidates`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it.each([
    ['linkSubmission', { folio_course_listing_id: 'folio-listing-1' }, 'link'],
    ['correctSubmission', { course_code: 'AFR155', section: '01', reason: 'Correct roster typo' }, 'correct'],
    ['overrideSubmissionLink', { folio_course_listing_id: 'folio-listing-1', reason: 'Approved mismatch' }, 'link-override'],
    ['unlinkSubmission', { reason: 'Moving to the right section' }, 'unlink'],
    ['recheckSubmission', undefined, 'recheck'],
  ])('sends the contract request for %s', async (method, body, route) => {
    authFetch.mockResolvedValue(response({ link_state: 'linked' }));

    await linkingApi[method](uuid, body);

    const expected = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) expected.body = JSON.stringify(body);
    expect(authFetch).toHaveBeenCalledWith(`${base}/workflow/submission/${uuid}/${route}`, expected);
  });

  it('loads the staff-only submission timeline', async () => {
    authFetch.mockResolvedValue(response({ items: [] }));

    await linkingApi.getTimeline(uuid);

    expect(authFetch).toHaveBeenCalledWith(
      `${base}/workflow/submission/${uuid}/timeline`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('preserves conflict payloads for the panel to explain', async () => {
    authFetch.mockResolvedValue(response({
      error_code: 'not_exact_match',
      fields: { course_number: true, section: false, term: false },
    }, 409));

    await expect(linkingApi.linkSubmission(uuid, { folio_course_listing_id: 'folio-listing-1' }))
      .rejects.toMatchObject({
        status: 409,
        payload: {
          error_code: 'not_exact_match',
          fields: { course_number: true, section: false, term: false },
        },
      });
  });

  it('surfaces network errors instead of swallowing them', async () => {
    authFetch.mockRejectedValue(new Error('Network offline'));

    await expect(linkingApi.getNeedsLinking()).rejects.toThrow('Network offline');
  });
});
