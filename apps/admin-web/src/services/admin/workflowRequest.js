import { apiConfig } from '../../config/api.config';
import { authFetch } from '../http/authFetch';

export class WorkflowRequestError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || `Workflow request failed (${status})`);
    this.name = 'WorkflowRequestError';
    this.status = status;
    this.payload = payload;
  }
}

export function workflowPath(group, name) {
  const path = apiConfig.endpoints?.[group]?.[name];
  if (!path) throw new Error(`Workflow endpoint is not configured: ${group}.${name}`);
  return path;
}

export async function requestWorkflow(path, { method = 'GET', body, responseType = 'json' } = {}) {
  const response = await authFetch(`${apiConfig.urls.courseReserves}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.ok && responseType === 'blob') return response.blob();

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) throw new WorkflowRequestError(response.status, payload);
  return payload;
}
