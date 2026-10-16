import { config } from '../../../config';

const COURSE_API = config.api.urls.courseReserves;
const FOLIO_API = config.api.urls.folio;

export const folioCourseSearch = {
  async searchCoursesByQuery(query) {
    const safeQuery = query.replace(/^\*+/, '');
    const cql = `(name="${safeQuery}*" or courseNumber="${safeQuery}*")`;
    const response = await fetch(
      `${FOLIO_API}${config.api.endpoints.folioSearch.courses}?query=${encodeURIComponent(cql)}`
    );

    if (!response.ok) {
      if (response.status === 400) {
        console.warn('CQL Search Error:', await response.text());
        return [];
      }
      throw new Error('Failed to search FOLIO courses');
    }

    const result = await response.json();
    return result.data || [];
  },

  async searchFolioCourses(searchTerm) {
    const response = await fetch(
      `${FOLIO_API}${config.api.endpoints.folioSearch.courses}?query=${encodeURIComponent(searchTerm)}`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    if (!response.ok) {
      throw new Error('Failed to search FOLIO courses');
    }

    const result = await response.json();
    return result.data || [];
  },

  async getFolioCourseId(uuid, section = null) {
    let url = `${COURSE_API}${config.api.endpoints.course.checkUniqueId}?uuid=${uuid}`;
    if (section) {
      url += `&section=${encodeURIComponent(section)}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Error checking course existence.');
    }
    return response.json();
  },
};
