import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiConfig } from '../../config/api.config';
import { WorkflowRequestError } from './workflowRequest';

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../http/authFetch', () => ({ authFetch: mocks.authFetch }));

import {
  getSubmissionSyllabusError,
  submissionSyllabiService,
} from './submissionSyllabiService';

describe('submissionSyllabiService', () => {
  beforeEach(() => mocks.authFetch.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('loads the syllabus list through the authenticated submission route', async () => {
    const syllabi = [{ id: 41, source: 'google_doc', extracted_text: 'Synthetic text' }];
    mocks.authFetch.mockResolvedValue({ ok: true, json: async () => ({ syllabi }) });

    await expect(submissionSyllabiService.getSyllabi(31)).resolves.toEqual(syllabi);
    expect(mocks.authFetch).toHaveBeenCalledWith(
      `${apiConfig.urls.courseReserves}/workflow/submission/31/syllabi`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
  });

  it('downloads an original through its authenticated file route', async () => {
    const file = new Blob(['synthetic file']);
    const blob = vi.fn().mockResolvedValue(file);
    mocks.authFetch.mockResolvedValue({ ok: true, blob });

    await expect(submissionSyllabiService.downloadOriginal(31, 41)).resolves.toBe(file);
    expect(mocks.authFetch).toHaveBeenCalledWith(
      `${apiConfig.urls.courseReserves}/workflow/submission/31/syllabi/41/file`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    expect(blob).toHaveBeenCalledOnce();
  });

  it('keeps the error reference available for a generic page message', async () => {
    const payload = { error_code: 'syllabus_unavailable', message: 'Synthetic provider detail', reference: 'SYNTH-API-1' };
    mocks.authFetch.mockResolvedValue({ ok: false, status: 503, json: async () => payload });

    await expect(submissionSyllabiService.getSyllabi(31)).rejects.toBeInstanceOf(WorkflowRequestError);
    await expect(submissionSyllabiService.getSyllabi(31)).rejects.toMatchObject({ payload });
    expect(getSubmissionSyllabusError({ payload }, 'load')).toBe(
      'Syllabi could not be loaded. Please try again later. Reference: SYNTH-API-1',
    );
    expect(getSubmissionSyllabusError({ payload }, 'download')).toBe(
      'The original could not be downloaded. Please try again later. Reference: SYNTH-API-1',
    );
  });
});
