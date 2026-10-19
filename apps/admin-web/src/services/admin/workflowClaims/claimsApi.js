import { apiConfig } from '../../../config/api.config';
import { authFetch } from '../../http/authFetch';

export class ClaimsRequestError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || `Workflow request failed (${status})`);
    this.name = 'ClaimsRequestError';
    this.status = status;
    this.payload = payload;
  }
}

function configuredPath(name) {
  const path = apiConfig.endpoints?.workflowClaims?.[name];
  if (!path) throw new Error(`Workflow claims endpoint is not configured: ${name}`);
  return path;
}

function itemPath(name, kind, id) {
  return configuredPath(name)
    .replace(':kind', encodeURIComponent(kind))
    .replace(':id', encodeURIComponent(id));
}

async function requestClaims(path, { method = 'GET', body } = {}) {
  const response = await authFetch(`${apiConfig.urls.courseReserves}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) throw new ClaimsRequestError(response.status, payload);
  return payload;
}

export const claimsApi = {
  getQueue({ term = '', type = '', page = 1 } = {}) {
    const query = new URLSearchParams({ term, type, page: String(page) });
    return requestClaims(`${configuredPath('queue')}?${query.toString()}`);
  },

  getMyItems() {
    return requestClaims(configuredPath('myItems'));
  },

  getStaff(query = '') {
    return requestClaims(`${configuredPath('staff')}?${new URLSearchParams({ q: query }).toString()}`);
  },

  getItemTimeline(kind, id) {
    return requestClaims(itemPath('itemTimeline', kind, id));
  },

  claimItem(kind, id) {
    return requestClaims(itemPath('itemClaim', kind, id), { method: 'POST' });
  },

  releaseItem(kind, id, body) {
    return requestClaims(itemPath('itemRelease', kind, id), { method: 'POST', body });
  },

  handoffItem(kind, id, body) {
    return requestClaims(itemPath('itemHandoff', kind, id), { method: 'POST', body });
  },

  takeoverItem(kind, id, body) {
    return requestClaims(itemPath('itemTakeover', kind, id), { method: 'POST', body });
  },

  claimAllItems(uuid) {
    const path = configuredPath('submissionClaimAll').replace(':uuid', encodeURIComponent(uuid));
    return requestClaims(path, { method: 'POST' });
  },
};
