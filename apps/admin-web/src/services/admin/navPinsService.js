import { apiConfig } from '../../config/api.config';
import { authFetch } from '../http/authFetch';

const endpoint = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.admin.staffNavPins}`;

async function request(method, body) {
  const response = await authFetch(endpoint, {
    method,
    ...(body ? {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : {}),
  });

  if (!response.ok) throw new Error('Unable to save navigation pins');
  return response.json();
}

export const navPinsService = {
  getPins: () => request('GET'),
  savePins: (pins) => request('PUT', { pins }),
  resetPins: () => request('DELETE'),
};
