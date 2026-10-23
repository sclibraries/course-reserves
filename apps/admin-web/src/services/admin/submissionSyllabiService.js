import { apiConfig } from '../../config/api.config';
import { authFetch } from '../http/authFetch';

export class SubmissionSyllabusRequestError extends Error {
  constructor(status, payload) {
    super(payload?.message || `Syllabus request failed (${status})`);
    this.name = 'SubmissionSyllabusRequestError';
    this.status = status;
    this.payload = payload;
  }
}

async function request(url) {
  return authFetch(`${apiConfig.urls.courseReserves}${url}`, {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function throwResponseError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Error responses may not have a JSON body.
  }
  throw new SubmissionSyllabusRequestError(response.status, payload);
}

const submissionPath = (submissionId) => `/workflow/submission/${encodeURIComponent(submissionId)}/syllabi`;

export const submissionSyllabiService = {
  async getSyllabi(submissionId) {
    const response = await request(submissionPath(submissionId));
    if (!response.ok) await throwResponseError(response);
    return (await response.json()).syllabi;
  },

  async downloadOriginal(submissionId, syllabusId) {
    const response = await request(`${submissionPath(submissionId)}/${encodeURIComponent(syllabusId)}/file`);
    if (!response.ok) await throwResponseError(response);
    return response.blob();
  },
};

export function getSubmissionSyllabusError(error, operation) {
  const message = operation === 'load'
    ? 'Syllabi could not be loaded. Please try again later.'
    : 'The original could not be downloaded. Please try again later.';
  return error?.payload?.reference ? `${message} Reference: ${error.payload.reference}` : message;
}
