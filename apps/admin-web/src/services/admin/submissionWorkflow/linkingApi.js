import { apiConfig } from '../../../config/api.config';
import { authFetch } from '../../http/authFetch';

export class LinkingRequestError extends Error {
  constructor(status, payload) {
    const message = payload?.message || payload?.error || `Workflow request failed (${status})`;
    super(message);
    this.name = 'LinkingRequestError';
    this.status = status;
    this.payload = payload;
  }
}

function configuredPath(name) {
  const path = apiConfig.endpoints?.workflowLinking?.[name];
  if (!path) throw new Error(`Workflow linking endpoint is not configured: ${name}`);
  return path;
}

function submissionPath(name, uuid) {
  return configuredPath(name).replace(':uuid', encodeURIComponent(uuid));
}

async function requestWorkflow(path, options = {}) {
  const response = await authFetch(`${apiConfig.urls.courseReserves}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) throw new LinkingRequestError(response.status, payload);
  return payload;
}

export const linkingApi = {
  getNeedsLinking(page = 1, term = '') {
    const query = new URLSearchParams({ page: String(page) });
    if (term) query.set('term', term);
    return requestWorkflow(`${configuredPath('needsLinking')}?${query.toString()}`);
  },

  getCandidates(uuid, query) {
    const endpoint = submissionPath('submissionCandidates', uuid);
    if (!query) return requestWorkflow(endpoint);
    return requestWorkflow(`${endpoint}?${new URLSearchParams({ query }).toString()}`);
  },

  getTimeline(uuid) {
    return requestWorkflow(submissionPath('submissionTimeline', uuid));
  },

  linkSubmission(uuid, body) {
    return requestWorkflow(submissionPath('submissionLink', uuid), { method: 'POST', body });
  },

  correctSubmission(uuid, body) {
    return requestWorkflow(submissionPath('submissionCorrect', uuid), { method: 'POST', body });
  },

  overrideSubmissionLink(uuid, body) {
    return requestWorkflow(submissionPath('submissionLinkOverride', uuid), { method: 'POST', body });
  },

  unlinkSubmission(uuid, body) {
    return requestWorkflow(submissionPath('submissionUnlink', uuid), { method: 'POST', body });
  },

  recheckSubmission(uuid) {
    return requestWorkflow(submissionPath('submissionRecheck', uuid), { method: 'POST' });
  },
};
