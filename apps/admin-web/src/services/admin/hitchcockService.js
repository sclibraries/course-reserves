import { config } from '../../config';

export const hitchcockService = {
  searchResources(searchQuery) {
    const searchUrl = `${config.api.urls.courseReserves}${config.api.endpoints.courseReserves.hitchcockSearch}?title=${encodeURIComponent(searchQuery)}`;
    return fetch(searchUrl, {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
