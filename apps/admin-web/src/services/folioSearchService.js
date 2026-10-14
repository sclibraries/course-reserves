import { config } from '../config';

export const folioSearchService = {
  getDepartments(query, suffix = '') {
    const queryString = query ? `?query=${encodeURIComponent(query)}${suffix}` : '';
    return fetch(
      `${config.api.urls.folio}${config.api.endpoints.folioSearch.departments}${queryString}`
    );
  },

  getInventory(instanceId) {
    return fetch(
      `${config.api.urls.folio}${config.api.endpoints.folioSearch.inventory}?query=id==${instanceId}`
    );
  },
};
