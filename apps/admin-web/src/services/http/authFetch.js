import { config } from '../../config';

export const authFetch = (input, init = {}) => fetch(input, {
  ...init,
  headers: {
    ...init.headers,
    Authorization: config.api.getAuthToken(),
  },
});
