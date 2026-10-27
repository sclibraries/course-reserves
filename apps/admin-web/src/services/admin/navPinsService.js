import { apiConfig } from '../../config/api.config';
import { authFetch } from '../http/authFetch';

const endpoint = `${apiConfig.urls.courseReserves}${apiConfig.endpoints.admin.staffNavPins}`;
const defaultsEndpoint = `${endpoint}/defaults`;

async function request(url, method, body) {
  const response = await authFetch(url, {
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
  getPins: () => request(endpoint, 'GET'),
  savePins: (pins) => request(endpoint, 'PUT', { pins }),
  resetPins: () => request(endpoint, 'DELETE'),
  getDefaultPins: () => request(defaultsEndpoint, 'GET'),
  saveDefaultPins: (pins) => request(defaultsEndpoint, 'PUT', { pins }),
};
