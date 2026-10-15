import { apiConfig } from '../../config/api.config';
import { authFetch } from '../http/authFetch';

const API_BASE = apiConfig.urls.courseReserves;
const endpoints = apiConfig.endpoints.facultyProxy;

const withQuery = (path, filters) => {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.facultyId) query.set('faculty_id', filters.facultyId);
  const suffix = query.toString();
  return `${API_BASE}${path}${suffix ? `?${suffix}` : ''}`;
};

const request = async (url, options) => {
  const response = await authFetch(url, options);
  if (!response.ok) {
    let message = `Faculty proxy request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      // Keep the status-based message when the server has no JSON error body.
    }
    throw new Error(message);
  }
  return response.json();
};

export const facultyProxyService = {
  listGrants(filters = {}) {
    return request(withQuery(endpoints.staffGrants, filters));
  },

  getActivityLog(filters = {}) {
    return request(withQuery(endpoints.staffActivityLog, filters));
  },

  revokeGrant(id) {
    return request(`${API_BASE}${endpoints.staffGrants}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
